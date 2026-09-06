import { AppleMaps } from 'expo-maps'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import {
  getWalkDetail,
  type WalkDetailResponse,
  type WalkEventType,
} from '@/lib/walk-api'
import { formatDistanceMeters, formatPacePerKm } from '@/lib/walk-metrics-format'

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'ready'; walk: WalkDetailResponse }
  | { kind: 'not_found' }
  | { kind: 'error' }

const EVENT_LABELS: Record<WalkEventType, string> = {
  pee: 'Pee',
  poop: 'Poop',
  sniff: 'Sniff',
  greet: 'Greet',
}

function formatDuration(durationSeconds: number): string {
  const minutes = Math.floor(durationSeconds / 60)
  return `${minutes}分`
}

function formatEventElapsed(startedAt: string, occurredAt: string): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.parse(occurredAt) - Date.parse(startedAt)) / 1000))
  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function WalkDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { walkId } = useLocalSearchParams<{ walkId: string }>()
  const { session } = useAuth()
  const [state, setState] = useState<ScreenState>({ kind: 'loading' })

  const load = useCallback(() => {
    if (!session) {
      throw new Error('WalkDetail requires an authenticated session')
    }
    setState({ kind: 'loading' })
    void getWalkDetail(session.accessToken, walkId)
      .then((walk) => {
        setState({ kind: 'ready', walk })
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 404) {
          setState({ kind: 'not_found' })
          return
        }
        setState({ kind: 'error' })
      })
  }, [session, walkId])

  useEffect(() => {
    load()
  }, [load])

  const goBack = () => {
    router.back()
  }

  const showMap =
    Platform.OS === 'ios' && state.kind === 'ready' && state.walk.trackPoints.length > 0
  const pathCoordinates =
    state.kind === 'ready'
      ? state.walk.trackPoints.map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
        }))
      : []
  const mapCameraPosition =
    pathCoordinates.length > 0
      ? {
          coordinates: pathCoordinates[Math.floor(pathCoordinates.length / 2)]!,
          zoom: 14,
        }
      : undefined

  return (
    <View
      style={[styles.container, showMap ? styles.containerMap : null]}
      testID="walk-detail"
    >
      {showMap ? (
        <AppleMaps.View
          style={styles.map}
          properties={{
            isMyLocationEnabled: false,
            selectionEnabled: false,
            pointsOfInterest: { including: [] },
          }}
          cameraPosition={mapCameraPosition}
          polylines={
            pathCoordinates.length >= 2
              ? [
                  {
                    id: 'walk-detail-path',
                    coordinates: pathCoordinates,
                  },
                ]
              : []
          }
        />
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.screen, { paddingBottom: 24 + insets.bottom }]}
        style={styles.scroll}
      >
        <Text style={styles.label}>walk detail</Text>

        {state.kind === 'loading' ? (
          <Text style={styles.busy} testID="walk-detail-loading">
            読み込み中…
          </Text>
        ) : null}

        {state.kind === 'error' ? (
          <>
            <Text style={styles.error} testID="walk-detail-error">
              読み込めませんでした。再試行してください。
            </Text>
            <Pressable
              testID="walk-detail-retry"
              accessible
              accessibilityRole="button"
              accessibilityLabel="再試行"
              style={styles.primary}
              onPress={load}
            >
              <Text style={styles.primaryText} accessible={false}>
                再試行
              </Text>
            </Pressable>
          </>
        ) : null}

        {state.kind === 'not_found' ? (
          <Text style={styles.error} testID="walk-detail-not-found">
            Walk が見つかりませんでした。
          </Text>
        ) : null}

        {state.kind === 'ready' ? (
          <>
            <Text style={styles.title}>Completed walk</Text>
            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{formatDuration(state.walk.durationSeconds)}</Text>
                <Text style={styles.metricLabel}>時間</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>
                  {formatDistanceMeters(state.walk.distanceMeters).value}
                </Text>
                <Text style={styles.metricLabel}>
                  {formatDistanceMeters(state.walk.distanceMeters).unit}
                </Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>
                  {formatPacePerKm(state.walk.paceSecondsPerMeter)}
                </Text>
                <Text style={styles.metricLabel}>pace</Text>
              </View>
            </View>
            <Text style={styles.participants}>
              {state.walk.participants.map((participant) => participant.name).join(', ')}
            </Text>

            <View style={styles.eventsCard}>
              <Text style={styles.eventsHeading}>Events</Text>
              {state.walk.events.length === 0 ? (
                <Text style={styles.empty} testID="walk-detail-events-empty">
                  記録された Event はありません
                </Text>
              ) : (
                state.walk.events.map((event) => {
                  const name =
                    state.walk.participants.find(
                      (participant) => participant.dogId === event.participantDogId,
                    )?.name ?? event.participantDogId
                  return (
                    <View key={event.eventId} style={styles.eventItem} testID={`walk-detail-event-${event.eventId}`}>
                      <Text style={styles.eventLabel}>
                        {name} · {EVENT_LABELS[event.type]}
                      </Text>
                      <Text style={styles.eventTime}>
                        {formatEventElapsed(state.walk.startedAt, event.occurredAt)}
                      </Text>
                    </View>
                  )
                })
              )}
            </View>
          </>
        ) : null}

        <View style={styles.spacer} />
        <Pressable
          testID="walk-detail-back"
          accessible
          accessibilityRole="button"
          accessibilityLabel="戻る"
          style={styles.secondary}
          onPress={goBack}
        >
          <Text style={styles.secondaryText} accessible={false}>
            戻る
          </Text>
        </Pressable>
      </ScrollView>
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
  scroll: {
    flex: 1,
  },
  screen: {
    flexGrow: 1,
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
  participants: {
    fontSize: 14,
    color: '#6B645A',
    backgroundColor: 'rgba(255, 253, 248, 0.92)',
    borderWidth: 1,
    borderColor: '#D9D0C3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  eventsCard: {
    backgroundColor: 'rgba(255, 253, 248, 0.92)',
    borderWidth: 1,
    borderColor: '#D9D0C3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  eventsHeading: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#6B645A',
    fontWeight: '700',
    marginBottom: 4,
  },
  empty: {
    color: '#6B645A',
    fontSize: 14,
  },
  eventItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#D9D0C3',
  },
  eventLabel: {
    fontSize: 14,
    color: '#1C1A16',
  },
  eventTime: {
    fontSize: 14,
    color: '#6B645A',
  },
  spacer: {
    flex: 1,
    minHeight: 12,
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
  secondary: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2F5D50',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#2F5D50',
    fontSize: 16,
    fontWeight: '600',
  },
})
