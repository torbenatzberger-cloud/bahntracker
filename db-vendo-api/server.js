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

// MAXIMALE Stationsabdeckung - alle wichtigen Bahnhöfe Deutschlands + Grenzbahnhöfe
const majorStations = [
  // === TIER 1: Die 10 größten ICE-Knoten ===
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

  // === TIER 2: Wichtige ICE-Halte ===
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
  { id: '8010205', name: 'Erfurt Hbf' },
  { id: '8010050', name: 'Berlin Südkreuz' },
  { id: '8000013', name: 'Augsburg Hbf' },
  { id: '8000260', name: 'Würzburg Hbf' },
  { id: '8000170', name: 'Ulm Hbf' },
  { id: '8000010', name: 'Aachen Hbf' },
  { id: '8010036', name: 'Magdeburg Hbf' },
  { id: '8000774', name: 'Freiburg Hbf' },
  { id: '8000049', name: 'Braunschweig Hbf' },

  // === TIER 3: Norddeutsche End-/Startpunkte ===
  { id: '8000199', name: 'Kiel Hbf' },
  { id: '8010304', name: 'Rostock Hbf' },
  { id: '8010324', name: 'Stralsund Hbf' },
  { id: '8000236', name: 'Lübeck Hbf' },
  { id: '8000310', name: 'Oldenburg Hbf' },
  { id: '8000294', name: 'Osnabrück Hbf' },
  { id: '8002553', name: 'Hamburg-Altona' },
  { id: '8006552', name: 'Westerland (Sylt)' },
  { id: '8010055', name: 'Binz' },

  // === TIER 4: Grenzbahnhöfe (CH/AT/NL/BE/FR/PL/CZ) ===
  { id: '8000026', name: 'Basel Bad Bf' },
  { id: '8500010', name: 'Basel SBB' },
  { id: '8100002', name: 'Salzburg Hbf' },
  { id: '8100003', name: 'Wien Hbf' },
  { id: '8100173', name: 'Innsbruck Hbf' },
  { id: '8400058', name: 'Amsterdam Centraal' },
  { id: '8400282', name: 'Utrecht Centraal' },
  { id: '8800105', name: 'Bruxelles-Midi' },
  { id: '8700011', name: 'Paris Est' },
  { id: '8700023', name: 'Strasbourg' },
  { id: '8501008', name: 'Zürich HB' },
  { id: '8501120', name: 'Bern' },
  { id: '8501026', name: 'Interlaken Ost' },
  { id: '5100002', name: 'Warszawa Centralna' },
  { id: '5400206', name: 'Praha hl.n.' },

  // === TIER 5: Weitere Regionalknoten ===
  { id: '8000078', name: 'Bielefeld Hbf' },
  { id: '8000036', name: 'Bonn Hbf' },
  { id: '8000228', name: 'Mainz Hbf' },
  { id: '8000377', name: 'Wiesbaden Hbf' },
  { id: '8000320', name: 'Regensburg Hbf' },
  { id: '8000108', name: 'Passau Hbf' },
  { id: '8000115', name: 'Fulda' },
  { id: '8000252', name: 'Marburg (Lahn)' },
  { id: '8000286', name: 'Offenburg' },
  { id: '8000156', name: 'Heidelberg Hbf' },
  { id: '8000068', name: 'Darmstadt Hbf' },
  { id: '8000355', name: 'Trier Hbf' },
  { id: '8000189', name: 'Kaiserslautern Hbf' },
  { id: '8000319', name: 'Saarbrücken Hbf' },

  // === TIER 6: Süddeutsche Knoten ===
  { id: '8000183', name: 'Ingolstadt Hbf' },
  { id: '8000309', name: 'Rosenheim' },
  { id: '8000262', name: 'München Pasing' },
  { id: '8000124', name: 'Garmisch-Partenkirchen' },
  { id: '8000221', name: 'Lindau Hbf' },
  { id: '8000057', name: 'Konstanz' },
  { id: '8000340', name: 'Singen (Hohentwiel)' },

  // === TIER 7: Ostdeutsche Knoten ===
  { id: '8010085', name: 'Cottbus Hbf' },
  { id: '8010366', name: 'Wittenberge' },
  { id: '8010404', name: 'Frankfurt (Oder)' },
  { id: '8010240', name: 'Lutherstadt Wittenberg' },
  { id: '8012666', name: 'Berlin Ostbahnhof' },
  { id: '8011102', name: 'Berlin Gesundbrunnen' },
  { id: '8010089', name: 'Dessau Hbf' },
  { id: '8010153', name: 'Gera Hbf' },
  { id: '8010097', name: 'Eisenach' },
  { id: '8010183', name: 'Jena Paradies' },
  { id: '8010405', name: 'Zwickau Hbf' },
  { id: '8010074', name: 'Chemnitz Hbf' },

  // === TIER 8: Zusätzliche wichtige Halte für maximale Abdeckung ===
  { id: '8000142', name: 'Hamm (Westf)' },
  { id: '8000149', name: 'Hagen Hbf' },
  { id: '8000368', name: 'Wuppertal Hbf' },
  { id: '8000119', name: 'Gelsenkirchen Hbf' },
  { id: '8000041', name: 'Bochum Hbf' },
  { id: '8000086', name: 'Duisburg Hbf' },
  { id: '8000169', name: 'Uelzen' },
  { id: '8000062', name: 'Celle' },
  { id: '8000169', name: 'Hildesheim Hbf' },
  { id: '8000250', name: 'Lüneburg' },
  { id: '8000066', name: 'Coburg' },
  { id: '8000025', name: 'Bamberg' },
  { id: '8000032', name: 'Bayreuth Hbf' },
  { id: '8000162', name: 'Hof Hbf' },
  { id: '8000298', name: 'Plauen (Vogtl) ob Bf' },
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

// Produkt-Filter für Fernverkehr + Regionalverkehr
const productFilter = {
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
};

// Hilfsfunktion: Zug zum Index hinzufügen
function addTrainToIndex(newIndex, trainInfo, station, source) {
  const { line, tripId, direction, when, plannedWhen, delay } = trainInfo;

  if (!line?.name || !tripId) return false;

  const lineName = line.name;
  const trainNumber = extractTrainNumber(lineName);
  const trainType = extractTrainType(lineName);

  if (!trainNumber) return false;

  // Verschiedene Schlüssel für die Suche
  const keys = [
    trainNumber,                           // "513"
    `${trainType}${trainNumber}`,          // "ICE513"
    `${trainType} ${trainNumber}`,         // "ICE 513"
    lineName.toUpperCase(),                // "ICE 513" (original)
  ].filter(Boolean);

  const trainData = {
    tripId: tripId,
    lineName: lineName,
    trainNumber: trainNumber,
    trainType: trainType,
    station: station.id,
    stationName: station.name,
    direction: direction || null,
    time: when || plannedWhen,
    delay: delay || 0,
    source: source, // 'departure' oder 'arrival'
  };

  let added = false;
  for (const key of keys) {
    if (!newIndex.has(key)) {
      newIndex.set(key, trainData);
      added = true;
    }
  }
  return added;
}

// MAXIMALER Index aufbauen: Departures + Arrivals für 24h
async function buildTrainIndex() {
  console.log('=== BUILDING MAXIMUM TRAIN INDEX ===');
  console.log(`[Index] Scanning ${majorStations.length} stations`);
  console.log(`[Index] Mode: Departures + Arrivals, 24h coverage, 500 results per query`);
  indexStatus = 'building';
  const startTime = Date.now();

  const newIndex = new Map();
  const now = new Date();

  // 4 Zeitfenster für volle 24h-Abdeckung
  const timeWindows = [
    { name: 'now-6h', offset: 0 },      // Jetzt bis +6h
    { name: '6h-12h', offset: 6 },      // +6h bis +12h
    { name: '12h-18h', offset: 12 },    // +12h bis +18h
    { name: '18h-24h', offset: 18 },    // +18h bis +24h
  ];

  console.log(`[Index] Current time: ${now.toISOString()}`);
  console.log(`[Index] Time windows: ${timeWindows.map(w => w.name).join(', ')}`);

  let totalDepartures = 0;
  let totalArrivals = 0;
  let stationsProcessed = 0;
  let errors = 0;

  for (const station of majorStations) {
    try {
      let stationDeps = 0;
      let stationArrs = 0;

      for (const window of timeWindows) {
        const windowStart = new Date(now.getTime() + window.offset * 60 * 60 * 1000);

        // === DEPARTURES für dieses Zeitfenster ===
        try {
          const deps = await client.departures(station.id, {
            when: windowStart,
            duration: 360, // 6 Stunden
            results: 500,  // MAXIMUM
            products: productFilter,
          });

          const depList = deps.departures || deps || [];
          for (const dep of depList) {
            if (addTrainToIndex(newIndex, dep, station, `dep-${window.name}`)) {
              stationDeps++;
            }
          }
        } catch (e) {
          if (!e.message?.includes('404')) {
            console.error(`[Index] Dep error ${station.name} ${window.name}:`, e.message);
          }
        }

        // Kleine Pause zwischen Anfragen
        await new Promise(resolve => setTimeout(resolve, 150));

        // === ARRIVALS für dieses Zeitfenster ===
        try {
          const arrs = await client.arrivals(station.id, {
            when: windowStart,
            duration: 360, // 6 Stunden
            results: 500,  // MAXIMUM
            products: productFilter,
          });

          const arrList = arrs.arrivals || arrs || [];
          for (const arr of arrList) {
            if (addTrainToIndex(newIndex, arr, station, `arr-${window.name}`)) {
              stationArrs++;
            }
          }
        } catch (e) {
          if (!e.message?.includes('404')) {
            console.error(`[Index] Arr error ${station.name} ${window.name}:`, e.message);
          }
        }

        // Kleine Pause zwischen Anfragen
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      totalDepartures += stationDeps;
      totalArrivals += stationArrs;
      stationsProcessed++;

      // Nur alle 10 Stationen loggen um Spam zu reduzieren
      if (stationsProcessed % 10 === 0 || stationsProcessed === majorStations.length) {
        console.log(`[Index] Progress: ${stationsProcessed}/${majorStations.length} stations, ${newIndex.size} entries`);
      }

    } catch (error) {
      errors++;
      console.error(`[Index] Error at ${station.name}:`, error.message);
    }
  }

  trainIndex = newIndex;
  indexLastUpdated = new Date();
  indexStatus = 'ready';

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const uniqueTrains = new Set([...newIndex.values()].map(t => t.trainNumber)).size;

  console.log(`=== INDEX COMPLETE ===`);
  console.log(`[Index] ${newIndex.size} index entries (${uniqueTrains} unique trains)`);
  console.log(`[Index] ${totalDepartures} from departures, ${totalArrivals} from arrivals`);
  console.log(`[Index] ${stationsProcessed} stations processed, ${errors} errors`);
  console.log(`[Index] Duration: ${duration}s`);

  return {
    entries: newIndex.size,
    uniqueTrains: uniqueTrains,
    departures: totalDepartures,
    arrivals: totalArrivals,
    stations: stationsProcessed,
    errors: errors,
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

// Autocomplete für Live-Suche (gibt Liste von passenden Zügen zurück)
app.get('/trains/autocomplete', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) {
      return res.json({ results: [] });
    }

    const query = q.toString().toUpperCase().trim();
    const queryNumOnly = query.replace(/\D/g, '');

    // Sammle alle passenden Züge
    const matches = new Map(); // trainNumber -> trainData (deduplizieren)

    for (const [key, data] of trainIndex.entries()) {
      // Nur auf trainNumber-Keys matchen (nicht auf "ICE 513" etc.)
      if (!/^\d+$/.test(key)) continue;

      const matchesQuery =
        key.startsWith(queryNumOnly) ||  // "51" matched "513", "519"
        data.trainNumber.startsWith(queryNumOnly) ||
        data.lineName.toUpperCase().includes(query);

      if (matchesQuery && !matches.has(data.trainNumber)) {
        matches.set(data.trainNumber, {
          trainNumber: data.trainNumber,
          lineName: data.lineName,
          trainType: data.trainType,
          direction: data.direction,
          tripId: data.tripId,
        });
      }
    }

    // Sortieren: kürzeste Zugnummern zuerst, dann alphabetisch
    const results = [...matches.values()]
      .sort((a, b) => {
        // Exakte Matches zuerst
        if (a.trainNumber === queryNumOnly) return -1;
        if (b.trainNumber === queryNumOnly) return 1;
        // Dann nach Länge der Zugnummer
        if (a.trainNumber.length !== b.trainNumber.length) {
          return a.trainNumber.length - b.trainNumber.length;
        }
        // Dann alphabetisch
        return a.trainNumber.localeCompare(b.trainNumber);
      })
      .slice(0, 10); // Max 10 Ergebnisse

    return res.json({
      query: q,
      count: results.length,
      results: results,
    });

  } catch (error) {
    console.error('[Autocomplete] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
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

  // Stündliche Aktualisierung des Index
  const REBUILD_INTERVAL_MS = 60 * 60 * 1000; // 1 Stunde

  const scheduleHourlyRebuild = () => {
    console.log(`Next index rebuild scheduled in 1 hour`);

    setTimeout(async () => {
      console.log('Scheduled hourly index rebuild starting...');
      try {
        await buildTrainIndex();
      } catch (error) {
        console.error('Scheduled rebuild failed:', error.message);
      }
      scheduleHourlyRebuild();
    }, REBUILD_INTERVAL_MS);
  };

  scheduleHourlyRebuild();
});
