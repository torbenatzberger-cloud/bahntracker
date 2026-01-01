import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, SafeAreaView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { searchTrainByNumber } from '../services/transportApi';
import { TrainJourney } from '../types';

export default function HomeScreen({ navigation }: any) {
  const [trainNumber, setTrainNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TrainJourney[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!trainNumber.trim()) { Alert.alert('Fehler', 'Bitte Zugnummer eingeben'); return; }
    setLoading(true); setError(null); setSearched(true);
    try {
      const journeys = await searchTrainByNumber(trainNumber);
      setResults(journeys);
      if (journeys.length === 0) setError('Kein Zug gefunden. Versuche "ICE 123" oder nur "123".');
      else if (journeys.length === 1) navigation.navigate('TripDetail', { journey: journeys[0] });
    } catch { setError('Fehler bei der Suche.'); }
    finally { setLoading(false); }
  }, [trainNumber, navigation]);

  const formatTime = (d?: string) => d ? new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🚄 BahnTracker</Text>
          <Text style={styles.headerSubtitle}>Tracke deine Zugfahrten</Text>
        </View>
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Zugnummer eingeben</Text>
          <View style={styles.inputRow}>
            <TextInput style={styles.input} value={trainNumber} onChangeText={setTrainNumber} placeholder="z.B. ICE 123" placeholderTextColor="#94a3b8" autoCapitalize="characters" returnKeyType="search" onSubmitEditing={handleSearch} />
            <TouchableOpacity style={[styles.searchButton, loading && styles.searchButtonDisabled]} onPress={handleSearch} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchButtonText}>Suchen</Text>}
            </TouchableOpacity>
          </View>
          <View style={styles.quickButtons}>
            {['ICE', 'IC', 'RE', 'RB'].map(t => <TouchableOpacity key={t} style={styles.quickButton} onPress={() => setTrainNumber(t + ' ')}><Text style={styles.quickButtonText}>{t}</Text></TouchableOpacity>)}
          </View>
        </View>
        <View style={styles.resultsSection}>
          {error && <View style={styles.errorContainer}><Text style={styles.errorText}>{error}</Text></View>}
          {results.length > 1 && <Text style={styles.resultsTitle}>{results.length} Züge gefunden:</Text>}
          <FlatList data={results} keyExtractor={i => i.tripId} renderItem={({ item }) => (
            <TouchableOpacity style={styles.journeyCard} onPress={() => navigation.navigate('TripDetail', { journey: item })}>
              <View style={styles.journeyHeader}><View style={styles.trainBadge}><Text style={styles.trainBadgeText}>{item.trainType}</Text></View><Text style={styles.trainName}>{item.trainName}</Text></View>
              <View style={styles.journeyRoute}>
                <View style={styles.routePoint}><View style={styles.routeDot} /><Text style={styles.stationName} numberOfLines={1}>{item.origin.station.name}</Text><Text style={styles.routeTime}>{formatTime(item.origin.departure)}</Text></View>
                <View style={styles.routeLine} />
                <View style={styles.routePoint}><View style={[styles.routeDot, styles.routeDotEnd]} /><Text style={styles.stationName} numberOfLines={1}>{item.destination.station.name}</Text><Text style={styles.routeTime}>{formatTime(item.destination.arrival)}</Text></View>
              </View>
            </TouchableOpacity>
          )} />
        </View>
        {!searched && <View style={styles.tipsSection}><Text style={styles.tipsTitle}>💡 Tipps</Text><Text style={styles.tipsText}>• Die Zugnummer findest du auf deinem Ticket{'\n'}• Du kannst "ICE 579" oder nur "579" eingeben</Text></View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  keyboardView: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: '#f8fafc', letterSpacing: -1 },
  headerSubtitle: { fontSize: 16, color: '#64748b', marginTop: 4 },
  inputSection: { paddingHorizontal: 20, paddingVertical: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  inputRow: { flexDirection: 'row', gap: 12 },
  input: { flex: 1, height: 56, backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 16, fontSize: 18, color: '#f8fafc', fontWeight: '600', borderWidth: 2, borderColor: '#334155' },
  searchButton: { height: 56, paddingHorizontal: 24, backgroundColor: '#dc2626', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  searchButtonDisabled: { backgroundColor: '#7f1d1d' },
  searchButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  quickButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  quickButton: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#1e293b', borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  quickButtonText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  resultsSection: { flex: 1, paddingHorizontal: 20 },
  resultsTitle: { fontSize: 14, color: '#64748b', marginBottom: 12 },
  journeyCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  journeyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  trainBadge: { backgroundColor: '#dc2626', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, marginRight: 10 },
  trainBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  trainName: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  journeyRoute: { marginLeft: 8 },
  routePoint: { flexDirection: 'row', alignItems: 'center' },
  routeDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22c55e', marginRight: 12 },
  routeDotEnd: { backgroundColor: '#ef4444' },
  stationName: { flex: 1, fontSize: 15, color: '#e2e8f0', fontWeight: '500' },
  routeTime: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  routeLine: { width: 2, height: 20, backgroundColor: '#334155', marginLeft: 5, marginVertical: 4 },
  errorContainer: { backgroundColor: '#7f1d1d', padding: 16, borderRadius: 12, marginBottom: 16 },
  errorText: { color: '#fecaca', fontSize: 14, textAlign: 'center' },
  tipsSection: { paddingHorizontal: 20, paddingBottom: 20 },
  tipsTitle: { fontSize: 16, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  tipsText: { fontSize: 14, color: '#64748b', lineHeight: 22 },
});
