import express from 'express';
import cors from 'cors';
import { createClient } from 'db-vendo-client';
import { profile as dbnavProfile } from 'db-vendo-client/p/dbnav/index.js';

const app = express();
const PORT = 3000;

// CORS für alle Origins erlauben
app.use(cors());
app.use(express.json());

// db-vendo-client initialisieren
const client = createClient(dbnavProfile, 'BahnTracker/1.0');

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`db-vendo-api running on port ${PORT}`);
});
