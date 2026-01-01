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
  if (!cleanedNumber) return [];

  const majorStations = ['8000105', '8000261', '8011160', '8000207', '8000152'];
  const matchingDepartures: { tripId: string; dep: any }[] = [];
  const seenTripIds = new Set<string>();

  // Sequentielle Anfragen um Rate Limiting zu vermeiden
  for (const stationId of majorStations) {
    try {
      const departures = await getDepartures(stationId);
      departures.forEach((dep: any) => {
        const lineName = dep.line?.name?.toUpperCase() || '';
        const fahrtNr = dep.line?.fahrtNr || '';
        const matches = lineName.includes(cleanedNumber) ||
          fahrtNr === cleanedNumber.replace(/\D/g, '') ||
          lineName.replace(/\s/g, '') === cleanedNumber.replace(/\s/g, '');

        if (matches && !seenTripIds.has(dep.tripId)) {
          seenTripIds.add(dep.tripId);
          matchingDepartures.push({ tripId: dep.tripId, dep });
        }
      });

      // Wenn wir genug Ergebnisse haben, brechen wir ab
      if (matchingDepartures.length >= 5) break;
    } catch (e) {
      console.warn(`Station ${stationId} failed:`, e);
      // Kurze Pause bei Fehler
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Limitiere und hole Trip-Details sequentiell
  const limitedDepartures = matchingDepartures.slice(0, 10);
  const results: TrainJourney[] = [];

  for (const { tripId } of limitedDepartures) {
    try {
      const tripDetails = await getTripDetails(tripId);
      if (tripDetails?.stopovers) {
        const journey = convertToTrainJourney(tripDetails);
        if (journey) results.push(journey);
      }
    } catch (e) {
      console.warn(`Trip ${tripId} failed:`, e);
    }

    // Stoppe wenn wir genug haben
    if (results.length >= 5) break;
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
