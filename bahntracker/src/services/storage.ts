import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip, MonthlyStats, YearlyStats, Achievement } from '../types';
import { supabase, getDeviceId, isSupabaseConfigured } from '../config/supabase';

const TRIPS_KEY = 'bahntracker_trips';
const ACHIEVEMENTS_KEY = 'bahntracker_achievements';

// === TRIP FUNKTIONEN ===

export async function saveTrip(trip: Trip): Promise<void> {
  // Lokal speichern
  const trips = await getTrips();
  trips.unshift(trip);
  await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(trips));

  // In Supabase speichern (wenn konfiguriert)
  if (isSupabaseConfigured()) {
    try {
      const deviceId = await getDeviceId();
      await supabase.from('trips').insert({
        device_id: deviceId,
        trip_id: trip.tripId,
        train_number: trip.trainNumber,
        train_type: trip.trainType,
        train_name: trip.trainName,
        origin_station: trip.originStation,
        origin_station_id: trip.originStationId,
        destination_station: trip.destinationStation,
        destination_station_id: trip.destinationStationId,
        departure_planned: trip.departurePlanned,
        departure_actual: trip.departureActual,
        arrival_planned: trip.arrivalPlanned,
        arrival_actual: trip.arrivalActual,
        delay_minutes: trip.delayMinutes,
        distance_km: trip.distanceKm,
        duration_minutes: trip.durationMinutes,
        co2_saved_kg: trip.co2SavedKg,
        created_at: trip.createdAt,
      });
    } catch (error) {
      console.warn('Supabase sync failed:', error);
    }
  }

  await checkAchievements(trips);
}

export async function getTrips(): Promise<Trip[]> {
  const data = await AsyncStorage.getItem(TRIPS_KEY);
  return data ? JSON.parse(data) : [];
}

export async function deleteTrip(tripId: string): Promise<void> {
  const trips = await getTrips();
  const tripToDelete = trips.find(t => t.id === tripId);
  await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(trips.filter(t => t.id !== tripId)));

  // Aus Supabase löschen (wenn konfiguriert)
  if (isSupabaseConfigured() && tripToDelete) {
    try {
      const deviceId = await getDeviceId();
      await supabase
        .from('trips')
        .delete()
        .eq('device_id', deviceId)
        .eq('trip_id', tripToDelete.tripId)
        .eq('created_at', tripToDelete.createdAt);
    } catch (error) {
      console.warn('Supabase delete failed:', error);
    }
  }
}

export async function updateTrip(updatedTrip: Trip): Promise<void> {
  // Lokal aktualisieren
  const trips = await getTrips();
  const index = trips.findIndex(t => t.id === updatedTrip.id);
  if (index === -1) {
    throw new Error('Trip not found');
  }

  const originalTrip = trips[index];
  trips[index] = updatedTrip;
  await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(trips));

  // In Supabase aktualisieren (wenn konfiguriert)
  if (isSupabaseConfigured()) {
    try {
      const deviceId = await getDeviceId();
      await supabase
        .from('trips')
        .update({
          train_number: updatedTrip.trainNumber,
          train_type: updatedTrip.trainType,
          train_name: updatedTrip.trainName,
          origin_station: updatedTrip.originStation,
          origin_station_id: updatedTrip.originStationId,
          destination_station: updatedTrip.destinationStation,
          destination_station_id: updatedTrip.destinationStationId,
          departure_planned: updatedTrip.departurePlanned,
          departure_actual: updatedTrip.departureActual,
          arrival_planned: updatedTrip.arrivalPlanned,
          arrival_actual: updatedTrip.arrivalActual,
          delay_minutes: updatedTrip.delayMinutes,
          distance_km: updatedTrip.distanceKm,
          duration_minutes: updatedTrip.durationMinutes,
          co2_saved_kg: updatedTrip.co2SavedKg,
        })
        .eq('device_id', deviceId)
        .eq('trip_id', originalTrip.tripId)
        .eq('created_at', originalTrip.createdAt);
    } catch (error) {
      console.warn('Supabase update failed:', error);
    }
  }

  // Achievements neu berechnen
  await checkAchievements(trips);
}

