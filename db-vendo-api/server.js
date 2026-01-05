import express from 'express';
import cors from 'cors';
import { createClient } from 'db-vendo-client';
import { profile as dbnavProfile } from 'db-vendo-client/p/dbnav/index.js';
import fs from 'fs';

const app = express();
const PORT = 3000;

// CORS für alle Origins erlauben
app.use(cors());
app.use(express.json());

// db-vendo-client initialisieren
const client = createClient(dbnavProfile, 'BahnTracker/1.0');

// ============================================
// ZUG-INDEX SYSTEM
// ============================================

// In-Memory Zug-Index
let trainIndex = new Map(); // trainNumber -> { tripId, lineName, station, direction, departure }
let indexLastUpdated = null;
let indexStatus = 'not_initialized';

// Alle wichtigen Knotenbahnhöfe Deutschlands
const majorStations = [
  { id: '8000105', name: 'Frankfurt Hbf' },
  { id: '8000261', name: 'München Hbf' },
  { id: '8011160', name: 'Berlin Hbf' },
  { id: '8000207', name: 'Köln Hbf' },
  { id: '8002549', name: 'Hamburg Hbf' },
  { id: '8000152', name: 'Hannover Hbf' },
  { id: '8000096', name: 'Stuttgart Hbf' },
  { id: '8000085', name: 'Düsseldorf Hbf' },
  { id: '8000284', name: 'Nürnberg Hbf' },
  { id: '8010224', name: 'Leipzig Hbf' },
  { id: '8000244', name: 'Mannheim Hbf' },
  { id: '8010159', name: 'Dresden Hbf' },
  { id: '8000080', name: 'Dortmund Hbf' },
  { id: '8000098', name: 'Essen Hbf' },
  { id: '8000191', name: 'Karlsruhe Hbf' },
  { id: '8000050', name: 'Bremen Hbf' },
  { id: '8003200', name: 'Kassel-Wilhelmshöhe' },
  { id: '8000263', name: 'Münster Hbf' },
  { id: '8010101', name: 'Halle (Saale) Hbf' },
  { id: '8000128', name: 'Göttingen' },
];

// Zugnummer aus Linienname extrahieren (z.B. "ICE 513" -> "513")
function extractTrainNumber(lineName) {
  if (!lineName) return null;
  const parts = lineName.toUpperCase().split(/\s+/);
  // Suche nach einer Zahl im Namen
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      return part;
    }
  }
  return null;
}

// Zugtyp extrahieren (ICE, IC, EC, etc.)
function extractTrainType(lineName) {
  if (!lineName) return null;
  const match = lineName.toUpperCase().match(/^(ICE|IC|EC|RE|RB|IRE|TGV|RJ|NJ)/);
  return match ? match[1] : null;
}

// Index für einen Tag aufbauen
async function buildTrainIndex() {
  console.log('=== BUILDING TRAIN INDEX ===');
  indexStatus = 'building';
  const startTime = Date.now();

  const newIndex = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const noon = new Date(today);
  noon.setHours(12, 0, 0, 0);

  let totalTrains = 0;
  let stationsProcessed = 0;

  for (const station of majorStations) {
    try {
      // Morgen-Abfahrten (00:00 - 12:00)
      const morningDeps = await client.departures(station.id, {
        when: today,
        duration: 720,
        results: 100,
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
      });

      // Nachmittag-Abfahrten (12:00 - 24:00)
      const afternoonDeps = await client.departures(station.id, {
        when: noon,
        duration: 720,
        results: 100,
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
      });

      const allDeps = [
        ...(morningDeps.departures || morningDeps || []),
        ...(afternoonDeps.departures || afternoonDeps || []),
      ];

      for (const dep of allDeps) {
        if (!dep.line?.name || !dep.tripId) continue;

        const lineName = dep.line.name;
        const trainNumber = extractTrainNumber(lineName);
        const trainType = extractTrainType(lineName);

        if (!trainNumber) continue;

        // Verschiedene Schlüssel für die Suche
        const keys = [
          trainNumber,                           // "513"
          `${trainType}${trainNumber}`,          // "ICE513"
          `${trainType} ${trainNumber}`,         // "ICE 513"
          lineName.toUpperCase(),                // "ICE 513" (original)
        ].filter(Boolean);

        const trainData = {
          tripId: dep.tripId,
          lineName: lineName,
          trainNumber: trainNumber,
          trainType: trainType,
          station: station.id,
          stationName: station.name,
          direction: dep.direction || null,
          departure: dep.when || dep.plannedWhen,
          delay: dep.delay || 0,
        };

        for (const key of keys) {
          if (!newIndex.has(key)) {
            newIndex.set(key, trainData);
            totalTrains++;
          }
        }
      }

      stationsProcessed++;
      console.log(`[Index] ${station.name}: processed (${stationsProcessed}/${majorStations.length})`);

      // Kleine Pause zwischen Stationen um Rate Limits zu vermeiden
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`[Index] Error at ${station.name}:`, error.message);
    }
  }

  trainIndex = newIndex;
  indexLastUpdated = new Date();
  indexStatus = 'ready';

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`=== INDEX COMPLETE: ${newIndex.size} entries in ${duration}s ===`);

  return {
    entries: newIndex.size,
    stations: stationsProcessed,
    duration: duration,
  };
}

