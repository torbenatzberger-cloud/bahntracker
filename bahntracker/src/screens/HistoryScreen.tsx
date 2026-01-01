import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Trip } from '../types';
import { getTrips, deleteTrip } from '../services/storage';
import { colors, spacing, borderRadius, typography, getTrainTypeColor, getDelayColor } from '../theme';

export default function HistoryScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrips = useCallback(async () => {
    setTrips(await getTrips());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTrips();
    setRefreshing(false);
  };

  const handleDelete = (t: Trip) =>
    Alert.alert('Fahrt löschen?', `${t.trainName}: ${t.originStation} → ${t.destinationStation}`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          await deleteTrip(t.id);
          loadTrips();
        },
      },
    ]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const formatTime = (d?: string) =>
    d ? new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  const formatDuration = (m: number) => {
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}min` : `${m}min`;
  };

  // Gruppiere nach Datum
  const grouped = trips.reduce((g, t) => {
    const d = formatDate(t.createdAt);
    (g[d] = g[d] || []).push(t);
    return g;
  }, {} as Record<string, Trip[]>);

  const sections = Object.entries(grouped).map(([date, data]) => ({
    date,
    data,
    totalKm: Math.round(data.reduce((s, t) => s + t.distanceKm, 0)),
    totalCo2: data.reduce((s, t) => s + t.co2SavedKg, 0).toFixed(1),
  }));

  const renderTripCard = (trip: Trip) => (
    <TouchableOpacity
      key={trip.id}
      style={styles.tripCard}
      onLongPress={() => handleDelete(trip)}
      activeOpacity={0.7}
    >
      <View style={styles.tripHeader}>
        <View style={styles.trainInfo}>
          <View style={[styles.trainBadge, { backgroundColor: getTrainTypeColor(trip.trainType) }]}>
            <Text style={styles.trainBadgeText}>{trip.trainType}</Text>
          </View>
          <Text style={styles.trainNumber}>{trip.trainName}</Text>
        </View>
        {trip.delayMinutes > 0 && (
          <View style={[styles.delayBadge, { backgroundColor: `${getDelayColor(trip.delayMinutes)}20` }]}>
            <Text style={[styles.delayText, { color: getDelayColor(trip.delayMinutes) }]}>
              +{trip.delayMinutes} min
            </Text>
          </View>
        )}
      </View>

      <View style={styles.tripRoute}>
        <View style={styles.routeStation}>
          <View style={styles.routeDotStart} />
          <View style={styles.routeStationInfo}>
            <Text style={styles.stationName} numberOfLines={1}>
              {trip.originStation}
            </Text>
            <Text style={styles.stationTime}>{formatTime(trip.departureActual)}</Text>
          </View>
        </View>
        <View style={styles.routeConnector}>
          <View style={styles.routeLine} />
          <Text style={styles.routeDuration}>{formatDuration(trip.durationMinutes)}</Text>
        </View>
        <View style={styles.routeStation}>
          <View style={styles.routeDotEnd} />
          <View style={styles.routeStationInfo}>
            <Text style={styles.stationName} numberOfLines={1}>
              {trip.destinationStation}
            </Text>
            <Text style={styles.stationTime}>{formatTime(trip.arrivalActual)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.tripStats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(trip.distanceKm)}</Text>
          <Text style={styles.statLabel}>km</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, styles.statValueGreen]}>{trip.co2SavedKg.toFixed(1)}</Text>
          <Text style={styles.statLabel}>kg CO₂</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSection = ({ item: section }: { item: typeof sections[0] }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionDate}>{section.date}</Text>
        <View style={styles.sectionStatsContainer}>
          <Text style={styles.sectionStats}>
            {section.data.length} {section.data.length === 1 ? 'Fahrt' : 'Fahrten'}
          </Text>
          <View style={styles.sectionStatsDot} />
          <Text style={styles.sectionStats}>{section.totalKm} km</Text>
        </View>
      </View>
      {section.data.map(renderTripCard)}
    </View>
  );

  if (trips.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Fahrten</Text>
          <Text style={styles.headerSubtitle}>Dein Fahrtenverlauf</Text>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIcon}>
            <Text style={styles.emptyStateEmoji}>🚂</Text>
          </View>
          <Text style={styles.emptyStateTitle}>Noch keine Fahrten</Text>
          <Text style={styles.emptyStateText}>
            Tracke deine erste Zugfahrt und sie erscheint hier.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fahrten</Text>
        <Text style={styles.headerSubtitle}>{trips.length} Fahrten gespeichert</Text>
      </View>

      <FlatList
        data={sections}
        keyExtractor={(item) => item.date}
        renderItem={renderSection}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text.secondary}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 100,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionDate: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  sectionStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionStats: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  sectionStatsDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.tertiary,
    marginHorizontal: spacing.sm,
  },
  tripCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  trainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trainBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  trainBadgeText: {
    color: '#fff',
    ...typography.badge,
  },
  trainNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  delayBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: borderRadius.sm,
  },
  delayText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tripRoute: {
    marginBottom: spacing.md,
  },
  routeStation: {
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
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent.green,
    marginRight: spacing.md,
  },
  routeDotEnd: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
  stationTime: {
    fontSize: 14,
    color: colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  routeConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
    paddingVertical: spacing.xs,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: colors.border.default,
  },
  routeDuration: {
    marginLeft: spacing.lg,
    fontSize: 12,
    color: colors.text.tertiary,
  },
  tripStats: {
    flexDirection: 'row',
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginRight: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  statValueGreen: {
    color: colors.accent.green,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border.default,
    marginHorizontal: spacing.lg,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  emptyStateEmoji: {
    fontSize: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
