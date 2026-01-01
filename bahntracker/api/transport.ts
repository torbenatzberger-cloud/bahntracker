import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'db-vendo-client';
import { profile as dbnavProfile } from 'db-vendo-client/p/dbnav/index.js';

// db-vendo-client Instanz
const client = createClient(dbnavProfile, 'BahnTracker/1.0');

// In-Memory Cache
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 Minuten (länger wegen Rate Limits)
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

// Retry-Wrapper für db-vendo-client Aufrufe
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const isRateLimit = e?.message?.includes('429') || e?.message?.includes('rate');
      const isServerError = e?.message?.includes('503') || e?.message?.includes('500');

      if ((isRateLimit || isServerError) && i < retries - 1) {
        const waitTime = delay * Math.pow(2, i);
        console.log(`API error, retry ${i + 1}/${retries} in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw e;
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

      const departures = await withRetry(() =>
        client.departures(stationId, {
          duration: 120,
          results: 30,
          products: {
            nationalExpress: true,
            national: true,
            regionalExpress: true,
            regional: true,
            suburban: false,
            bus: false,
            ferry: false,
            subway: false,
            tram: false,
            taxi: false,
          },
        })
      );

      // Formatiere für Kompatibilität mit bestehendem Code
      const result = {
        departures: departures.map((dep: any) => ({
          tripId: dep.tripId,
          stop: dep.stop,
          when: dep.when,
          plannedWhen: dep.plannedWhen,
          delay: dep.delay,
          platform: dep.platform,
          plannedPlatform: dep.plannedPlatform,
          direction: dep.direction,
          line: {
            type: 'line',
            id: dep.line?.id,
            fahrtNr: dep.line?.fahrtNr,
            name: dep.line?.name,
            product: dep.line?.product,
            productName: dep.line?.productName,
          },
        })),
      };

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

      const trip = await withRetry(() =>
        client.trip(tripId, { stopovers: true })
      );

      const result = {
        trip: {
          id: trip.id,
          line: trip.line,
          direction: trip.direction,
          stopovers: trip.stopovers?.map((s: any) => ({
            stop: s.stop,
            arrival: s.arrival,
            plannedArrival: s.plannedArrival,
            departure: s.departure,
            plannedDeparture: s.plannedDeparture,
            arrivalDelay: s.arrivalDelay,
            departureDelay: s.departureDelay,
            platform: s.platform,
            plannedPlatform: s.plannedPlatform,
          })),
        },
      };

      setCache(cacheKey, result);
      res.setHeader('X-Cache', 'MISS');
      return res.status(200).json(result);
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
