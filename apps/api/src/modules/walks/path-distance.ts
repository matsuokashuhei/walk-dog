const EARTH_RADIUS_METERS = 6_371_000

function haversineMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const deltaLatitude = toRadians(latitude2 - latitude1)
  const deltaLongitude = toRadians(longitude2 - longitude1)
  const chord =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(deltaLongitude / 2) ** 2
  const centralAngle = 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord))
  return EARTH_RADIUS_METERS * centralAngle
}

export function pathDistanceMeters(
  points: ReadonlyArray<{ latitude: number; longitude: number }>,
): number {
  if (points.length < 2) {
    return 0
  }

  let totalMeters = 0
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    totalMeters += haversineMeters(
      previous.latitude,
      previous.longitude,
      current.latitude,
      current.longitude,
    )
  }

  return Math.round(totalMeters)
}

export function paceSecondsPerMeter(
  durationSeconds: number,
  distanceMeters: number,
): number | null {
  if (distanceMeters <= 0) {
    return null
  }

  return durationSeconds / distanceMeters
}
