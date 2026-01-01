import { TrainJourney, TrainStop } from '../types';

const API_BASE = 'https://v6.db.transport.rest';

export async function getDepartures(stationId: string): Promise<any[]> {
  const response = await fetch(
    `${API_BASE}/stops/${stationId}/departures?duration=120&results=50&nationalExpress=true&national=true&regionalExpress=true&regional=true&suburban=false&bus=false&ferry=false&subway=false&tram=false&taxi=false`
  );
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return data.departures || data;
}

export async function getTripDetails(tripId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/trips/${encodeURIComponent(tripId)}?stopovers=true`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.trip || data;
}

export async function searchTrainByNumber(trainNumber: string): Promise<TrainJourney[]> {
  const cleanedNumber = trainNumber.trim().toUpperCase();
  const majorStations = ['8000105', '8000261', '8011160', '8000207', '8000152'];
  const results: TrainJourney[] = [];

  for (const stationId of majorStations) {
    try {
      const departures = await getDepartures(stationId);
      const matching = departures.filter((dep: any) => {
        const lineName = dep.line?.name?.toUpperCase() || '';
        const fahrtNr = dep.line?.fahrtNr || '';
        return lineName.includes(cleanedNumber) || fahrtNr === cleanedNumber.replace(/\D/g, '') || lineName.replace(/\s/g, '') === cleanedNumber.replace(/\s/g, '');
      });

      for (const dep of matching) {
        if (results.some(r => r.tripId === dep.tripId)) continue;
        const tripDetails = await getTripDetails(dep.tripId);
        if (tripDetails?.stopovers) {
          const journey = convertToTrainJourney(tripDetails);
          if (journey) results.push(journey);
        }
      }
      if (results.length > 0) break;
    } catch (e) { console.warn(`Station ${stationId} failed:`, e); }
  }
  return results;
}

function convertToTrainJourney(trip: any): TrainJourney | null {
  if (!trip.stopovers?.length) return null;
  const stops: TrainStop[] = trip.stopovers.map((s: any) => ({
    station: { id: s.stop.id, name: s.stop.name, location: s.stop.location },
    arrival: s.arrival, plannedArrival: s.plannedArrival,
    departure: s.departure, plannedDeparture: s.plannedDeparture,
    arrivalDelay: s.arrivalDelay, departureDelay: s.departureDelay,
    platform: s.platform, plannedPlatform: s.plannedPlatform,
  }));
  const lineName = trip.line?.name || '';
  const trainType = lineName.split(' ')[0] || trip.line?.product || 'Zug';
  return { tripId: trip.id, trainNumber: lineName.split(' ').slice(1).join(' '), trainType, trainName: lineName, direction: trip.direction, stops, origin: stops[0], destination: stops[stops.length - 1] };
}

export async function getNearbyStations(lat: number, lon: number): Promise<any[]> {
  const response = await fetch(`${API_BASE}/stops/nearby?latitude=${lat}&longitude=${lon}&results=5&distance=2000`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}
