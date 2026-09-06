export type FormattedDistance = {
  value: string
  unit: 'm' | 'km'
}

export function formatDistanceMeters(meters: number): FormattedDistance {
  if (meters >= 1000) {
    return { value: (meters / 1000).toFixed(2), unit: 'km' }
  }
  return { value: String(meters), unit: 'm' }
}

export function formatPacePerKm(paceSecondsPerMeter: number | null): string {
  if (paceSecondsPerMeter === null) {
    return '—'
  }
  const secondsPerKm = Math.round(paceSecondsPerMeter * 1000)
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = secondsPerKm % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
