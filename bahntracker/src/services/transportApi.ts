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

// Suche über Bahnhofs-Abfahrten (schnell, aber nur für zukünftige Abfahrten)
async function searchViaStations(trainNumber: string): Promise<TrainJourney[]> {
  const searchNum = trainNumber.replace(/\D/g, '');
  const searchFull = trainNumber.replace(/\s/g, '').toUpperCase();

  // 20 Große Knotenbahnhöfe für maximale Abdeckung
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
    '8000149', // Hamburg Hbf
    '8000085', // Düsseldorf Hbf
    '8010101', // Halle (Saale) Hbf
    '8000128', // Göttingen
    '8000244', // Mannheim Hbf
    '8000080', // Dortmund Hbf
    '8000098', // Essen Hbf
    '8003200', // Kassel-Wilhelmshöhe
    '8000263', // Münster Hbf
    '8000294', // Osnabrück Hbf
  ];

  const matchingDepartures: { tripId: string; dep: any }[] = [];
  const seenTripIds = new Set<string>();

  console.log(`[Stations] Searching for: searchNum="${searchNum}", searchFull="${searchFull}"`);

  const allDepartures = await Promise.all(
    majorStations.map(async (stationId) => {
      try {
        return await getDepartures(stationId);
      } catch (e) {
        return [];
      }
    })
  );

  for (const departures of allDepartures) {
    for (const dep of departures) {
      const lineName = (dep.line?.name || '').toUpperCase();
      const fahrtNr = String(dep.line?.fahrtNr || '');
      const lineNameNoSpace = lineName.replace(/\s/g, '');
      const lineNameParts = lineName.split(/\s+/);
      const trainNumberInName = lineNameParts[lineNameParts.length - 1];

      const matches =
        (searchNum && fahrtNr === searchNum) ||
        (searchNum && trainNumberInName === searchNum) ||
        (searchFull && lineNameNoSpace === searchFull);

      if (matches && dep.tripId && !seenTripIds.has(dep.tripId)) {
        console.log(`[Stations] Found: ${lineName}`);
        seenTripIds.add(dep.tripId);
        matchingDepartures.push({ tripId: dep.tripId, dep });
      }
    }
    if (matchingDepartures.length >= 1) break;
  }

  const results: TrainJourney[] = [];
  for (const { tripId } of matchingDepartures.slice(0, 3)) {
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

  return results;
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

  console.log('=== HYBRID SEARCH START ===');
  console.log('Searching for:', cleanedNumber);

  // STUFE 1: Schnelle Suche über Bahnhofs-Abfahrten
  console.log('[1/3] Trying station departures...');
  let results = await searchViaStations(cleanedNumber);
  if (results.length > 0) {
    console.log('Found via stations!');
    setCachedSearch(cleanedNumber, results);
    return results;
  }

  // STUFE 2: Suche über journeys() API
  console.log('[2/3] Trying journeys API...');
  results = await searchViaJourneys(cleanedNumber);
  if (results.length > 0) {
    console.log('Found via journeys!');
    setCachedSearch(cleanedNumber, results);
    return results;
  }

  // STUFE 3: Fallback zu trainsearch.exe
  console.log('[3/3] Trying trainsearch.exe fallback...');
  results = await searchViaTrainsearch(cleanedNumber);
  if (results.length > 0) {
    console.log('Found via trainsearch!');
    setCachedSearch(cleanedNumber, results);
    return results;
  }

  console.log('=== NO RESULTS FOUND ===');
  return [];
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
  console.warn('getNearbyStations not yet implemented with new API');
  return [];
}

// Bekannte ICE-Strecken für journeys() Suche
const knownRoutes = [
  { from: '8000263', to: '8000261' }, // Münster → München (ICE 5xx)
  { from: '8000207', to: '8000261' }, // Köln → München
  { from: '8011160', to: '8000261' }, // Berlin → München
  { from: '8000149', to: '8000261' }, // Hamburg → München
  { from: '8000105', to: '8011160' }, // Frankfurt → Berlin
  { from: '8000207', to: '8011160' }, // Köln → Berlin
  { from: '8000149', to: '8011160' }, // Hamburg → Berlin
  { from: '8000096', to: '8011160' }, // Stuttgart → Berlin
];

