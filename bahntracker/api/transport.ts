import type { VercelRequest, VercelResponse } from '@vercel/node';

// Eigener db-vendo-client Server als Backend
const API_BASE = 'http://152.53.123.81:3000';

// In-Memory Cache
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 Minuten
const MAX_CACHE_SIZE = 100;

function getCacheKey(type: string, id: string): string {
  return `${type}:${id}`;
}

function getFromCache(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCache(key: string, data: any): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now - v.timestamp > CACHE_TTL_MS) {
        cache.delete(k);
      }
    }
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
  }

  cache.set(key, { data, timestamp: Date.now() });
}

// Aggressives Retry mit exponential backoff
async function fetchWithRetry(url: string, retries = 5, delay = 2000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);

      if (response.ok) return response;

      // Bei 503/500/429 warten und erneut versuchen
      if ((response.status === 503 || response.status === 500 || response.status === 429) && i < retries - 1) {
        const waitTime = delay * Math.pow(2, i); // 2s, 4s, 8s, 16s, 32s
        console.log(`API returned ${response.status}, retry ${i + 1}/${retries - 1} in ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      return response;
    } catch (e) {
      if (i === retries - 1) throw e;
      const waitTime = delay * Math.pow(2, i);
      console.log(`Fetch error, retry ${i + 1}/${retries - 1} in ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  throw new Error('Max retries reached');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, stationId, tripId } = req.query;

  if (!action || typeof action !== 'string') {
    return res.status(400).json({ error: 'Missing action parameter' });
  }

  try {
    // DEPARTURES
    if (action === 'departures' && typeof stationId === 'string') {
      const cacheKey = getCacheKey('departures', stationId);
      const cached = getFromCache(cacheKey);

      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cached);
      }

      const url = new URL(`/stops/${stationId}/departures`, API_BASE);
      url.searchParams.set('duration', '720'); // 12 Stunden
      url.searchParams.set('results', '100');

      const response = await fetchWithRetry(url.toString());

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Upstream API error: ${response.status}`,
          message: 'Die Bahn-API ist momentan nicht erreichbar. Bitte später erneut versuchen.',
        });
      }

      const data = await response.json();
      const result = { departures: data.departures || data };

      setCache(cacheKey, result);
      res.setHeader('X-Cache', 'MISS');
      return res.status(200).json(result);
    }

    // TRIP DETAILS
    if (action === 'trip' && typeof tripId === 'string') {
      const cacheKey = getCacheKey('trip', tripId);
      const cached = getFromCache(cacheKey);

      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cached);
      }

      const url = new URL(`/trips/${encodeURIComponent(tripId)}`, API_BASE);
      url.searchParams.set('stopovers', 'true');
      console.log('Fetching trip:', url.toString());

      const response = await fetchWithRetry(url.toString());

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Upstream API error: ${response.status}`,
          message: 'Die Bahn-API ist momentan nicht erreichbar.',
        });
      }

      const data = await response.json();
      const result = { trip: data.trip || data };

      setCache(cacheKey, result);
      res.setHeader('X-Cache', 'MISS');
      return res.status(200).json(result);
    }

    // JOURNEYS zwischen zwei Stationen
    if (action === 'journeys') {
      const { from, to } = req.query;
      if (typeof from !== 'string' || typeof to !== 'string') {
        return res.status(400).json({ error: 'Missing from or to parameter' });
      }

      const url = new URL('/journeys', API_BASE);
      url.searchParams.set('from', from);
      url.searchParams.set('to', to);

      const response = await fetchWithRetry(url.toString());

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Upstream API error: ${response.status}`,
        });
      }

      const data = await response.json();
      return res.status(200).json({ journeys: data.journeys || data });
    }

    // TRAINSEARCH Fallback - scrapes DB website
    if (action === 'trainsearch') {
      const { trainName } = req.query;
      if (typeof trainName !== 'string') {
        return res.status(400).json({ error: 'Missing trainName parameter' });
      }

      const today = new Date().toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });

      const searchUrl = `https://reiseauskunft.bahn.de/bin/trainsearch.exe/dn?` +
        `ld=43.02&protocol=https:&seqnr=1&ident=&rt=1&` +
        `trainname=${encodeURIComponent(trainName)}&date=${encodeURIComponent(today)}&` +
        `boardType=dep&time=&maxJourneys=10&regularity=&`;

      try {
        const htmlResponse = await fetch(searchUrl);
        const html = await htmlResponse.text();

        // Parse HTML für traininfo.exe Links
        const trainInfoMatches = html.matchAll(/traininfo\.exe\/dn[^"]+/g);
        const trainLinks: string[] = [];

        for (const match of trainInfoMatches) {
          const link = `https://reiseauskunft.bahn.de/bin/${match[0].replace(/&amp;/g, '&')}`;
          if (!trainLinks.includes(link)) {
            trainLinks.push(link);
          }
        }

        if (trainLinks.length === 0) {
          return res.status(200).json({ trains: [], message: 'No trains found' });
        }

        // Parse train info for each link
        const trains: any[] = [];
        for (const link of trainLinks.slice(0, 3)) {
          try {
            const infoResponse = await fetch(link);
            const infoHtml = await infoResponse.text();

            // Extract train name from title
            const titleMatch = infoHtml.match(/<title>([^<]+)<\/title>/);
            const trainName = titleMatch ? titleMatch[1].trim() : 'Unknown';

            // Extract stops from the journey table
            const stops: any[] = [];
            const stopMatches = infoHtml.matchAll(
              /<td[^>]*class="station"[^>]*>([^<]+)<\/td>.*?<td[^>]*class="arrival"[^>]*>([^<]*)<\/td>.*?<td[^>]*class="departure"[^>]*>([^<]*)<\/td>/gs
            );

            for (const stopMatch of stopMatches) {
              stops.push({
                station: { name: stopMatch[1].trim() },
                arrival: stopMatch[2].trim() || null,
                departure: stopMatch[3].trim() || null,
              });
            }

            trains.push({
              name: trainName,
              link,
              stops,
            });
          } catch (e) {
            console.warn('Failed to parse traininfo:', e);
          }
        }

        return res.status(200).json({ trains });
      } catch (e) {
        console.error('Trainsearch error:', e);
        return res.status(500).json({
          error: 'Trainsearch failed',
          message: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    return res.status(400).json({ error: 'Invalid action or missing parameters' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      error: 'API request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
