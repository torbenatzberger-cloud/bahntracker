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

// Client-Side Cache für Search-Ergebnisse
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const searchCache = new Map<string, CacheEntry<TrainJourney[]>>();
const SEARCH_CACHE_TTL = 3 * 60 * 1000; // 3 Minuten

function getCachedSearch(key: string): TrainJourney[] | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > SEARCH_CACHE_TTL) {
    searchCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedSearch(key: string, data: TrainJourney[]): void {
  // Alte Einträge aufräumen
  if (searchCache.size > 20) {
    const now = Date.now();
    for (const [k, v] of searchCache.entries()) {
      if (now - v.timestamp > SEARCH_CACHE_TTL) {
        searchCache.delete(k);
      }
    }
  }
  searchCache.set(key, { data, timestamp: Date.now() });
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
    duration: '120', // 2 Stunden - weniger Last auf API
    results: '30',   // Weniger Ergebnisse - schnellere Response
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

  // Mehr Retries mit längeren Pausen bei 503
  const response = await fetchWithRetry(url, 4, 1000);
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

  // Client-Cache prüfen
  const cached = getCachedSearch(cleanedNumber);
  if (cached) {
    console.log('Using cached search results for:', cleanedNumber);
    return cached;
  }

  // Extrahiere Zugnummer für flexibles Matching
  const searchNum = cleanedNumber.replace(/\D/g, ''); // Nur Ziffern: "579"
  const searchFull = cleanedNumber.replace(/\s/g, ''); // Ohne Leerzeichen: "ICE579"

  // 7 große Knotenbahnhöfe für bessere Abdeckung
  const majorStations = [
    '8000105', // Frankfurt Hbf
    '8000261', // München Hbf
    '8011160', // Berlin Hbf
    '8000207', // Köln Hbf
    '8002549', // Hamburg Hbf
    '8000096', // Stuttgart Hbf
    '8000152', // Hannover Hbf
  ];

  const matchingDepartures: { tripId: string; dep: any }[] = [];
  const seenTripIds = new Set<string>();

  // Sequentielle Anfragen mit Pausen um Rate Limiting zu vermeiden
  for (let i = 0; i < majorStations.length; i++) {
    const stationId = majorStations[i];
    try {
      // Pause vor jeder Anfrage (außer der ersten)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const departures = await getDepartures(stationId);
      departures.forEach((dep: any) => {
        const lineName = (dep.line?.name || '').toUpperCase();
        const fahrtNr = String(dep.line?.fahrtNr || '');
        const lineNameNoSpace = lineName.replace(/\s/g, '');

        // Flexibles Matching:
        // 1. Exakte Zugnummer: fahrtNr === "579"
        // 2. Zugnummer in Name: "ICE 579" enthält "579"
        // 3. Vollständiger Name: "ICE579" enthält "ICE579"
        const matches =
          (searchNum && fahrtNr === searchNum) ||
          (searchNum && lineName.includes(searchNum)) ||
          (searchFull && lineNameNoSpace.includes(searchFull));

        if (matches && dep.tripId && !seenTripIds.has(dep.tripId)) {
          seenTripIds.add(dep.tripId);
          matchingDepartures.push({ tripId: dep.tripId, dep });
        }
      });

      // Wenn wir genug Ergebnisse haben, brechen wir ab
      if (matchingDepartures.length >= 5) break;
    } catch (e) {
      console.warn(`Station ${stationId} failed:`, e);
      // Bei Fehler längere Pause, dann weitermachen
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Limitiere und hole Trip-Details sequentiell
  const limitedDepartures = matchingDepartures.slice(0, 8);
  const results: TrainJourney[] = [];

  for (const { tripId } of limitedDepartures) {
    try {
      const tripDetails = await getTripDetails(tripId);
      if (tripDetails?.stopovers) {
        const journey = convertToTrainJourney(tripDetails);
        if (journey) results.push(journey);
      }

      // Stoppe wenn wir genug haben
      if (results.length >= 5) break;

      // Kleine Pause zwischen Anfragen
      await new Promise(resolve => setTimeout(resolve, 30));
    } catch (e) {
      console.warn(`Trip ${tripId} failed:`, e);
    }
  }

  // Ergebnisse cachen
  if (results.length > 0) {
    setCachedSearch(cleanedNumber, results);
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