// ============================================
// API ENDPOINTS
// ============================================

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    trainIndex: {
      status: indexStatus,
      entries: trainIndex.size,
      lastUpdated: indexLastUpdated?.toISOString() || null,
    }
  });
});

// Zug-Suche über Index (SCHNELL!)
app.get('/trains/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Missing q (query) parameter' });
    }

    const query = q.toString().toUpperCase().trim();
    const queryNoSpace = query.replace(/\s/g, '');
    const queryNumOnly = query.replace(/\D/g, '');

    console.log(`[Search] Query: "${q}" -> normalized: "${query}"`);

    // Suche im Index
    let found = trainIndex.get(query) ||
                trainIndex.get(queryNoSpace) ||
                trainIndex.get(queryNumOnly);

    // Falls nicht gefunden, fuzzy search
    if (!found) {
      for (const [key, data] of trainIndex.entries()) {
        if (key.includes(queryNumOnly) || data.trainNumber === queryNumOnly) {
          found = data;
          break;
        }
      }
    }

    if (!found) {
      console.log(`[Search] Not found in index: "${q}"`);
      return res.json({
        found: false,
        query: q,
        indexStatus: indexStatus,
        indexSize: trainIndex.size,
      });
    }

    console.log(`[Search] Found: ${found.lineName} at ${found.stationName}`);

    // Live Trip-Details abrufen
    try {
      const trip = await client.trip(found.tripId, { stopovers: true });
      const tripData = trip.trip || trip;

      return res.json({
        found: true,
        query: q,
        train: {
          lineName: found.lineName,
          trainNumber: found.trainNumber,
          trainType: found.trainType,
          direction: found.direction,
          foundAtStation: found.stationName,
        },
        trip: tripData,
      });
    } catch (tripError) {
      // Trip-Fehler, aber Zug wurde gefunden
      console.error('[Search] Trip fetch error:', tripError.message);
      return res.json({
        found: true,
        query: q,
        train: {
          lineName: found.lineName,
          trainNumber: found.trainNumber,
          trainType: found.trainType,
          direction: found.direction,
          foundAtStation: found.stationName,
          tripId: found.tripId,
        },
        tripError: tripError.message,
      });
    }

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Index manuell neu aufbauen
app.post('/trains/rebuild-index', async (req, res) => {
  try {
    if (indexStatus === 'building') {
      return res.status(409).json({ error: 'Index is already being built' });
    }

    const result = await buildTrainIndex();
    res.json({
      success: true,
      ...result,
      lastUpdated: indexLastUpdated?.toISOString(),
    });
  } catch (error) {
    console.error('Rebuild error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Index-Status abrufen
app.get('/trains/index-status', (req, res) => {
  res.json({
    status: indexStatus,
    entries: trainIndex.size,
    lastUpdated: indexLastUpdated?.toISOString() || null,
    stations: majorStations.length,
  });
});

// Departures für eine Station
app.get('/stops/:stopId/departures', async (req, res) => {
  try {
    const { stopId } = req.params;
    const duration = parseInt(req.query.duration) || 120;
    const results = parseInt(req.query.results) || 30;
    const when = req.query.when ? new Date(req.query.when) : undefined;

    const departures = await client.departures(stopId, {
      when,
      duration,
      results,
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
    });

    res.json({ departures: departures.departures || departures });
  } catch (error) {
    console.error('Departures error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trip Details
app.get('/trips/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params;
    const stopovers = req.query.stopovers === 'true';

    const trip = await client.trip(tripId, { stopovers });

    res.json({ trip: trip.trip || trip });
  } catch (error) {
    console.error('Trip error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Journeys zwischen zwei Stationen (für Zugsuche)
app.get('/journeys', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'Missing from or to parameter' });
    }

    const journeys = await client.journeys(from, to, {
      results: 10,
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
    });

    res.json({ journeys: journeys.journeys || journeys });
  } catch (error) {
    console.error('Journeys error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Locations suchen (optional, für spätere Erweiterungen)
app.get('/locations', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Missing query parameter' });
    }

    const locations = await client.locations(query, { results: 10 });

    res.json({ locations });
  } catch (error) {
    console.error('Locations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SERVER START
// ============================================

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`db-vendo-api running on port ${PORT}`);

  // Index beim Start aufbauen
  console.log('Building initial train index...');
  try {
    await buildTrainIndex();
  } catch (error) {
    console.error('Failed to build initial index:', error.message);
  }

  // Tägliche Aktualisierung um 04:00 Uhr
  const scheduleNextRebuild = () => {
    const now = new Date();
    const next4am = new Date(now);
    next4am.setHours(4, 0, 0, 0);

    if (next4am <= now) {
      next4am.setDate(next4am.getDate() + 1);
    }

    const msUntilRebuild = next4am.getTime() - now.getTime();
    console.log(`Next index rebuild scheduled at ${next4am.toISOString()}`);

    setTimeout(async () => {
      console.log('Scheduled index rebuild starting...');
      try {
        await buildTrainIndex();
      } catch (error) {
        console.error('Scheduled rebuild failed:', error.message);
      }
      scheduleNextRebuild();
    }, msUntilRebuild);
  };

  scheduleNextRebuild();
});
