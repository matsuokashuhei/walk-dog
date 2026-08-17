import { useFocusEffect, useRouter } from 'expo-router'
import * as Location from 'expo-location'
import { AppleMaps } from 'expo-maps'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { listDogs, type DogResponse } from '@/lib/dog-api'
import {
  deleteWalk,
  finishWalk,
  getActiveWalk,
  startWalk,
  type CompletedWalkResponse,
  type LocalTrackPoint,
  type RecordingWalkResponse,
} from '@/lib/walk-api'
import { loadPathForWalk } from '@/lib/walk-path-store'
import {
  setTrackPointEvents,
  startTrackPointUpdates,
  stopTrackPointUpdates,
} from '@/lib/walk-location-task'

type DogListItem = Omit<DogResponse, 'requestId'>

type CameraPosition = {
  coordinates: { latitude: number; longitude: number }
  zoom: number
}

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'load_error' }
  | {
      kind: 'ready'
      dogs: DogListItem[]
      selectedDogIds: string[]
      startError: boolean
      startKey: string | null
    }
  | {
      kind: 'starting'
      dogs: DogListItem[]
      selectedDogIds: string[]
      startKey: string
    }
  | {
      kind: 'recording'
      walk: RecordingWalkResponse
      finishError: boolean
      finishKey: string | null
    }
  | { kind: 'completed'; walk: CompletedWalkResponse }
  | { kind: 'failed' }

async function isLocationFullyGranted(): Promise<boolean> {
  const foreground = await Location.getForegroundPermissionsAsync()
  const background = await Location.getBackgroundPermissionsAsync()
  return (
    foreground.status === Location.PermissionStatus.GRANTED &&
    background.status === Location.PermissionStatus.GRANTED
  )
}

async function readCameraPosition(): Promise<CameraPosition | undefined> {
  const position = await Location.getCurrentPositionAsync()
  return {
    coordinates: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    },
    zoom: 15,
  }
}

function formatElapsed(startedAt: string, now: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))
  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatDuration(durationSeconds: number): string {
  const minutes = Math.floor(durationSeconds / 60)
  return `${minutes}分`
}

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

function newIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isLoadableKind(kind: ScreenState['kind']): boolean {
  return kind === 'loading' || kind === 'ready' || kind === 'load_error'
}

