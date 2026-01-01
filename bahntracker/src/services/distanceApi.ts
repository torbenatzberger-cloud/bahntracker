interface Coordinate { latitude: number; longitude: number; }

export async function calculateRailDistance(origin: Coordinate, destination: Coordinate): Promise<number> {
  try {
    const waypoints = `${origin.longitude},${origin.latitude}|${destination.longitude},${destination.latitude}`;
    const response = await fetch(`https://brouter.de/brouter?lonlats=${waypoints}&profile=rail&alternativeidx=0&format=geojson`);
    if (!response.ok) throw new Error('BRouter failed');
    const data = await response.json();
    const meters = data.features?.[0]?.properties?.['track-length'];
    if (meters) return Math.round(meters / 1000);
    return calculateHaversine(origin, destination);
  } catch { return calculateHaversine(origin, destination); }
}

function calculateHaversine(o: Coordinate, d: Coordinate): number {
  const R = 6371;
  const dLat = (d.latitude - o.latitude) * Math.PI / 180;
  const dLon = (d.longitude - o.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(o.latitude*Math.PI/180) * Math.cos(d.latitude*Math.PI/180) * Math.sin(dLon/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 1.3);
}

export function calculateDuration(departure: string, arrival: string): number {
  return Math.round((new Date(arrival).getTime() - new Date(departure).getTime()) / 60000);
}
