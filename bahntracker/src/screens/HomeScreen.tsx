import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { searchTrainByNumber } from '../services/transportApi';
import { TrainJourney } from '../types';
import { colors, spacing, borderRadius, typography, getTrainTypeColor } from '../theme';

export default function HomeScreen({ navigation }: any) {
  const [trainNumber, setTrainNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TrainJourney[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!trainNumber.trim()) {
      Alert.alert('Fehler', 'Bitte Zugnummer eingeben');
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const journeys = await searchTrainByNumber(trainNumber);
      setResults(journeys);
      if (journeys.length === 0) {
        setError('Kein Zug gefunden. Versuche "ICE 123" oder nur "123".');
      } else if (journeys.length === 1) {
        navigation.navigate('TripDetail', { journey: journeys[0] });
      }
    } catch {
      setError('Fehler bei der Suche.');
    } finally {
      setLoading(false);
    }
  }, [trainNumber, navigation]);

  const formatTime = (d?: string) =>
    d ? new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  const renderJourneyCard = ({ item }: { item: TrainJourney }) => (
    <TouchableOpacity
      style={styles.journeyCard}
      onPress={() => navigation.navigate('TripDetail', { journey: item })}
      activeOpacity={0.7}
    >
      <View style={styles.journeyHeader}>
        <View style={[styles.trainBadge, { backgroundColor: getTrainTypeColor(item.trainType) }]}>
          <Text style={styles.trainBadgeText}>{item.trainType}</Text>
        </View>
        <Text style={styles.trainName}>{item.trainName}</Text>
        <Text style={styles.directionText}>{item.direction}</Text>
      </View>
      <View style={styles.journeyRoute}>
        <View style={styles.routePoint}>
          <View style={styles.routeDotStart} />
          <View style={styles.routeStationInfo}>
            <Text style={styles.stationName} numberOfLines={1}>
              {item.origin.station.name}
            </Text>
            <Text style={styles.routeTime}>{formatTime(item.origin.departure)}</Text>
          </View>
        </View>
        <View style={styles.routeConnector}>
          <View style={styles.routeLine} />
        </View>
        <View style={styles.routePoint}>
          <View style={styles.routeDotEnd} />
          <View style={styles.routeStationInfo}>
            <Text style={styles.stationName} numberOfLines={1}>
              {item.destination.station.name}
            </Text>
            <Text style={styles.routeTime}>{formatTime(item.destination.arrival)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>BahnTracker</Text>
          <Text style={styles.headerSubtitle}>Tracke deine Zugfahrten</Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>ZUGNUMMER</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={trainNumber}
              onChangeText={setTrainNumber}
              placeholder="z.B. ICE 123"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity
              style={[styles.searchButton, loading && styles.searchButtonDisabled]}
              onPress={handleSearch}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.searchButtonText}>Suchen</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.quickButtons}>
            {['ICE', 'IC', 'RE', 'RB'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.quickButton, { borderColor: getTrainTypeColor(type) }]}
                onPress={() => setTrainNumber(type + ' ')}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickButtonText, { color: getTrainTypeColor(type) }]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.resultsSection}>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {results.length > 1 && (
            <Text style={styles.resultsTitle}>{results.length} Verbindungen gefunden</Text>
          )}

          <FlatList
            data={results}
            keyExtractor={(item) => item.tripId}
            renderItem={renderJourneyCard}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        </View>

        {!searched && (
          <View style={styles.tipsSection}>
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>So funktioniert's</Text>
              <View style={styles.tipItem}>
                <Text style={styles.tipBullet}>1</Text>
                <Text style={styles.tipText}>Zugnummer vom Ticket eingeben</Text>
              </View>
              <View style={styles.tipItem}>
                <Text style={styles.tipBullet}>2</Text>
                <Text style={styles.tipText}>Start- und Zielbahnhof wählen</Text>
              </View>
              <View style={styles.tipItem}>
                <Text style={styles.tipBullet}>3</Text>
                <Text style={styles.tipText}>Fahrt speichern und Statistiken sehen</Text>
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  inputSection: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  input: {
    flex: 1,
    height: 56,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
    color: colors.text.primary,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  searchButton: {
    height: 56,
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.accent.blue,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: colors.background.tertiary,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  quickButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  quickButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  resultsSection: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  resultsTitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  journeyCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  journeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  trainBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  trainBadgeText: {
    color: '#fff',
    ...typography.badge,
  },
  trainName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  directionText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  journeyRoute: {
    marginLeft: spacing.xs,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeStationInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeDotStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent.green,
    marginRight: spacing.md,
  },
  routeDotEnd: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent.red,
    marginRight: spacing.md,
  },
  stationName: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '500',
    marginRight: spacing.md,
  },
  routeTime: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  routeConnector: {
    marginLeft: 5,
    paddingVertical: spacing.xs,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: colors.border.default,
  },
  errorContainer: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(248, 81, 73, 0.3)',
  },
  errorText: {
    color: colors.accent.red,
    fontSize: 14,
    textAlign: 'center',
  },
  tipsSection: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  tipsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  tipBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent.blue,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  tipText: {
    fontSize: 14,
    color: colors.text.secondary,
    flex: 1,
  },
});
