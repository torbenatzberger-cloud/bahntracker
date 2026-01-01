import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_BASE = 'https://v6.db.transport.rest';

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

  try {
    // Baue die URL zusammen
    const url = new URL(endpoint, API_BASE);

    // Füge Query-Parameter hinzu (außer endpoint)
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'endpoint' && typeof value === 'string') {
        url.searchParams.set(key, value);
      }
    });

    const response = await fetch(url.toString());

    if (!response.ok) {
      return res.status(response.status).json({
        error: `API error: ${response.status}`,
        url: url.toString()
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
