import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Trip } from '../types';
import { getTrips, deleteTrip } from '../services/storage';

export default function HistoryScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const loadTrips = useCallback(async () => { setTrips(await getTrips()); }, []);
  useFocusEffect(useCallback(() => { loadTrips(); }, [loadTrips]));
  const handleRefresh = async () => { setRefreshing(true); await loadTrips(); setRefreshing(false); };
  const handleDelete = (t: Trip) => Alert.alert('Löschen?', `${t.trainName}: ${t.originStation} → ${t.destinationStation}`, [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Löschen', style: 'destructive', onPress: async () => { await deleteTrip(t.id); loadTrips(); } }]);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatTime = (d?: string) => d ? new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '--:--';
  const formatDuration = (m: number) => { const h = Math.floor(m / 60); return h > 0 ? `${h}h ${m % 60}min` : `${m}min`; };
  const getBadgeStyle = (t: string) => ({ backgroundColor: t === 'ICE' ? '#dc2626' : t === 'IC' || t === 'EC' ? '#9333ea' : t === 'RE' || t === 'RB' ? '#2563eb' : '#475569' });
  const grouped = trips.reduce((g, t) => { const d = formatDate(t.createdAt); (g[d] = g[d] || []).push(t); return g; }, {} as Record<string, Trip[]>);
  const sections = Object.entries(grouped).map(([date, data]) => ({ date, data, totalKm: data.reduce((s, t) => s + t.distanceKm, 0) }));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>📋 Fahrten</Text><Text style={styles.headerSubtitle}>{trips.length} Fahrten gespeichert</Text></View>
      {trips.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyStateEmoji}>🚂</Text><Text style={styles.emptyStateTitle}>Noch keine Fahrten</Text><Text style={styles.emptyStateText}>Tracke deine erste Zugfahrt!</Text></View> : (
        <FlatList data={sections} keyExtractor={i => i.date} contentContainerStyle={styles.listContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#64748b" />} renderItem={({ item: section }) => (
          <View style={styles.section}>
            <View style={styles.sectionHeader}><Text style={styles.sectionDate}>{section.date}</Text><Text style={styles.sectionStats}>{section.data.length} Fahrten • {section.totalKm} km</Text></View>
            {section.data.map(trip => (
              <TouchableOpacity key={trip.id} style={styles.tripCard} onLongPress={() => handleDelete(trip)}>
                <View style={styles.tripHeader}><View style={styles.trainInfo}><View style={[styles.trainBadge, getBadgeStyle(trip.trainType)]}><Text style={styles.trainBadgeText}>{trip.trainType}</Text></View><Text style={styles.trainNumber}>{trip.trainName}</Text></View>{trip.delayMinutes > 0 && <View style={styles.delayBadge}><Text style={styles.delayText}>+{trip.delayMinutes}</Text></View>}</View>
                <View style={styles.tripRoute}>
                  <View style={styles.routeStation}><View style={styles.routeDotStart} /><View style={styles.routeStationInfo}><Text style={styles.stationName} numberOfLines={1}>{trip.originStation}</Text><Text style={styles.stationTime}>{formatTime(trip.departureActual)}</Text></View></View>
                  <View style={styles.routeConnector}><View style={styles.routeLine} /><Text style={styles.routeDuration}>{formatDuration(trip.durationMinutes)}</Text></View>
                  <View style={styles.routeStation}><View style={styles.routeDotEnd} /><View style={styles.routeStationInfo}><Text style={styles.stationName} numberOfLines={1}>{trip.destinationStation}</Text><Text style={styles.stationTime}>{formatTime(trip.arrivalActual)}</Text></View></View>
                </View>
                <View style={styles.tripStats}><View style={styles.stat}><Text style={styles.statValue}>{trip.distanceKm}</Text><Text style={styles.statLabel}>km</Text></View><View style={styles.statDivider} /><View style={styles.stat}><Text style={[styles.statValue, styles.statValueGreen]}>{trip.co2SavedKg.toFixed(1)}</Text><Text style={styles.statLabel}>kg CO₂</Text></View></View>
              </TouchableOpacity>
            ))}
          </View>
        )} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#f8fafc' },
  headerSubtitle: { fontSize: 15, color: '#64748b', marginTop: 4 },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionDate: { fontSize: 14, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' },
  sectionStats: { fontSize: 13, color: '#64748b' },
  tripCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  trainInfo: { flexDirection: 'row', alignItems: 'center' },
  trainBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4, marginRight: 8 },
  trainBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  trainNumber: { fontSize: 16, fontWeight: '600', color: '#f8fafc' },
  delayBadge: { backgroundColor: 'rgba(239, 68, 68, 0.2)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
  delayText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
  tripRoute: { marginBottom: 14 },
  routeStation: { flexDirection: 'row', alignItems: 'center' },
  routeStationInfo: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeDotStart: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e', marginRight: 12 },
  routeDotEnd: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', marginRight: 12 },
  stationName: { flex: 1, fontSize: 15, color: '#e2e8f0', fontWeight: '500', marginRight: 12 },
  stationTime: { fontSize: 14, color: '#64748b' },
  routeConnector: { flexDirection: 'row', alignItems: 'center', marginLeft: 4, paddingVertical: 6 },
  routeLine: { width: 2, height: 24, backgroundColor: '#334155' },
  routeDuration: { marginLeft: 16, fontSize: 12, color: '#64748b' },
  tripStats: { flexDirection: 'row', backgroundColor: '#0f172a', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginRight: 4 },
  statValueGreen: { color: '#22c55e' },
  statLabel: { fontSize: 12, color: '#64748b' },
  statDivider: { width: 1, height: 20, backgroundColor: '#334155', marginHorizontal: 16 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyStateEmoji: { fontSize: 64, marginBottom: 16 },
  emptyStateTitle: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  emptyStateText: { fontSize: 15, color: '#64748b', textAlign: 'center' },
});
