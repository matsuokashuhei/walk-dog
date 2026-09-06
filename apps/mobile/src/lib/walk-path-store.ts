import * as FileSystem from 'expo-file-system/legacy'
import type { LocalWalkEvent } from './walk-event-schema.ts'
import type { LocalTrackPoint } from './walk-track-point-schema.ts'

type PathFile = Record<string, LocalTrackPoint[]>

function documentUri(name: string): string {
  const root = FileSystem.documentDirectory
  if (root === null) {
    throw new Error('documentDirectory is required')
  }
  return `${root}${name}`
}

function pathUri() {
  return documentUri('walk-path.json')
}

function queueUri() {
  return documentUri('walk-outbound-queue.json')
}

function eventQueueUri() {
  return documentUri('walk-event-outbound-queue.json')
}

function recordingUri() {
  return documentUri('walk-recording.json')
}

async function readJson<T>(uri: string, fallback: T): Promise<T> {
  const info = await FileSystem.getInfoAsync(uri)
  if (!info.exists) {
    return fallback
  }
  const text = await FileSystem.readAsStringAsync(uri)
  return JSON.parse(text) as T
}

async function writeJson(uri: string, value: unknown): Promise<void> {
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(value))
}

function sortByRecordedAt(points: LocalTrackPoint[]): LocalTrackPoint[] {
  return [...points].sort((left, right) => left.recordedAt.localeCompare(right.recordedAt))
}

export async function loadPathForWalk(walkId: string): Promise<LocalTrackPoint[]> {
  const all = await readJson<PathFile>(pathUri(), {})
  return sortByRecordedAt(all[walkId] ?? [])
}

export async function savePathForWalk(walkId: string, points: LocalTrackPoint[]): Promise<void> {
  const all = await readJson<PathFile>(pathUri(), {})
  all[walkId] = sortByRecordedAt(points)
  await writeJson(pathUri(), all)
}

export async function loadOutboundQueue(): Promise<LocalTrackPoint[]> {
  return readJson<LocalTrackPoint[]>(queueUri(), [])
}

export async function saveOutboundQueue(points: LocalTrackPoint[]): Promise<void> {
  await writeJson(queueUri(), points)
}

export function createFileTrackPointStorage(walkId: string) {
  return {
    loadPath: () => loadPathForWalk(walkId),
    savePath: (points: LocalTrackPoint[]) => savePathForWalk(walkId, points),
    loadQueue: async () => {
      const all = await loadOutboundQueue()
      return all.filter((point) => point.walkId === walkId)
    },
    saveQueue: async (points: LocalTrackPoint[]) => {
      const all = await loadOutboundQueue()
      const others = all.filter((point) => point.walkId !== walkId)
      await saveOutboundQueue([...others, ...points])
    },
  }
}

export async function loadEventOutboundQueue(): Promise<LocalWalkEvent[]> {
  return readJson<LocalWalkEvent[]>(eventQueueUri(), [])
}

export async function saveEventOutboundQueue(events: LocalWalkEvent[]): Promise<void> {
  await writeJson(eventQueueUri(), events)
}

export function createFileEventStorage(walkId: string) {
  return {
    loadQueue: async () => {
      const all = await loadEventOutboundQueue()
      return all.filter((event) => event.walkId === walkId)
    },
    saveQueue: async (events: LocalWalkEvent[]) => {
      const all = await loadEventOutboundQueue()
      const others = all.filter((event) => event.walkId !== walkId)
      await saveEventOutboundQueue([...others, ...events])
    },
  }
}

export async function loadRecordingWalkId(): Promise<string | null> {
  const stored = await readJson<{ walkId: string } | null>(recordingUri(), null)
  return stored?.walkId ?? null
}

export async function saveRecordingWalkId(walkId: string): Promise<void> {
  await writeJson(recordingUri(), { walkId })
}

export async function clearRecordingWalkId(): Promise<void> {
  const info = await FileSystem.getInfoAsync(recordingUri())
  if (!info.exists) {
    return
  }
  await FileSystem.deleteAsync(recordingUri())
}
