export type RecordingVerifyDecision =
  | { action: 'keep' }
  | { action: 'fail_walk' }
  | { action: 'mark_failed' }

export function decideRecordingVerify(input: {
  locationGranted: boolean
  activeWalk: { walkId: string } | null
}): RecordingVerifyDecision {
  if (!input.locationGranted) {
    return { action: 'fail_walk' }
  }
  if (input.activeWalk === null) {
    return { action: 'mark_failed' }
  }
  return { action: 'keep' }
}

export function decideWalkLoad<T extends { walkId: string }>(
  activeWalk: T | null,
): { kind: 'recording'; walk: T } | { kind: 'ready' } {
  if (activeWalk !== null) {
    return { kind: 'recording', walk: activeWalk }
  }
  return { kind: 'ready' }
}