// Suche über journeys() API
async function searchViaJourneys(trainNumber: string): Promise<TrainJourney[]> {
  const searchNum = trainNumber.replace(/\D/g, '');
  const searchFull = trainNumber.replace(/\s/g, '').toUpperCase();
  const baseUrl = getApiBaseUrl();

  console.log('Searching via journeys for:', trainNumber);

  const results: TrainJourney[] = [];
  const seenTripIds = new Set<string>();

  // Parallel alle Routen abfragen
  const routeResults = await Promise.all(
    knownRoutes.map(async (route) => {
      try {
        const url = `${baseUrl}?action=journeys&from=${route.from}&to=${route.to}`;
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        return data.journeys || [];
      } catch (e) {
        console.warn('Journey route failed:', e);
        return [];
      }
    })
  );

  // Suche in allen Journeys nach dem Zug
  for (const journeys of routeResults) {
    for (const journey of journeys) {
      for (const leg of journey.legs || []) {
        if (!leg.line?.name || !leg.tripId) continue;

        const lineName = leg.line.name.toUpperCase();
        const lineNameNoSpace = lineName.replace(/\s/g, '');
        const lineNameParts = lineName.split(/\s+/);
        const trainNumberInName = lineNameParts[lineNameParts.length - 1];

        const matches =
          (searchNum && trainNumberInName === searchNum) ||
          (searchFull && lineNameNoSpace === searchFull);

        if (matches && !seenTripIds.has(leg.tripId)) {
          console.log('Found via journeys:', lineName);
          seenTripIds.add(leg.tripId);

          // Hole vollständige Trip-Details
          try {
            const tripDetails = await getTripDetails(leg.tripId);
            if (tripDetails?.stopovers) {
              const converted = convertToTrainJourney(tripDetails);
              if (converted) {
                results.push(converted);
                if (results.length >= 1) return results;
              }
            }
          } catch (e) {
            console.warn('Failed to get trip details:', e);
          }
        }
      }
    }
  }

  return results;
}

// Fallback: DB trainsearch.exe
async function searchViaTrainsearch(trainNumber: string): Promise<TrainJourney[]> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}?action=trainsearch&trainName=${encodeURIComponent(trainNumber)}`;

  console.log('Fallback: Searching via trainsearch.exe for:', trainNumber);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('Trainsearch failed:', response.status);
      return [];
    }

    const data = await response.json();
    if (!data.trains?.length) {
      console.log('No trains found via trainsearch');
      return [];
    }

    // Konvertiere trainsearch Ergebnisse zu TrainJourney Format
    const results: TrainJourney[] = [];

    for (const train of data.trains) {
      const stops: TrainStop[] = (train.stops || []).map((s: any) => ({
        station: { id: '', name: s.station?.name || 'Unbekannt' },
        arrival: s.arrival || null,
        departure: s.departure || null,
        plannedArrival: s.arrival || null,
        plannedDeparture: s.departure || null,
      }));

      if (stops.length > 0) {
        const trainName = train.name || trainNumber;
        const trainType = trainName.split(' ')[0] || 'Zug';

        results.push({
          tripId: `trainsearch-${trainName}-${Date.now()}`,
          trainNumber: trainName.split(' ').slice(1).join(' '),
          trainType,
          trainName,
          direction: stops[stops.length - 1]?.station?.name || '',
          stops,
          origin: stops[0],
          destination: stops[stops.length - 1],
        });
      }
    }

    console.log('Found via trainsearch:', results.length);
    return results;
  } catch (e) {
    console.warn('Trainsearch error:', e);
    return [];
  }
}
