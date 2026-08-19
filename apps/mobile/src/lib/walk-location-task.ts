import * as Location from 'expo-location'
import * as SecureStore from 'expo-secure-store'
import * as TaskManager from 'expo-task-manager'
import { AppState, type NativeEventSubscription } from 'react-native'
import { ApiError } from './api'
import { ACCESS_TOKEN_KEY } from './auth'
import { postTrackPoint, type LocalTrackPoint } from './walk-api'
import {
  createFileTrackPointStorage,
  clearRecordingWalkId,
  loadPathForWalk,
  loadRecordingWalkId,
  savePendingFailWalkId,
  saveRecordingWalkId,
} from './walk-path-store'
import { SAMPLE_INTERVAL_MS, createTrackPointCoordinator } from './walk-track-point-queue'

export const WALK_TRACK_POINT_TASK = 'WALK_TRACK_POINT'

type LocationTaskData = {
  locations: Location.LocationObject[]
}

type TrackPointEvents = {
  onPathChange: (points: LocalTrackPoint[]) => void
  onUnauthenticated: () => void
}

let events: TrackPointEvents | null = null
let coordinator: ReturnType<typeof createTrackPointCoordinator> | null = null
let coordinatorWalkId: string | null = null
let sampleTimer: ReturnType<typeof setInterval> | null = null
let appStateSub: NativeEventSubscription | null = null

export function setTrackPointEvents(next: TrackPointEvents | null) {
  events = next
}

function resetTrackPointCoordinator() {
  coordinator = null
  coordinatorWalkId = null
}

function stopSampleTimer() {
  if (sampleTimer === null) {
    return
  }
  clearInterval(sampleTimer)
  sampleTimer = null
}

async function postPoint(accessToken: string, point: LocalTrackPoint) {
  try {
    await postTrackPoint(accessToken, point)
    return { ok: true as const }
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false as const, status: error.status, retryable: error.retryable }
    }
    return { ok: false as const, status: 0, retryable: true }
  }
}

async function coordinatorFor(walkId: string, accessToken: string) {
  if (coordinator !== null && coordinatorWalkId === walkId) {
    return coordinator
  }
  coordinator = createTrackPointCoordinator({
    ...createFileTrackPointStorage(walkId),
    post: (point) => postPoint(accessToken, point),
    now: () => Date.now(),
  })
  coordinatorWalkId = walkId
  return coordinator
}

async function handleUnauthenticated(walkId: string) {
  await savePendingFailWalkId(walkId)
  events?.onUnauthenticated()
  await stopTrackPointUpdates()
}

async function withRecordingStore(
  run: (
    walkId: string,
    store: ReturnType<typeof createTrackPointCoordinator>,
  ) => Promise<'ok' | 'retry' | 'drop' | 'unauthenticated'>,
) {
  const walkId = await loadRecordingWalkId()
  if (walkId === null) {
    return
  }
  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
  if (accessToken === null) {
    return
  }
  const store = await coordinatorFor(walkId, accessToken)
  const action = await run(walkId, store)
  events?.onPathChange(await loadPathForWalk(walkId))
  if (action === 'unauthenticated') {
    await handleUnauthenticated(walkId)
  }
}

async function flushPending() {
  await withRecordingStore(async (_walkId, store) => store.flush())
}

async function recordLocation(location: Location.LocationObject) {
  await withRecordingStore(async (walkId, store) =>
    store.record({
      walkId,
      recordedAt: new Date(Date.now()).toISOString(),
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    }),
  )
}

async function sampleForegroundTick() {
  const walkId = await loadRecordingWalkId()
  if (walkId === null) {
    return
  }
  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    })
    await recordLocation(position)
  } catch {
    await flushPending()
  }
}

function startSampleTimer() {
  stopSampleTimer()
  void sampleForegroundTick()
  sampleTimer = setInterval(() => {
    void sampleForegroundTick()
  }, SAMPLE_INTERVAL_MS)
}

function startAppStateListener() {
  if (appStateSub !== null) {
    return
  }
  appStateSub = AppState.addEventListener('change', (next) => {
    if (next === 'active') {
      startSampleTimer()
      return
    }
    stopSampleTimer()
  })
}

function stopAppStateListener() {
  appStateSub?.remove()
  appStateSub = null
}

export async function startTrackPointUpdates(walkId: string) {
  resetTrackPointCoordinator()
  await saveRecordingWalkId(walkId)
  startAppStateListener()
  if (AppState.currentState === 'active') {
    startSampleTimer()
  }
  const started = await Location.hasStartedLocationUpdatesAsync(WALK_TRACK_POINT_TASK)
  if (started) {
    return
  }
  await Location.startLocationUpdatesAsync(WALK_TRACK_POINT_TASK, {
    timeInterval: SAMPLE_INTERVAL_MS,
    distanceInterval: 0,
    accuracy: Location.Accuracy.Balanced,
    pausesUpdatesAutomatically: false,
  })
}

export async function stopTrackPointUpdates() {
  stopAppStateListener()
  stopSampleTimer()
  const started = await Location.hasStartedLocationUpdatesAsync(WALK_TRACK_POINT_TASK)
  if (started) {
    await Location.stopLocationUpdatesAsync(WALK_TRACK_POINT_TASK)
  }
  resetTrackPointCoordinator()
  await clearRecordingWalkId()
}

async function handleLocations(locations: Location.LocationObject[]) {
  await flushPending()
  const latest = locations.at(-1)
  if (latest === undefined) {
    return
  }
  await recordLocation(latest)
}

TaskManager.defineTask(WALK_TRACK_POINT_TASK, async ({ data, error }) => {
  if (error) {
    return
  }
  const { locations } = data as LocationTaskData
  await handleLocations(locations)
})
