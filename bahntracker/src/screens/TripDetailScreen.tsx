import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { TrainJourney, Trip } from '../types';
import { calculateRailDistance, calculateDuration } from '../services/distanceApi';
import { calculateCo2Saved } from '../utils/co2';
import { saveTrip } from '../services/storage';

export default function TripDetailScreen({ route, navigation }: any) {
  const { journey } = route.params as { journey: TrainJourney };
  const [originIndex, setOriginIndex] = useState<number | null>(null);
  const [destinationIndex, setDestinationIndex] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLocationLoading(false); return; }
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        let closestIndex = 0, closestDist = Infinity;
        journey.stops.forEach((stop, i) => {
          if (stop.station.location) {
            const d = Math.sqrt(Math.pow(stop.station.location.latitude - location.coords.latitude, 2) + Math.pow(stop.station.location.longitude - location.coords.longitude, 2));
            if (d < closestDist) { closestDist = d; closestIndex = i; }
          }
        });
        if (closestDist < 0.05) setOriginIndex(closestIndex);
      } catch (e) { console.warn('Location error:', e); }
      finally { setLocationLoading(false); }
    })();
  }, [journey.stops]);

  useEffect(() => {
    if (originIndex !== null && destinationIndex !== null) {
      const o = journey.stops[originIndex], d = journey.stops[destinationIndex];
      if (o.station.location && d.station.location) calculateRailDistance(o.station.location, d.station.location).then(setCalculatedDistance);
    }
  }, [originIndex, destinationIndex, journey.stops]);

  const handleStopSelect = (i: number) => {
    if (originIndex === null) setOriginIndex(i);
    else if (destinationIndex === null) { if (i > originIndex) setDestinationIndex(i); else if (i < originIndex) { setDestinationIndex(originIndex); setOriginIndex(i); } else { setOriginIndex(null); setDestinationIndex(null); } }
    else { setOriginIndex(i); setDestinationIndex(null); }
  };

  const tripDetails = useMemo(() => {
    if (originIndex === null || destinationIndex === null) return null;
    const o = journey.stops[originIndex], d = journey.stops[destinationIndex];
    const dep = o.departure || o.plannedDeparture || '', arr = d.arrival || d.plannedArrival || '';
    const dur = dep && arr ? calculateDuration(dep, arr) : 0;
    const delay = Math.round(Math.max(d.arrivalDelay || 0, o.departureDelay || 0) / 60);
    return { origin: o, destination: d, departure: dep, arrival: arr, durationMinutes: dur, delayMinutes: delay, distanceKm: calculatedDistance || 0 };
  }, [originIndex, destinationIndex, journey.stops, calculatedDistance]);

  const handleSaveTrip = async () => {
    if (!tripDetails) return;
    setSaving(true);
    try {
      const co2 = calculateCo2Saved(tripDetails.distanceKm);
      const trip: Trip = { id: `${Date.now()}-${Math.random().toString(36).substr(2,9)}`, tripId: journey.tripId, trainNumber: journey.trainNumber, trainType: journey.trainType, trainName: journey.trainName, originStation: tripDetails.origin.station.name, originStationId: tripDetails.origin.station.id, destinationStation: tripDetails.destination.station.name, destinationStationId: tripDetails.destination.station.id, departurePlanned: tripDetails.origin.plannedDeparture || tripDetails.departure, departureActual: tripDetails.departure, arrivalPlanned: tripDetails.destination.plannedArrival || tripDetails.arrival, arrivalActual: tripDetails.arrival, delayMinutes: tripDetails.delayMinutes, distanceKm: tripDetails.distanceKm, durationMinutes: tripDetails.durationMinutes, co2SavedKg: co2, createdAt: new Date().toISOString() };
      await saveTrip(trip);
      Alert.alert('✅ Gespeichert!', `${tripDetails.distanceKm} km • ${co2.toFixed(1)} kg CO₂ gespart`, [{ text: 'Übersicht', onPress: () => navigation.navigate('History') }, { text: 'Neue Fahrt', onPress: () => navigation.popToTop() }]);
    } catch { Alert.alert('Fehler', 'Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  };

  const formatTime = (d?: string) => d ? new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '--:--';
  const getStatus = (i: number) => { if (originIndex === i) return 'origin'; if (destinationIndex === i) return 'destination'; if (originIndex !== null && destinationIndex !== null && i > originIndex && i < destinationIndex) return 'between'; return 'normal'; };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><Text style={styles.backButtonText}>← Zurück</Text></TouchableOpacity>
        <View style={styles.trainInfo}><View style={styles.trainBadge}><Text style={styles.trainBadgeText}>{journey.trainType}</Text></View><Text style={styles.trainName}>{journey.trainName}</Text></View>
        <Text style={styles.headerHint}>{originIndex === null ? '1️⃣ Wähle Startbahnhof' : destinationIndex === null ? '2️⃣ Wähle Ziel' : '✅ Bereit zum Speichern'}</Text>
      </View>
      <ScrollView style={styles.stopsContainer}>
        {locationLoading && <View style={styles.locationBanner}><ActivityIndicator color="#3b82f6" size="small" /><Text style={styles.locationText}>Standort wird ermittelt...</Text></View>}
        {journey.stops.map((stop, i) => {
          const status = getStatus(i);
          const delay = Math.round((stop.departureDelay || stop.arrivalDelay || 0) / 60);
          return (
            <TouchableOpacity key={`${stop.station.id}-${i}`} style={[styles.stopItem, status === 'origin' && styles.stopItemOrigin, status === 'destination' && styles.stopItemDestination, status === 'between' && styles.stopItemBetween]} onPress={() => handleStopSelect(i)}>
              <View style={styles.stopTimeline}>
                <View style={[styles.stopDot, status === 'origin' && styles.stopDotOrigin, status === 'destination' && styles.stopDotDestination, status === 'between' && styles.stopDotBetween]} />
                {i < journey.stops.length - 1 && <View style={[styles.stopLine, (status === 'origin' || status === 'between') && destinationIndex !== null && i < destinationIndex && styles.stopLineActive]} />}
              </View>
              <View style={styles.stopContent}>
                <Text style={[styles.stopName, (status === 'origin' || status === 'destination') && styles.stopNameSelected]} numberOfLines={1}>{stop.station.name}</Text>
                <View style={styles.stopTimes}>
                  {stop.arrival && <Text style={styles.stopTime}>an {formatTime(stop.arrival)}</Text>}
                  {stop.departure && <Text style={styles.stopTime}>ab {formatTime(stop.departure)}</Text>}
                  {delay > 0 && <Text style={styles.stopDelay}>+{delay}</Text>}
                </View>
              </View>
              {stop.platform && <View style={styles.platformBadge}><Text style={styles.platformText}>Gl. {stop.platform}</Text></View>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {tripDetails && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}><Text style={styles.summaryValue}>{tripDetails.distanceKm || '...'}</Text><Text style={styles.summaryLabel}>km</Text></View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}><Text style={styles.summaryValue}>{tripDetails.durationMinutes}</Text><Text style={styles.summaryLabel}>min</Text></View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}><Text style={[styles.summaryValue, tripDetails.delayMinutes > 0 && styles.summaryValueDelay]}>{tripDetails.delayMinutes > 0 ? `+${tripDetails.delayMinutes}` : '0'}</Text><Text style={styles.summaryLabel}>Versp.</Text></View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}><Text style={[styles.summaryValue, styles.summaryValueCo2]}>{tripDetails.distanceKm ? calculateCo2Saved(tripDetails.distanceKm).toFixed(1) : '...'}</Text><Text style={styles.summaryLabel}>kg CO₂</Text></View>
          </View>
          <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSaveTrip} disabled={saving || !tripDetails.distanceKm}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveButtonText}>Fahrt speichern</Text>}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backButton: { marginBottom: 12 },
  backButtonText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  trainInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  trainBadge: { backgroundColor: '#dc2626', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, marginRight: 10 },
  trainBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  trainName: { fontSize: 20, fontWeight: '700', color: '#f8fafc' },
  headerHint: { fontSize: 14, color: '#64748b' },
  stopsContainer: { flex: 1, paddingHorizontal: 20 },
  locationBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e3a5f', padding: 12, borderRadius: 8, marginTop: 12, marginBottom: 8 },
  locationText: { color: '#93c5fd', marginLeft: 10, fontSize: 14 },
  stopItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 12, marginHorizontal: -12, borderRadius: 8 },
  stopItemOrigin: { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
  stopItemDestination: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  stopItemBetween: { backgroundColor: 'rgba(59, 130, 246, 0.1)' },
  stopTimeline: { alignItems: 'center', width: 24, marginRight: 12 },
  stopDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#475569', borderWidth: 3, borderColor: '#1e293b' },
  stopDotOrigin: { backgroundColor: '#22c55e', borderColor: '#166534' },
  stopDotDestination: { backgroundColor: '#ef4444', borderColor: '#991b1b' },
  stopDotBetween: { backgroundColor: '#3b82f6', borderColor: '#1e40af' },
  stopLine: { width: 2, height: 40, backgroundColor: '#334155', marginTop: 4 },
  stopLineActive: { backgroundColor: '#3b82f6' },
  stopContent: { flex: 1 },
  stopName: { fontSize: 16, color: '#e2e8f0', fontWeight: '500', marginBottom: 2 },
  stopNameSelected: { fontWeight: '700', color: '#f8fafc' },
  stopTimes: { flexDirection: 'row', gap: 12 },
  stopTime: { fontSize: 13, color: '#64748b' },
  stopDelay: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
  platformBadge: { backgroundColor: '#334155', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
  platformText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  summaryContainer: { padding: 20, backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155' },
  summaryStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  summaryStat: { alignItems: 'center' },
  summaryValue: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  summaryValueDelay: { color: '#ef4444' },
  summaryValueCo2: { color: '#22c55e' },
  summaryLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  summaryDivider: { width: 1, height: 40, backgroundColor: '#334155' },
  saveButton: { backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: '#7f1d1d' },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
