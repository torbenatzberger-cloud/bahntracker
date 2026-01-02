import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Trip, TripStop } from '../types';
import { getTrips, deleteTrip, updateTrip } from '../services/storage';
import { calculateDuration } from '../services/distanceApi';
import { calculateCo2Saved } from '../utils/co2';
import { colors, spacing, borderRadius, typography, getTrainTypeColor, getDelayColor, modalStyle } from '../theme';

export default function HistoryScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [selectedOriginIndex, setSelectedOriginIndex] = useState<number>(0);
  const [selectedDestinationIndex, setSelectedDestinationIndex] = useState<number>(0);

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

  // Direktes Löschen ohne Bestätigung
  const handleDelete = async (t: Trip) => {
    // Optimistisches Update: Sofort aus UI entfernen
    setTrips(prev => prev.filter(trip => trip.id !== t.id));

    // Im Hintergrund löschen
    try {
      await deleteTrip(t.id);
    } catch (error) {
      // Bei Fehler: UI zurücksetzen
      loadTrips();
      if (Platform.OS === 'web') {
        window.alert('Konnte die Fahrt nicht löschen. Bitte erneut versuchen.');
      } else {
        Alert.alert('Fehler', 'Konnte die Fahrt nicht löschen. Bitte erneut versuchen.');
      }
    }
  };

  const handleEdit = (trip: Trip) => {
    if (!trip.stops || trip.stops.length < 2) {
      // Alte Trips ohne Stops können nicht bearbeitet werden
      if (Platform.OS === 'web') {
        window.alert('Diese Fahrt kann nicht bearbeitet werden (ältere Version ohne Haltestellen-Daten).');
      } else {
        Alert.alert('Hinweis', 'Diese Fahrt kann nicht bearbeitet werden (ältere Version ohne Haltestellen-Daten).');
      }
      return;
    }
    setEditingTrip(trip);
    setSelectedOriginIndex(trip.originStopIndex ?? 0);
    setSelectedDestinationIndex(trip.destinationStopIndex ?? trip.stops.length - 1);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTrip || !editingTrip.stops) return;

    const stops = editingTrip.stops;
    const origin = stops[selectedOriginIndex];
    const destination = stops[selectedDestinationIndex];

    // Dauer berechnen
    const dep = origin.departure || '';
    const arr = destination.arrival || '';
    const durationMinutes = dep && arr ? calculateDuration(dep, arr) : editingTrip.durationMinutes;

    // Verspätung berechnen (max aus Abfahrt und Ankunft)
    const delayMinutes = Math.round(
      Math.max(destination.arrivalDelay || 0, origin.departureDelay || 0) / 60
    );

    // Distanz: Wir können sie nicht neu berechnen ohne Koordinaten,
    // daher proportional zur Anzahl der Stops schätzen
    const originalStopCount = (editingTrip.destinationStopIndex ?? stops.length - 1) - (editingTrip.originStopIndex ?? 0);
    const newStopCount = selectedDestinationIndex - selectedOriginIndex;
    const distanceKm = originalStopCount > 0
      ? Math.round(editingTrip.distanceKm * (newStopCount / originalStopCount))
      : editingTrip.distanceKm;

    const co2SavedKg = calculateCo2Saved(distanceKm);

    const updatedTrip: Trip = {
      ...editingTrip,
      originStation: origin.stationName,
      originStationId: origin.stationId,
      destinationStation: destination.stationName,
      destinationStationId: destination.stationId,
      departurePlanned: origin.departure || editingTrip.departurePlanned,
      departureActual: origin.departure,
      arrivalPlanned: destination.arrival || editingTrip.arrivalPlanned,
      arrivalActual: destination.arrival,
      delayMinutes,
      distanceKm,
      durationMinutes,
      co2SavedKg,
      originStopIndex: selectedOriginIndex,
      destinationStopIndex: selectedDestinationIndex,
    };

    try {
      await updateTrip(updatedTrip);
      setEditModalVisible(false);
      setEditingTrip(null);
      loadTrips();
    } catch (error) {
      if (Platform.OS === 'web') {
        window.alert('Konnte Fahrt nicht speichern');
      } else {
        Alert.alert('Fehler', 'Konnte Fahrt nicht speichern');
      }
    }
  };

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
      onPress={() => handleEdit(trip)}
      activeOpacity={0.7}
    >
      <View style={styles.tripHeader}>
        <View style={styles.trainInfo}>
          <View style={[styles.trainBadge, { backgroundColor: getTrainTypeColor(trip.trainType) }]}>
            <Text style={styles.trainBadgeText}>{trip.trainType}</Text>
          </View>
          <Text style={styles.trainNumber}>{trip.trainName}</Text>
        </View>
        <View style={styles.tripActions}>
          {trip.delayMinutes > 0 && (
            <View style={[styles.delayBadge, { backgroundColor: `${getDelayColor(trip.delayMinutes)}20` }]}>
              <Text style={[styles.delayText, { color: getDelayColor(trip.delayMinutes) }]}>
                +{trip.delayMinutes} min
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={(e) => {
              e.stopPropagation();
              handleDelete(trip);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.deleteButtonText}>×</Text>
          </TouchableOpacity>
        </View>
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

      {trip.stops && trip.stops.length > 0 && (
        <Text style={styles.editHint}>Tippen zum Bearbeiten</Text>
      )}
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

  const renderEditModal = () => {
    if (!editingTrip || !editingTrip.stops) return null;

    const stops = editingTrip.stops;
    const canSave = selectedDestinationIndex > selectedOriginIndex;

    // Vorschau der Berechnung
    const origin = stops[selectedOriginIndex];
    const destination = stops[selectedDestinationIndex];
    const dep = origin?.departure || '';
    const arr = destination?.arrival || '';
    const previewDuration = dep && arr ? calculateDuration(dep, arr) : 0;

    const originalStopCount = (editingTrip.destinationStopIndex ?? stops.length - 1) - (editingTrip.originStopIndex ?? 0);
    const newStopCount = selectedDestinationIndex - selectedOriginIndex;
    const previewDistance = originalStopCount > 0
      ? Math.round(editingTrip.distanceKm * (newStopCount / originalStopCount))
      : 0;
    const previewCo2 = calculateCo2Saved(previewDistance);

    return (
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Fahrt bearbeiten</Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.trainInfoModal}>
              <View style={[styles.trainBadge, { backgroundColor: getTrainTypeColor(editingTrip.trainType) }]}>
                <Text style={styles.trainBadgeText}>{editingTrip.trainType}</Text>
              </View>
              <Text style={styles.trainNameModal}>{editingTrip.trainName}</Text>
            </View>

            <Text style={styles.sectionLabel}>HALTESTELLEN AUSWÄHLEN</Text>

            <ScrollView style={styles.stopsContainer} showsVerticalScrollIndicator={false}>
              {stops.map((stop, index) => {
                const isOrigin = index === selectedOriginIndex;
                const isDestination = index === selectedDestinationIndex;
                const isBetween = index > selectedOriginIndex && index < selectedDestinationIndex;

                return (
                  <TouchableOpacity
                    key={`${stop.stationId}-${index}`}
                    style={[
                      styles.stopItem,
                      isOrigin && styles.stopItemOrigin,
                      isDestination && styles.stopItemDestination,
                      isBetween && styles.stopItemBetween,
                    ]}
                    onPress={() => {
                      if (selectedOriginIndex === index) {
                        // Bereits Origin - nichts tun
                      } else if (selectedDestinationIndex === index) {
                        // Bereits Destination - nichts tun
                      } else if (index < selectedOriginIndex) {
                        // Vor Origin - wird neuer Origin
                        setSelectedOriginIndex(index);
                      } else if (index > selectedDestinationIndex) {
                        // Nach Destination - wird neue Destination
                        setSelectedDestinationIndex(index);
                      } else {
                        // Zwischen Origin und Destination - auswählen was näher ist
                        const distToOrigin = index - selectedOriginIndex;
                        const distToDest = selectedDestinationIndex - index;
                        if (distToOrigin <= distToDest) {
                          setSelectedOriginIndex(index);
                        } else {
                          setSelectedDestinationIndex(index);
                        }
                      }
                    }}
                  >
                    <View style={styles.stopTimeline}>
                      <View
                        style={[
                          styles.stopDot,
                          isOrigin && styles.stopDotOrigin,
                          isDestination && styles.stopDotDestination,
                          isBetween && styles.stopDotBetween,
                        ]}
                      />
                      {index < stops.length - 1 && (
                        <View
                          style={[
                            styles.stopLine,
                            (isOrigin || isBetween) && styles.stopLineActive,
                          ]}
                        />
                      )}
                    </View>
                    <View style={styles.stopInfo}>
                      <Text style={[
                        styles.stopName,
                        (isOrigin || isDestination) && styles.stopNameSelected,
                      ]}>
                        {stop.stationName}
                      </Text>
                      <View style={styles.stopTimes}>
                        {stop.arrival && (
                          <Text style={styles.stopTime}>an {formatTime(stop.arrival)}</Text>
                        )}
                        {stop.departure && (
                          <Text style={styles.stopTime}>ab {formatTime(stop.departure)}</Text>
                        )}
                      </View>
                    </View>
                    {isOrigin && <View style={styles.labelBadgeOrigin}><Text style={styles.labelBadgeText}>START</Text></View>}
                    {isDestination && <View style={styles.labelBadgeDestination}><Text style={styles.labelBadgeText}>ZIEL</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {canSave && (
              <View style={styles.previewContainer}>
                <View style={styles.previewStat}>
                  <Text style={styles.previewValue}>{previewDistance}</Text>
                  <Text style={styles.previewLabel}>km</Text>
                </View>
                <View style={styles.previewDivider} />
                <View style={styles.previewStat}>
                  <Text style={styles.previewValue}>{previewDuration}</Text>
                  <Text style={styles.previewLabel}>min</Text>
                </View>
                <View style={styles.previewDivider} />
                <View style={styles.previewStat}>
                  <Text style={[styles.previewValue, styles.previewValueGreen]}>{previewCo2.toFixed(1)}</Text>
                  <Text style={styles.previewLabel}>kg CO₂</Text>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
                onPress={handleSaveEdit}
                disabled={!canSave}
              >
                <Text style={styles.saveButtonText}>Speichern</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

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

      {renderEditModal()}
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
    ...typography.header,
    color: colors.text.primary,
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
    ...typography.label,
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
    flex: 1,
  },
  trainBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  trainBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  trainNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  tripActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  delayBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: borderRadius.sm,
  },
  delayText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 20,
    color: colors.text.tertiary,
    fontWeight: '300',
    marginTop: -2,
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
    ...typography.number,
    fontSize: 18,
    color: colors.text.primary,
    marginRight: spacing.xs,
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
  editHint: {
    fontSize: 11,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: modalStyle.overlay.backgroundColor,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: modalStyle.content.backgroundColor,
    borderTopLeftRadius: modalStyle.content.borderTopLeftRadius,
    borderTopRightRadius: modalStyle.content.borderTopRightRadius,
    paddingTop: modalStyle.content.paddingTop,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.header,
    fontSize: 22,
    color: colors.text.primary,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 24,
    color: colors.text.secondary,
    fontWeight: '300',
    marginTop: -2,
  },
  trainInfoModal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  trainNameModal: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.text.secondary,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  stopsContainer: {
    maxHeight: 300,
    paddingHorizontal: spacing.xl,
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: -spacing.md,
    borderRadius: borderRadius.md,
  },
  stopItemOrigin: {
    backgroundColor: 'rgba(63, 185, 80, 0.15)',
  },
  stopItemDestination: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
  },
  stopItemBetween: {
    backgroundColor: 'rgba(88, 166, 255, 0.1)',
  },
  stopTimeline: {
    alignItems: 'center',
    width: 20,
    marginRight: spacing.md,
  },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.text.disabled,
    borderWidth: 2,
    borderColor: colors.background.secondary,
  },
  stopDotOrigin: {
    backgroundColor: colors.accent.green,
    borderColor: 'rgba(63, 185, 80, 0.3)',
  },
  stopDotDestination: {
    backgroundColor: colors.accent.red,
    borderColor: 'rgba(248, 81, 73, 0.3)',
  },
  stopDotBetween: {
    backgroundColor: colors.accent.blue,
    borderColor: 'rgba(88, 166, 255, 0.3)',
  },
  stopLine: {
    width: 2,
    height: 28,
    backgroundColor: colors.border.default,
    marginTop: spacing.xs,
  },
  stopLineActive: {
    backgroundColor: colors.accent.blue,
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '500',
  },
  stopNameSelected: {
    fontWeight: '700',
  },
  stopTimes: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 2,
  },
  stopTime: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  labelBadgeOrigin: {
    backgroundColor: colors.accent.green,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: borderRadius.sm,
  },
  labelBadgeDestination: {
    backgroundColor: colors.accent.red,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: borderRadius.sm,
  },
  labelBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  previewContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  previewStat: {
    alignItems: 'center',
  },
  previewValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  previewValueGreen: {
    color: colors.accent.green,
  },
  previewLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  previewDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border.default,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.background.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.accent.green,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.background.tertiary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
