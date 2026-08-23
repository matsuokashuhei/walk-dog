export type LocationPermissionAction = 'granted' | 'request' | 'settings'

export function getLocationPermissionAction(
  foregroundStatus: string,
  backgroundStatus: string,
): LocationPermissionAction {
  if (foregroundStatus === 'granted' && backgroundStatus === 'granted') {
    return 'granted'
  }
  if (foregroundStatus === 'denied' || backgroundStatus === 'denied') {
    return 'settings'
  }
  return 'request'
}

export function handleWalkAppStateChange(
  appState: string,
  walkState: string,
  actions: { loadReady: () => void; verifyRecording: () => void },
): void {
  if (appState !== 'active') {
    return
  }
  if (walkState === 'recording') {
    actions.verifyRecording()
    return
  }
  if (walkState === 'ready') {
    actions.loadReady()
  }
}
