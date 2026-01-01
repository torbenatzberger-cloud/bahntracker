import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip, MonthlyStats, YearlyStats, Achievement } from '../types';

const TRIPS_KEY = 'bahntracker_trips';
const ACHIEVEMENTS_KEY = 'bahntracker_achievements';

export async function saveTrip(trip: Trip): Promise<void> {
  const trips = await getTrips();
  trips.unshift(trip);
  await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
  await checkAchievements(trips);
}

export async function getTrips(): Promise<Trip[]> {
  const data = await AsyncStorage.getItem(TRIPS_KEY);
  return data ? JSON.parse(data) : [];
}

export async function deleteTrip(tripId: string): Promise<void> {
  const trips = await getTrips();
  await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(trips.filter(t => t.id !== tripId)));
}

export async function getMonthlyStats(year: number, month: number): Promise<MonthlyStats> {
  const trips = await getTrips();
  const monthTrips = trips.filter(t => { const d = new Date(t.createdAt); return d.getFullYear() === year && d.getMonth() === month; });
  const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const totalDelay = monthTrips.reduce((s,t) => s + t.delayMinutes, 0);
  const onTime = monthTrips.filter(t => t.delayMinutes <= 5).length;
  return { month: months[month], year, totalTrips: monthTrips.length, totalDistanceKm: monthTrips.reduce((s,t) => s + t.distanceKm, 0), totalDurationMinutes: monthTrips.reduce((s,t) => s + t.durationMinutes, 0), totalDelayMinutes: totalDelay, totalCo2SavedKg: monthTrips.reduce((s,t) => s + t.co2SavedKg, 0), averageDelay: monthTrips.length ? Math.round(totalDelay / monthTrips.length) : 0, onTimePercentage: monthTrips.length ? Math.round((onTime / monthTrips.length) * 100) : 100 };
}

export async function getYearlyStats(year: number): Promise<YearlyStats> {
  const trips = await getTrips();
  const yearTrips = trips.filter(t => new Date(t.createdAt).getFullYear() === year);
  const monthly: MonthlyStats[] = [];
  for (let m = 0; m < 12; m++) { const s = await getMonthlyStats(year, m); if (s.totalTrips > 0) monthly.push(s); }
  const routes: Record<string,number> = {};
  yearTrips.forEach(t => { const r = `${t.originStation} → ${t.destinationStation}`; routes[r] = (routes[r]||0) + 1; });
  return { year, totalTrips: yearTrips.length, totalDistanceKm: yearTrips.reduce((s,t) => s + t.distanceKm, 0), totalDurationMinutes: yearTrips.reduce((s,t) => s + t.durationMinutes, 0), totalDelayMinutes: yearTrips.reduce((s,t) => s + t.delayMinutes, 0), totalCo2SavedKg: yearTrips.reduce((s,t) => s + t.co2SavedKg, 0), longestTrip: yearTrips.length ? yearTrips.reduce((m,t) => t.distanceKm > m.distanceKm ? t : m) : undefined, mostDelayedTrip: yearTrips.length ? yearTrips.reduce((m,t) => t.delayMinutes > m.delayMinutes ? t : m) : undefined, mostUsedRoute: Object.entries(routes).sort(([,a],[,b]) => b-a)[0]?.[0], monthlyBreakdown: monthly };
}

export async function getAllTimeStats() {
  const trips = await getTrips();
  return { totalTrips: trips.length, totalDistanceKm: trips.reduce((s,t) => s + t.distanceKm, 0), totalDurationMinutes: trips.reduce((s,t) => s + t.durationMinutes, 0), totalCo2SavedKg: trips.reduce((s,t) => s + t.co2SavedKg, 0), totalDelayMinutes: trips.reduce((s,t) => s + t.delayMinutes, 0) };
}

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
  const stats = { totalTrips: trips.length, totalKm: trips.reduce((s,t) => s + t.distanceKm, 0), totalCo2: trips.reduce((s,t) => s + t.co2SavedKg, 0), maxDelay: Math.max(...trips.map(t => t.delayMinutes), 0), maxDist: Math.max(...trips.map(t => t.distanceKm), 0) };
  const checks: Record<string,{c:number,t:number}> = { first_trip:{c:stats.totalTrips,t:1}, trips_10:{c:stats.totalTrips,t:10}, trips_50:{c:stats.totalTrips,t:50}, km_1000:{c:stats.totalKm,t:1000}, km_5000:{c:stats.totalKm,t:5000}, co2_100:{c:stats.totalCo2,t:100}, delay_survivor:{c:stats.maxDelay,t:60}, long_distance:{c:stats.maxDist,t:500} };
  const now = new Date().toISOString();
  for (const [id,{c,t}] of Object.entries(checks)) {
    const i = achievements.findIndex(a => a.id === id);
    const def = ACHIEVEMENT_DEFS.find(a => a.id === id)!;
    if (i >= 0) { achievements[i].progress = c; if (!achievements[i].unlockedAt && c >= t) achievements[i].unlockedAt = now; }
    else achievements.push({ ...def, progress: c, unlockedAt: c >= t ? now : undefined });
  }
  await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));
}

export async function getAchievements(): Promise<Achievement[]> {
  const data = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
  if (data) return JSON.parse(data);
  return ACHIEVEMENT_DEFS.map(d => ({ ...d, progress: 0, unlockedAt: undefined }));
}
