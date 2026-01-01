import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_BASE = 'https://v6.db.transport.rest';

// In-Memory Cache für Vercel Serverless Functions
// Cache wird zwischen Requests im selben Container geteilt
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 Minuten
const MAX_CACHE_SIZE = 100;

function getCacheKey(endpoint: string, params: Record<string, string>): string {
  const sortedParams = Object.entries(params)
    .filter(([key]) => key !== 'endpoint')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `${endpoint}?${sortedParams}`;
}

function getFromCache(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCache(key: string, data: any): void {
  // Alte Einträge löschen wenn Cache zu groß
  if (cache.size >= MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now - v.timestamp > CACHE_TTL_MS) {
        cache.delete(k);
      }
    }
    // Falls immer noch zu voll, ältesten löschen
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
  }

  cache.set(key, { data, timestamp: Date.now() });
}

// Retry mit exponential backoff
async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);

      if (response.ok) return response;

      // Bei 503/500 warten und erneut versuchen
      if ((response.status === 503 || response.status === 500) && i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        continue;
      }

      return response; // Fehler-Response zurückgeben
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
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

  const { endpoint } = req.query;

  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }

  // Query-Parameter sammeln
  const params: Record<string, string> = {};
  Object.entries(req.query).forEach(([key, value]) => {
    if (key !== 'endpoint' && typeof value === 'string') {
      params[key] = value;
    }
  });

  // Cache prüfen
  const cacheKey = getCacheKey(endpoint, params);
  const cachedData = getFromCache(cacheKey);

  if (cachedData) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cachedData);
  }

  try {
    // URL bauen
    const url = new URL(endpoint, API_BASE);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    // Mit Retry fetchen
    const response = await fetchWithRetry(url.toString(), 3, 1000);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `API error: ${response.status}`,
        url: url.toString()
      });
    }

    const data = await response.json();

    // In Cache speichern
    setCache(cacheKey, data);

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