// Synchronisiert lokale Daten mit Supabase
export async function syncWithCloud(): Promise<{ synced: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { synced: 0, error: 'Supabase nicht konfiguriert' };
  }

  try {
    const deviceId = await getDeviceId();
    const localTrips = await getTrips();

    // Hole Cloud-Daten
    const { data: cloudTrips, error } = await supabase
      .from('trips')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Finde lokale Trips, die nicht in der Cloud sind
    const cloudTripIds = new Set(cloudTrips?.map(t => `${t.trip_id}-${t.created_at}`) || []);
    const tripsToSync = localTrips.filter(t => !cloudTripIds.has(`${t.tripId}-${t.createdAt}`));

    // Sync fehlende Trips
    for (const trip of tripsToSync) {
      await supabase.from('trips').insert({
        device_id: deviceId,
        trip_id: trip.tripId,
        train_number: trip.trainNumber,
        train_type: trip.trainType,
        train_name: trip.trainName,
        origin_station: trip.originStation,
        origin_station_id: trip.originStationId,
        destination_station: trip.destinationStation,
        destination_station_id: trip.destinationStationId,
        departure_planned: trip.departurePlanned,
        departure_actual: trip.departureActual,
        arrival_planned: trip.arrivalPlanned,
        arrival_actual: trip.arrivalActual,
        delay_minutes: trip.delayMinutes,
        distance_km: trip.distanceKm,
        duration_minutes: trip.durationMinutes,
        co2_saved_kg: trip.co2SavedKg,
        created_at: trip.createdAt,
      });
    }

    return { synced: tripsToSync.length };
  } catch (error) {
    console.warn('Cloud sync failed:', error);
    return { synced: 0, error: String(error) };
  }
}

// === STATISTIK FUNKTIONEN ===

