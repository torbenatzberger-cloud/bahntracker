import { TrainJourney, TrainStop } from '../types';
import { Platform } from 'react-native';

function isWebEnvironment(): boolean {
  if (Platform.OS === 'web') return true;
  if (typeof window !== 'undefined' && typeof document !== 'undefined') return true;
  return false;
}

function buildUrl(endpoint: string, params: Record<string, string> = {}): string {
  const isWeb = isWebEnvironment();

  if (isWeb && typeof window !== 'undefined') {
    const url = new URL('/api/transport', window.location.origin);
    url.searchParams.set('endpoint', endpoint);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  } else {
    const url = new URL(endpoint, 'https://v6.db.transport.rest');
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  }
}

// Retry-Mechanismus mit exponential backoff
async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;

      // Bei 503 oder 500 (Server-Fehler) warten und erneut versuchen
      if ((response.status === 503 || response.status === 500) && i < retries - 1) {
        console.log(`API returned ${response.status}, retrying in ${delay * (i + 1)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        continue;
      }

      throw new Error(`API error: ${response.status}`);
    } catch (e) {
      if (i === retries - 1) throw e;
      console.log(`Fetch failed, retrying in ${delay * (i + 1)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
}

export async function getDepartures(stationId: string): Promise<any[]> {
  const url = buildUrl(`/stops/${stationId}/departures`, {
    duration: '120',
    results: '50',
    nationalExpress: 'true',
    national: 'true',
    regionalExpress: 'true',
    regional: 'true',
    suburban: 'false',
    bus: 'false',
    ferry: 'false',
    subway: 'false',
    tram: 'false',
    taxi: 'false',
  });

  const response = await fetchWithRetry(url, 2, 500);
  const data = await response.json();
  return data.departures || data;
}

export async function getTripDetails(tripId: string): Promise<any> {
  const url = buildUrl(`/trips/${encodeURIComponent(tripId)}`, {
    stopovers: 'true',
  });

  try {
    const response = await fetchWithRetry(url, 2, 500);
    const data = await response.json();
    return data.trip || data;
  } catch {
    return null;
  }
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
      // Kleine Pause zwischen Stationsanfragen
      if (matchingDepartures.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

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
      // Längere Pause bei Fehler
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Limitiere und hole Trip-Details sequentiell
  const limitedDepartures = matchingDepartures.slice(0, 10);
  const results: TrainJourney[] = [];

  for (const { tripId } of limitedDepartures) {
    try {
      // Kleine Pause zwischen Trip-Details-Anfragen
      if (results.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

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
  const url = buildUrl('/stops/nearby', {
    latitude: String(lat),
    longitude: String(lon),
    results: '5',
    distance: '2000',
  });

  const response = await fetch(url);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}
