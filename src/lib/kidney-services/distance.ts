const EARTH_RADIUS_MILES = 3958.7613;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function calculateDistanceMiles(
  originLatitude: number,
  originLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
): number {
  const latDelta = toRadians(destinationLatitude - originLatitude);
  const lonDelta = toRadians(destinationLongitude - originLongitude);
  const originLatRad = toRadians(originLatitude);
  const destinationLatRad = toRadians(destinationLatitude);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(originLatRad) * Math.cos(destinationLatRad) * Math.sin(lonDelta / 2) ** 2;
  const centralAngle = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * centralAngle;
}