export default function WalkScreen() {
  const router = useRouter()
  const { session, clearSession } = useAuth()
  const insets = useSafeAreaInsets()
  const [state, setState] = useState<ScreenState>({ kind: 'loading' })
  const [locationGranted, setLocationGranted] = useState(false)
  const [cameraPosition, setCameraPosition] = useState<CameraPosition | undefined>()
  const [pathPoints, setPathPoints] = useState<LocalTrackPoint[]>([])
  const [now, setNow] = useState(() => Date.now())
  const stateRef = useRef(state)
  const finishingRef = useRef(false)
  const failingRef = useRef(false)
  const startingRef = useRef(false)
  const loadGeneration = useRef(0)
  stateRef.current = state

  const applyLocation = useCallback(async (granted: boolean) => {
    setLocationGranted(granted)
    if (!granted) {
      setCameraPosition(undefined)
      return
    }
    try {
      setCameraPosition(await readCameraPosition())
    } catch {
      setCameraPosition(undefined)
    }
  }, [])

  const load = useCallback(
    async (mode: 'full' | 'silent') => {
      if (!session) {
        throw new Error('Walk requires an authenticated session')
      }
      const generation = ++loadGeneration.current
      const originKind = stateRef.current.kind
      if (mode === 'full' && originKind !== 'failed') {
        setState({ kind: 'loading' })
      }

      const shouldApply = (): boolean => {
        if (generation !== loadGeneration.current || startingRef.current) {
          return false
        }
        if (originKind === 'failed' || originKind === 'completed') {
          return true
        }
        return isLoadableKind(stateRef.current.kind)
      }

      try {
        const [walk, dogsResult, granted] = await Promise.all([
          getActiveWalk(session.accessToken),
          listDogs(session.accessToken),
          isLocationFullyGranted(),
        ])
        if (!shouldApply()) {
          return
        }
        await applyLocation(granted)
        if (!shouldApply()) {
          return
        }
        if (walk !== null) {
          finishingRef.current = false
          failingRef.current = false
          startingRef.current = false
          setState({ kind: 'recording', walk, finishError: false, finishKey: null })
          return
        }
        const current = stateRef.current
        const previousSelected =
          mode === 'silent' && current.kind === 'ready' ? current.selectedDogIds : []
        const existingIds = new Set(dogsResult.dogs.map((dog) => dog.dogId))
        const selectedDogIds = previousSelected.filter((id) => existingIds.has(id))
        const keepStartKey =
          mode === 'silent' &&
          current.kind === 'ready' &&
          current.startKey !== null &&
          sameIds(current.selectedDogIds, selectedDogIds)
        startingRef.current = false
        setState({
          kind: 'ready',
          dogs: dogsResult.dogs,
          selectedDogIds,
          startError: keepStartKey ? current.startError : false,
          startKey: keepStartKey ? current.startKey : null,
        })
      } catch {
        if (!shouldApply()) {
          return
        }
        if (originKind === 'failed') {
          setState({ kind: 'failed' })
          return
        }
        setState({ kind: 'load_error' })
      }
    },
    [applyLocation, session],
  )

  const verifyRecording = useCallback(async () => {
    if (!session || finishingRef.current || failingRef.current) {
      return
    }
    const current = stateRef.current
    if (current.kind !== 'recording') {
      return
    }
    const granted = await isLocationFullyGranted()
    if (!granted) {
      setLocationGranted(false)
      setCameraPosition(undefined)
      failingRef.current = true
      try {
        await deleteWalk(session.accessToken, current.walk.walkId)
        if (finishingRef.current || stateRef.current.kind !== 'recording') {
          return
        }
        setState({ kind: 'failed' })
      } catch {
        return
      } finally {
        failingRef.current = false
      }
      return
    }
    try {
      const walk = await getActiveWalk(session.accessToken)
      if (finishingRef.current || stateRef.current.kind !== 'recording') {
        return
      }
      if (walk === null) {
        setState({ kind: 'failed' })
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await stopTrackPointUpdates()
        await clearSession()
      }
      return
    }
  }, [clearSession, session])

  useFocusEffect(
    useCallback(() => {
      const current = stateRef.current
      if (current.kind === 'completed' || current.kind === 'failed' || current.kind === 'starting') {
        return
      }
      if (current.kind === 'recording') {
        void verifyRecording()
        return
      }
      void load(current.kind === 'ready' ? 'silent' : 'full')
    }, [load, verifyRecording]),
  )

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && stateRef.current.kind === 'recording') {
        void verifyRecording()
      }
    })
    return () => {
      sub.remove()
    }
  }, [verifyRecording])

  useEffect(() => {
    if (state.kind !== 'recording') {
      setTrackPointEvents(null)
      setPathPoints([])
      void stopTrackPointUpdates()
      return
    }
    const walkId = state.walk.walkId
    setTrackPointEvents({
      onPathChange: setPathPoints,
      onUnauthenticated: () => {
        void clearSession()
      },
    })
    void startTrackPointUpdates(walkId)
    void loadPathForWalk(walkId).then(setPathPoints)
    return () => {
      setTrackPointEvents(null)
    }
  }, [state.kind, state.kind === 'recording' ? state.walk.walkId : null])

  useEffect(() => {
    if (state.kind !== 'recording') {
      return
    }
    const walkId = state.walk.walkId
    setNow(Date.now())
    void loadPathForWalk(walkId).then(setPathPoints)
    const id = setInterval(() => {
      setNow(Date.now())
      void loadPathForWalk(walkId).then(setPathPoints)
    }, 1000)
    return () => {
      clearInterval(id)
    }
  }, [state.kind, state.kind === 'recording' ? state.walk.walkId : null])

  const onAllowLocation = async () => {
    const foreground = await Location.requestForegroundPermissionsAsync()
    if (foreground.status === Location.PermissionStatus.GRANTED) {
      await Location.requestBackgroundPermissionsAsync()
    }
    await applyLocation(await isLocationFullyGranted())
  }

  const onToggleDog = (dogId: string) => {
    setState((current) => {
      if (current.kind !== 'ready') {
        return current
      }
      const selected = current.selectedDogIds.includes(dogId)
        ? current.selectedDogIds.filter((id) => id !== dogId)
        : [...current.selectedDogIds, dogId]
      return {
        ...current,
        selectedDogIds: selected,
        startKey: null,
        startError: false,
      }
    })
  }

  const onStart = () => {
    if (!session || state.kind !== 'ready' || startingRef.current) {
      return
    }
    if (state.dogs.length === 0 || state.selectedDogIds.length === 0 || !locationGranted) {
      return
    }
    const startKey = state.startKey ?? newIdempotencyKey()
    const selectedDogIds = state.selectedDogIds
    const dogs = state.dogs
    startingRef.current = true
    loadGeneration.current += 1
    setState({ kind: 'starting', dogs, selectedDogIds, startKey })
    void startWalk(session.accessToken, {
      participantDogIds: selectedDogIds,
      idempotencyKey: startKey,
    })
      .then((walk) => {
        finishingRef.current = false
        startingRef.current = false
        setState({ kind: 'recording', walk, finishError: false, finishKey: null })
      })
      .catch(() => {
        startingRef.current = false
        setState({
          kind: 'ready',
          dogs,
          selectedDogIds,
          startError: true,
          startKey,
        })
      })
  }

  const onFinish = () => {
    if (!session || state.kind !== 'recording' || finishingRef.current || failingRef.current) {
      return
    }
    const finishKey = state.finishKey ?? newIdempotencyKey()
    const walk = state.walk
    finishingRef.current = true
    setState({ kind: 'recording', walk, finishError: false, finishKey })
    void finishWalk(session.accessToken, { walkId: walk.walkId, idempotencyKey: finishKey })
      .then((completed) => {
        setState({ kind: 'completed', walk: completed })
      })
      .catch(() => {
        finishingRef.current = false
        setState({ kind: 'recording', walk, finishError: true, finishKey })
      })
  }

  const onBackToReady = () => {
    void load('full')
  }

  const showMap =
    locationGranted &&
    Platform.OS === 'ios' &&
    state.kind !== 'loading' &&
    state.kind !== 'load_error' &&
    state.kind !== 'completed' &&
    state.kind !== 'failed'

  const canStart =
    state.kind === 'ready' &&
    state.dogs.length > 0 &&
    state.selectedDogIds.length > 0 &&
    locationGranted

  const currentPoint = pathPoints.at(-1)
  const pathCoordinates = pathPoints.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
  }))
  const mapCameraPosition =
    state.kind === 'recording' && currentPoint
      ? {
          coordinates: {
            latitude: currentPoint.latitude,
            longitude: currentPoint.longitude,
          },
          zoom: 15,
        }
      : cameraPosition

  return (
    <View style={[styles.container, showMap ? styles.containerMap : null]} testID="walk-root">
      {showMap ? (
        <AppleMaps.View
          style={styles.map}
          properties={{
            isMyLocationEnabled: true,
            selectionEnabled: false,
            pointsOfInterest: { including: [] },
          }}
          cameraPosition={mapCameraPosition}
          markers={
            state.kind === 'recording' && currentPoint
              ? [
                  {
                    id: 'current',
                    coordinates: {
                      latitude: currentPoint.latitude,
                      longitude: currentPoint.longitude,
                    },
                  },
                ]
              : []
          }
          polylines={
            state.kind === 'recording' && pathCoordinates.length >= 2
              ? [
                  {
                    id: 'walk-path',
                    coordinates: pathCoordinates,
                  },
                ]
              : []
          }
        />
      ) : null}

      <View
        pointerEvents="box-none"
        style={[styles.screen, { paddingBottom: 24 + insets.bottom + 64 }]}
      >
        {state.kind === 'loading' ? (
          <>
            <Text style={styles.label}>walk</Text>
            <Text style={styles.title}>Ready</Text>
            <Text style={styles.busy} testID="walk-loading">
              読み込み中…
            </Text>
            <View style={styles.spacer} />
          </>
        ) : null}

        {state.kind === 'load_error' ? (
          <>
            <Text style={styles.label}>walk</Text>
            <Text style={styles.title}>Ready</Text>
            <Text style={styles.error} testID="walk-load-error">
              読み込めませんでした。再試行してください。
            </Text>
            <View style={styles.spacer} />
            <Pressable
              testID="walk-retry"
              accessible
              accessibilityRole="button"
              accessibilityLabel="再試行"
              style={styles.primary}
              onPress={() => {
                void load('full')
              }}
            >
              <Text style={styles.primaryText} accessible={false}>
                再試行
              </Text>
            </Pressable>
          </>
        ) : null}

        {state.kind === 'ready' ? (
          <>
            <Text style={styles.label}>walk</Text>
            <Text style={styles.title}>Ready</Text>
            {state.dogs.length === 0 ? (
              <Text style={styles.help}>散歩に連れて行く Dog を登録してください。</Text>
            ) : (
              <Text style={styles.help}>連れて行く Dog を選んでください。</Text>
            )}
            {state.dogs.length > 0 ? (
              <ScrollView style={styles.listScroll} contentContainerStyle={styles.list}>
                {state.dogs.map((dog) => {
                  const selected = state.selectedDogIds.includes(dog.dogId)
                  return (
                    <Pressable
                      key={dog.dogId}
                      testID={`walk-dog-row-${dog.dogId}`}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={dog.name}
                      style={styles.row}
                      onPress={() => {
                        onToggleDog(dog.dogId)
                      }}
                    >
                      <View style={[styles.check, selected ? styles.checkOn : null]}>
                        {selected ? (
                          <Text style={styles.checkMark} accessible={false}>
                            ✓
                          </Text>
                        ) : null}
                      </View>
                      <Text style={styles.rowName}>{dog.name}</Text>
                    </Pressable>
                  )
                })}
              </ScrollView>
            ) : (
              <View style={styles.spacer} />
            )}
            {state.dogs.length > 0 && state.selectedDogIds.length === 0 ? (
              <Text style={styles.error} testID="walk-condition">
                Dog を1頭以上選んでください。
              </Text>
            ) : null}
            {state.dogs.length > 0 && state.selectedDogIds.length > 0 && !locationGranted ? (
              <Text style={styles.error} testID="walk-location-required">
                位置情報（使用中および常に）を許可してください。
              </Text>
            ) : null}
            {state.startError ? (
              <Text style={styles.error} testID="walk-start-error">
                開始に失敗しました。再試行してください。
              </Text>
            ) : null}
            {state.dogs.length > 0 ? <View style={styles.spacer} /> : null}
            {state.dogs.length > 0 && state.selectedDogIds.length > 0 && !locationGranted ? (
              <Pressable
                testID="walk-allow-location"
                accessible
                accessibilityRole="button"
                accessibilityLabel="位置情報を許可"
                style={styles.primary}
                onPress={() => {
                  void onAllowLocation()
                }}
              >
                <Text style={styles.primaryText} accessible={false}>
                  位置情報を許可
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              testID="walk-start"
              accessible
              accessibilityRole="button"
              accessibilityLabel="開始する"
              disabled={!canStart}
              style={[styles.primary, canStart ? null : styles.disabled]}
              onPress={onStart}
            >
              <Text style={[styles.primaryText, canStart ? null : styles.disabledText]} accessible={false}>
                開始する
              </Text>
            </Pressable>
            {state.dogs.length === 0 ? (
              <Pressable
                testID="walk-empty-register"
                accessible
                accessibilityRole="button"
                accessibilityLabel="Dog を登録"
                style={styles.primary}
                onPress={() => {
                  router.push('/dogs/new')
                }}
              >
                <Text style={styles.primaryText} accessible={false}>
                  Dog を登録
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {state.kind === 'starting' ? (
          <>
            <Text style={styles.label}>walk status</Text>
            <Text style={styles.title}>開始しています</Text>
            <Text style={styles.help}>選択した Dog で散歩を開始します。</Text>
            {state.dogs
              .filter((dog) => state.selectedDogIds.includes(dog.dogId))
              .map((dog) => (
                <View key={dog.dogId} style={styles.row}>
                  <View>
                    <Text style={styles.rowName}>{dog.name}</Text>
                    <Text style={styles.rowMeta}>participant</Text>
                  </View>
                </View>
              ))}
            <Text style={styles.busy} testID="walk-starting">
              開始しています…
            </Text>
            <View style={styles.spacer} />
          </>
        ) : null}

        {state.kind === 'recording' ? (
          <>
            <Text style={styles.label}>recording</Text>
            <Text style={styles.title}>記録中</Text>
            <View style={styles.metrics}>
              <View style={styles.metric} testID="walk-elapsed">
                <Text style={styles.metricValue}>{formatElapsed(state.walk.startedAt, now)}</Text>
                <Text style={styles.metricLabel}>経過</Text>
              </View>
            </View>
            {state.walk.participants.map((participant) => (
              <View key={participant.walkParticipantId} style={styles.row}>
                <View>
                  <Text style={styles.rowName}>{participant.name}</Text>
                  <Text style={styles.rowMeta}>participant</Text>
                </View>
              </View>
            ))}
            {state.finishError ? (
              <Text style={styles.error} testID="walk-finish-error">
                終了に失敗しました。再試行してください。
              </Text>
            ) : null}
            <View style={styles.spacer} />
            <Pressable
              testID="walk-finish"
              accessible
              accessibilityRole="button"
              accessibilityLabel="終了する"
              style={styles.warn}
              onPress={onFinish}
            >
              <Text style={styles.primaryText} accessible={false}>
                終了する
              </Text>
            </Pressable>
          </>
        ) : null}

        {state.kind === 'completed' ? (
          <>
            <Text style={styles.label}>walk complete</Text>
            <Text style={styles.title} testID="walk-completed">
              散歩が完了しました
            </Text>
            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{formatDuration(state.walk.durationSeconds)}</Text>
                <Text style={styles.metricLabel}>時間</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>0 m</Text>
                <Text style={styles.metricLabel}>距離</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View>
                <Text style={styles.rowName}>Participants</Text>
                <Text style={styles.rowMeta}>
                  {state.walk.participants.map((participant) => participant.name).join(', ')}
                </Text>
              </View>
            </View>
            <View style={styles.spacer} />
            <Pressable
              testID="walk-back-ready"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Ready へ戻る"
              style={styles.primary}
              onPress={onBackToReady}
            >
              <Text style={styles.primaryText} accessible={false}>
                Ready へ戻る
              </Text>
            </Pressable>
          </>
        ) : null}

        {state.kind === 'failed' ? (
          <>
            <Text style={styles.label}>walk status</Text>
            <Text style={styles.title} testID="walk-failed">
              記録に失敗しました
            </Text>
            <Text style={styles.help}>この散歩は破棄されました。</Text>
            <View style={styles.spacer} />
            <Pressable
              testID="walk-back-ready"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Ready へ戻る"
              style={styles.primary}
              onPress={onBackToReady}
            >
              <Text style={styles.primaryText} accessible={false}>
                Ready へ戻る
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4EF',
  },
  containerMap: {
    backgroundColor: '#E7EFE4',
  },
  map: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  screen: {
    flex: 1,
    padding: 24,
    gap: 10,
  },
  label: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#6B645A',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1A16',
  },
  help: {
    fontSize: 16,
    color: '#6B645A',
  },
  busy: {
    color: '#6B645A',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 253, 248, 0.92)',
    borderRadius: 10,
  },
  error: {
    color: '#8A3B2C',
    fontSize: 14,
    backgroundColor: '#F8ECE8',
    borderRadius: 10,
    padding: 10,
  },
  listScroll: {
    flex: 1,
  },
  list: {
    gap: 10,
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 253, 248, 0.92)',
    borderWidth: 1,
    borderColor: '#D9D0C3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D9D0C3',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: '#2F5D50',
    borderColor: '#2F5D50',
  },
  checkMark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  rowName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1A16',
  },
  rowMeta: {
    fontSize: 13,
    color: '#6B645A',
  },
  spacer: {
    flex: 1,
  },
  metrics: {
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    flex: 1,
    backgroundColor: 'rgba(255, 253, 248, 0.92)',
    borderWidth: 1,
    borderColor: '#D9D0C3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1A16',
  },
  metricLabel: {
    color: '#6B645A',
    fontSize: 12,
  },
  primary: {
    backgroundColor: '#2F5D50',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    backgroundColor: '#ECE5DA',
  },
  disabledText: {
    color: '#6B645A',
  },
  warn: {
    backgroundColor: '#8A3B2C',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
})
