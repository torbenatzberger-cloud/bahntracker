import { TrainJourney, TrainStop } from '../types';
import { Platform } from 'react-native';

function isWebEnvironment(): boolean {
  if (Platform.OS === 'web') return true;
  if (typeof window !== 'undefined' && typeof document !== 'undefined') return true;
  return false;
}

function getApiBaseUrl(): string {
  if (isWebEnvironment() && typeof window !== 'undefined') {
    return `${window.location.origin}/api/transport`;
  }
  // Für Native Apps: direkt auf Vercel API zeigen
  return 'https://bahntracker.vercel.app/api/transport';
}

// Client-Side Cache für Search-Ergebnisse
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const searchCache = new Map<string, CacheEntry<TrainJourney[]>>();
const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 Minuten

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

// Retry-Mechanismus
async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;

      if ((response.status === 503 || response.status === 500 || response.status === 429) && i < retries - 1) {
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
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}?action=departures&stationId=${encodeURIComponent(stationId)}`;
  console.log('Fetching departures from:', url);

  const response = await fetchWithRetry(url, 3, 1000);
  const data = await response.json();
  console.log('Got departures:', data.departures?.length || 0);
  return data.departures || [];
}

export async function getTripDetails(tripId: string): Promise<any> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}?action=trip&tripId=${encodeURIComponent(tripId)}`;

  try {
    const response = await fetchWithRetry(url, 2, 500);
    const data = await response.json();
    return data.trip || null;
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

  // Große Knotenbahnhöfe für maximale Abdeckung
  const majorStations = [
    '8000105', // Frankfurt Hbf
    '8000261', // München Hbf
    '8011160', // Berlin Hbf
    '8000152', // Hannover Hbf
    '8000207', // Köln Hbf
    '8000096', // Stuttgart Hbf
    '8000284', // Nürnberg Hbf
    '8010224', // Leipzig Hbf
    '8000191', // Karlsruhe Hbf
    '8000050', // Bremen Hbf
  ];

  const matchingDepartures: { tripId: string; dep: any }[] = [];
  const seenTripIds = new Set<string>();

  // Alle Bahnhöfe parallel abfragen für Geschwindigkeit
  console.log(`Searching for: searchNum="${searchNum}", searchFull="${searchFull}"`);

  const allDepartures = await Promise.all(
    majorStations.map(async (stationId) => {
      try {
        return await getDepartures(stationId);
      } catch (e) {
        console.warn(`Station ${stationId} failed:`, e);
        return [];
      }
    })
  );

  // Durch alle Ergebnisse suchen
  for (const departures of allDepartures) {
    for (const dep of departures) {
      const lineName = (dep.line?.name || '').toUpperCase();
      const fahrtNr = String(dep.line?.fahrtNr || '');
      const lineNameNoSpace = lineName.replace(/\s/g, '');

      // Exaktes Matching für Zugnummer
      // "513" soll "ICE 513" matchen, aber NICHT "ICE 1513"
      const lineNameParts = lineName.split(/\s+/);
      const trainNumberInName = lineNameParts[lineNameParts.length - 1]; // Letzte Zahl im Namen

      const matches =
        // Exakter Match der fahrtNr
        (searchNum && fahrtNr === searchNum) ||
        // Exakter Match der Zugnummer im Namen (z.B. "513" in "ICE 513")
        (searchNum && trainNumberInName === searchNum) ||
        // Voller Name Match (z.B. "ICE513" oder "ICE 513")
        (searchFull && lineNameNoSpace === searchFull.toUpperCase());

      if (matches && dep.tripId && !seenTripIds.has(dep.tripId)) {
        console.log(`Found match: ${lineName} (fahrtNr: ${fahrtNr})`);
        seenTripIds.add(dep.tripId);
        matchingDepartures.push({ tripId: dep.tripId, dep });
      }
    }

    // Bei erstem Fund abbrechen
    if (matchingDepartures.length >= 1) break;
  }

  // Hole Trip-Details
  const limitedDepartures = matchingDepartures.slice(0, 3);
  const results: TrainJourney[] = [];

  for (const { tripId } of limitedDepartures) {
    try {
      const tripDetails = await getTripDetails(tripId);
      if (tripDetails?.stopovers) {
        const journey = convertToTrainJourney(tripDetails);
        if (journey) results.push(journey);
      }

      if (results.length >= 1) break;
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
    station: { id: s.stop?.id, name: s.stop?.name, location: s.stop?.location },
    arrival: s.arrival,
    plannedArrival: s.plannedArrival,
    departure: s.departure,
    plannedDeparture: s.plannedDeparture,
    arrivalDelay: s.arrivalDelay,
    departureDelay: s.departureDelay,
    platform: s.platform,
    plannedPlatform: s.plannedPlatform,
  }));

  const lineName = trip.line?.name || '';
  const trainType = lineName.split(' ')[0] || trip.line?.product || 'Zug';

  return {
    tripId: trip.id,
    trainNumber: lineName.split(' ').slice(1).join(' '),
    trainType,
    trainName: lineName,
    direction: trip.direction,
    stops,
    origin: stops[0],
    destination: stops[stops.length - 1],
  };
}

export async function getNearbyStations(lat: number, lon: number): Promise<any[]> {
  // Diese Funktion wird vorerst nicht unterstützt mit db-vendo-client
  // TODO: Implementieren wenn nötig
  console.warn('getNearbyStations not yet implemented with new API');
  return [];
}