export async function getMonthlyStats(year: number, month: number): Promise<MonthlyStats> {
  const trips = await getTrips();
  const monthTrips = trips.filter(t => {
    const d = new Date(t.createdAt);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const totalDelay = monthTrips.reduce((s, t) => s + t.delayMinutes, 0);
  const onTime = monthTrips.filter(t => t.delayMinutes <= 5).length;

  return {
    month: months[month],
    year,
    totalTrips: monthTrips.length,
    totalDistanceKm: Math.round(monthTrips.reduce((s, t) => s + t.distanceKm, 0)),
    totalDurationMinutes: monthTrips.reduce((s, t) => s + t.durationMinutes, 0),
    totalDelayMinutes: totalDelay,
    totalCo2SavedKg: monthTrips.reduce((s, t) => s + t.co2SavedKg, 0),
    averageDelay: monthTrips.length ? Math.round(totalDelay / monthTrips.length) : 0,
    onTimePercentage: monthTrips.length ? Math.round((onTime / monthTrips.length) * 100) : 100,
  };
}

export async function getYearlyStats(year: number): Promise<YearlyStats> {
  const trips = await getTrips();
  const yearTrips = trips.filter(t => new Date(t.createdAt).getFullYear() === year);

  const monthly: MonthlyStats[] = [];
  for (let m = 0; m < 12; m++) {
    const s = await getMonthlyStats(year, m);
    if (s.totalTrips > 0) monthly.push(s);
  }

  const routes: Record<string, number> = {};
  yearTrips.forEach(t => {
    const r = `${t.originStation} → ${t.destinationStation}`;
    routes[r] = (routes[r] || 0) + 1;
  });

  return {
    year,
    totalTrips: yearTrips.length,
    totalDistanceKm: Math.round(yearTrips.reduce((s, t) => s + t.distanceKm, 0)),
    totalDurationMinutes: yearTrips.reduce((s, t) => s + t.durationMinutes, 0),
    totalDelayMinutes: yearTrips.reduce((s, t) => s + t.delayMinutes, 0),
    totalCo2SavedKg: yearTrips.reduce((s, t) => s + t.co2SavedKg, 0),
    longestTrip: yearTrips.length ? yearTrips.reduce((m, t) => t.distanceKm > m.distanceKm ? t : m) : undefined,
    mostDelayedTrip: yearTrips.length ? yearTrips.reduce((m, t) => t.delayMinutes > m.delayMinutes ? t : m) : undefined,
    mostUsedRoute: Object.entries(routes).sort(([, a], [, b]) => b - a)[0]?.[0],
    monthlyBreakdown: monthly,
  };
}

export async function getAllTimeStats() {
  const trips = await getTrips();
  return {
    totalTrips: trips.length,
    totalDistanceKm: Math.round(trips.reduce((s, t) => s + t.distanceKm, 0)),
    totalDurationMinutes: trips.reduce((s, t) => s + t.durationMinutes, 0),
    totalCo2SavedKg: trips.reduce((s, t) => s + t.co2SavedKg, 0),
    totalDelayMinutes: trips.reduce((s, t) => s + t.delayMinutes, 0),
  };
}

// === ACHIEVEMENT FUNKTIONEN ===

const ACHIEVEMENT_DEFS = [
  { id: 'first_trip', name: 'Erste Fahrt', description: 'Deine erste Bahnfahrt!', icon: '🚂', target: 1 },
  { id: 'trips_10', name: 'Pendler', description: '10 Fahrten', icon: '🎫', target: 10 },
  { id: 'trips_50', name: 'Vielfahrer', description: '50 Fahrten', icon: '🏆', target: 50 },
  { id: 'km_1000', name: '1.000 km Club', description: '1.000 km gefahren', icon: '🌍', target: 1000 },
  { id: 'km_5000', name: '5.000 km Club', description: '5.000 km gefahren', icon: '🌏', target: 5000 },
  { id: 'co2_100', name: 'Klimafreund', description: '100 kg CO₂ gespart', icon: '🌱', target: 100 },
  { id: 'delay_survivor', name: 'Verspätungs-Survivor', description: '60+ min Verspätung', icon: '⏰', target: 60 },
  { id: 'long_distance', name: 'Langstrecke', description: 'Eine Fahrt über 500 km', icon: '🛤️', target: 500 },
];

async function checkAchievements(trips: Trip[]) {
  const achievements = await getAchievements();
  const stats = {
    totalTrips: trips.length,
    totalKm: trips.reduce((s, t) => s + t.distanceKm, 0),
    totalCo2: trips.reduce((s, t) => s + t.co2SavedKg, 0),
    maxDelay: Math.max(...trips.map(t => t.delayMinutes), 0),
    maxDist: Math.max(...trips.map(t => t.distanceKm), 0),
  };

  const checks: Record<string, { c: number; t: number }> = {
    first_trip: { c: stats.totalTrips, t: 1 },
    trips_10: { c: stats.totalTrips, t: 10 },
    trips_50: { c: stats.totalTrips, t: 50 },
    km_1000: { c: stats.totalKm, t: 1000 },
    km_5000: { c: stats.totalKm, t: 5000 },
    co2_100: { c: stats.totalCo2, t: 100 },
    delay_survivor: { c: stats.maxDelay, t: 60 },
    long_distance: { c: stats.maxDist, t: 500 },
  };

  const now = new Date().toISOString();
  for (const [id, { c, t }] of Object.entries(checks)) {
    const i = achievements.findIndex(a => a.id === id);
    const def = ACHIEVEMENT_DEFS.find(a => a.id === id)!;
    if (i >= 0) {
      achievements[i].progress = c;
      if (!achievements[i].unlockedAt && c >= t) achievements[i].unlockedAt = now;
    } else {
      achievements.push({ ...def, progress: c, unlockedAt: c >= t ? now : undefined });
    }
  }

  await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));

  // Sync zu Supabase (wenn konfiguriert)
  if (isSupabaseConfigured()) {
    try {
      const deviceId = await getDeviceId();
      for (const achievement of achievements) {
        await supabase.from('achievements').upsert({
          device_id: deviceId,
          achievement_id: achievement.id,
          progress: achievement.progress,
          unlocked_at: achievement.unlockedAt,
        }, { onConflict: 'device_id,achievement_id' });
      }
    } catch (error) {
      console.warn('Achievement sync failed:', error);
    }
  }
}

export async function getAchievements(): Promise<Achievement[]> {
  const data = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
  if (data) return JSON.parse(data);
  return ACHIEVEMENT_DEFS.map(d => ({ ...d, progress: 0, unlockedAt: undefined }));
}
