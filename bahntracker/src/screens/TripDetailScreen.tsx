import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { TrainJourney, Trip, TripStop } from '../types';
import { calculateRailDistance, calculateDuration } from '../services/distanceApi';
import { calculateCo2Saved } from '../utils/co2';
import { saveTrip } from '../services/storage';
import { colors, spacing, borderRadius, typography, getTrainTypeColor, getDelayColor } from '../theme';

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
        if (status !== 'granted') {
          setLocationLoading(false);
          return;
        }
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        let closestIndex = 0;
        let closestDist = Infinity;
        journey.stops.forEach((stop, i) => {
          if (stop.station.location) {
            const d = Math.sqrt(
              Math.pow(stop.station.location.latitude - location.coords.latitude, 2) +
                Math.pow(stop.station.location.longitude - location.coords.longitude, 2)
            );
            if (d < closestDist) {
              closestDist = d;
              closestIndex = i;
            }
          }
        });
        if (closestDist < 0.05) setOriginIndex(closestIndex);
      } catch (e) {
        console.warn('Location error:', e);
      } finally {
        setLocationLoading(false);
      }
    })();
  }, [journey.stops]);

  useEffect(() => {
    if (originIndex !== null && destinationIndex !== null) {
      const o = journey.stops[originIndex];
      const d = journey.stops[destinationIndex];
      if (o.station.location && d.station.location) {
        calculateRailDistance(o.station.location, d.station.location).then(setCalculatedDistance);
      }
    }
  }, [originIndex, destinationIndex, journey.stops]);

  const handleStopSelect = (i: number) => {
    if (originIndex === null) {
      setOriginIndex(i);
    } else if (destinationIndex === null) {
      if (i > originIndex) {
        setDestinationIndex(i);
      } else if (i < originIndex) {
        setDestinationIndex(originIndex);
        setOriginIndex(i);
      } else {
        setOriginIndex(null);
        setDestinationIndex(null);
      }
    } else {
      setOriginIndex(i);
      setDestinationIndex(null);
    }
  };

  const tripDetails = useMemo(() => {
    if (originIndex === null || destinationIndex === null) return null;
    const o = journey.stops[originIndex];
    const d = journey.stops[destinationIndex];
    const dep = o.departure || o.plannedDeparture || '';
    const arr = d.arrival || d.plannedArrival || '';
    const dur = dep && arr ? calculateDuration(dep, arr) : 0;
    const delay = Math.round(Math.max(d.arrivalDelay || 0, o.departureDelay || 0) / 60);
    return {
      origin: o,
      destination: d,
      departure: dep,
      arrival: arr,
      durationMinutes: dur,
      delayMinutes: delay,
      distanceKm: calculatedDistance || 0,
    };
  }, [originIndex, destinationIndex, journey.stops, calculatedDistance]);

  const handleSaveTrip = async () => {
    if (!tripDetails || originIndex === null || destinationIndex === null) return;
    setSaving(true);
    try {
      const co2 = calculateCo2Saved(tripDetails.distanceKm);

      // Alle Stops für spätere Bearbeitung speichern
      const stops: TripStop[] = journey.stops.map((s) => ({
        stationId: s.station.id,
        stationName: s.station.name,
        arrival: s.arrival || s.plannedArrival,
        departure: s.departure || s.plannedDeparture,
        arrivalDelay: s.arrivalDelay,
        departureDelay: s.departureDelay,
      }));

      const trip: Trip = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tripId: journey.tripId,
        trainNumber: journey.trainNumber,
        trainType: journey.trainType,
        trainName: journey.trainName,
        originStation: tripDetails.origin.station.name,
        originStationId: tripDetails.origin.station.id,
        destinationStation: tripDetails.destination.station.name,
        destinationStationId: tripDetails.destination.station.id,
        departurePlanned: tripDetails.origin.plannedDeparture || tripDetails.departure,
        departureActual: tripDetails.departure,
        arrivalPlanned: tripDetails.destination.plannedArrival || tripDetails.arrival,
        arrivalActual: tripDetails.arrival,
        delayMinutes: tripDetails.delayMinutes,
        distanceKm: tripDetails.distanceKm,
        durationMinutes: tripDetails.durationMinutes,
        co2SavedKg: co2,
        createdAt: new Date().toISOString(),
        stops,
        originStopIndex: originIndex,
        destinationStopIndex: destinationIndex,
      };
      await saveTrip(trip);
      Alert.alert('Gespeichert!', `${tripDetails.distanceKm} km • ${co2.toFixed(1)} kg CO₂ gespart`, [
        { text: 'Übersicht', onPress: () => navigation.navigate('History') },
        { text: 'Neue Fahrt', onPress: () => navigation.popToTop() },
      ]);
    } catch {
      Alert.alert('Fehler', 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (d?: string) =>
    d ? new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  const getStatus = (i: number) => {
    if (originIndex === i) return 'origin';
    if (destinationIndex === i) return 'destination';
    if (originIndex !== null && destinationIndex !== null && i > originIndex && i < destinationIndex)
      return 'between';
    return 'normal';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Zurück</Text>
        </TouchableOpacity>
        <View style={styles.trainInfo}>
          <View style={[styles.trainBadge, { backgroundColor: getTrainTypeColor(journey.trainType) }]}>
            <Text style={styles.trainBadgeText}>{journey.trainType}</Text>
          </View>
          <Text style={styles.trainName}>{journey.trainName}</Text>
        </View>
        <View style={styles.headerHintContainer}>
          <View
            style={[
              styles.stepIndicator,
              originIndex === null && styles.stepIndicatorActive,
              originIndex !== null && styles.stepIndicatorDone,
            ]}
          >
            <Text style={styles.stepIndicatorText}>1</Text>
          </View>
          <View style={styles.stepConnector} />
          <View
            style={[
              styles.stepIndicator,
              originIndex !== null && destinationIndex === null && styles.stepIndicatorActive,
              destinationIndex !== null && styles.stepIndicatorDone,
            ]}
          >
            <Text style={styles.stepIndicatorText}>2</Text>
          </View>
          <Text style={styles.headerHintText}>
            {originIndex === null
              ? 'Startbahnhof wählen'
              : destinationIndex === null
              ? 'Zielbahnhof wählen'
              : 'Bereit zum Speichern'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.stopsContainer} showsVerticalScrollIndicator={false}>
        {locationLoading && (
          <View style={styles.locationBanner}>
            <ActivityIndicator color={colors.accent.blue} size="small" />
            <Text style={styles.locationText}>Standort wird ermittelt...</Text>
          </View>
        )}

        {journey.stops.map((stop, i) => {
          const status = getStatus(i);
          const delay = Math.round((stop.departureDelay || stop.arrivalDelay || 0) / 60);
          return (
            <TouchableOpacity
              key={`${stop.station.id}-${i}`}
              style={[
                styles.stopItem,
                status === 'origin' && styles.stopItemOrigin,
                status === 'destination' && styles.stopItemDestination,
                status === 'between' && styles.stopItemBetween,
              ]}
              onPress={() => handleStopSelect(i)}
              activeOpacity={0.7}
            >
              <View style={styles.stopTimeline}>
                <View
                  style={[
                    styles.stopDot,
                    status === 'origin' && styles.stopDotOrigin,
                    status === 'destination' && styles.stopDotDestination,
                    status === 'between' && styles.stopDotBetween,
                  ]}
                />
                {i < journey.stops.length - 1 && (
                  <View
                    style={[
                      styles.stopLine,
                      (status === 'origin' || status === 'between') &&
                        destinationIndex !== null &&
                        i < destinationIndex &&
                        styles.stopLineActive,
                    ]}
                  />
                )}
              </View>
              <View style={styles.stopContent}>
                <Text
                  style={[
                    styles.stopName,
                    (status === 'origin' || status === 'destination') && styles.stopNameSelected,
                  ]}
                  numberOfLines={1}
                >
                  {stop.station.name}
                </Text>
                <View style={styles.stopTimes}>
                  {stop.arrival && <Text style={styles.stopTime}>an {formatTime(stop.arrival)}</Text>}
                  {stop.departure && <Text style={styles.stopTime}>ab {formatTime(stop.departure)}</Text>}
                  {delay > 0 && (
                    <Text style={[styles.stopDelay, { color: getDelayColor(delay) }]}>+{delay}</Text>
                  )}
                </View>
              </View>
              {stop.platform && (
                <View style={styles.platformBadge}>
                  <Text style={styles.platformText}>Gl. {stop.platform}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {tripDetails && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>
                {tripDetails.distanceKm ? Math.round(tripDetails.distanceKm) : '...'}
              </Text>
              <Text style={styles.summaryLabel}>km</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{tripDetails.durationMinutes}</Text>
              <Text style={styles.summaryLabel}>min</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text
                style={[
                  styles.summaryValue,
                  tripDetails.delayMinutes > 0 && {
                    color: getDelayColor(tripDetails.delayMinutes),
                  },
                ]}
              >
                {tripDetails.delayMinutes > 0 ? `+${tripDetails.delayMinutes}` : '0'}
              </Text>
              <Text style={styles.summaryLabel}>Versp.</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryValue, styles.summaryValueCo2]}>
                {tripDetails.distanceKm ? calculateCo2Saved(tripDetails.distanceKm).toFixed(1) : '...'}
              </Text>
              <Text style={styles.summaryLabel}>kg CO₂</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.saveButton, (saving || !tripDetails.distanceKm) && styles.saveButtonDisabled]}
            onPress={handleSaveTrip}
            disabled={saving || !tripDetails.distanceKm}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Fahrt speichern</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  backButtonText: {
    color: colors.accent.blue,
    fontSize: 16,
    fontWeight: '600',
  },
  trainInfo: {
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
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIndicatorActive: {
    backgroundColor: colors.accent.blue,
  },
  stepIndicatorDone: {
    backgroundColor: colors.accent.green,
  },
  stepIndicatorText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  stepConnector: {
    width: 20,
    height: 2,
    backgroundColor: colors.border.default,
    marginHorizontal: spacing.xs,
  },
  headerHintText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: spacing.md,
  },
  stopsContainer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(88, 166, 255, 0.1)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(88, 166, 255, 0.2)',
  },
  locationText: {
    color: colors.accent.blue,
    marginLeft: spacing.sm,
    fontSize: 14,
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
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
    width: 24,
    marginRight: spacing.md,
  },
  stopDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.text.disabled,
    borderWidth: 3,
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
    height: 40,
    backgroundColor: colors.border.default,
    marginTop: spacing.xs,
  },
  stopLineActive: {
    backgroundColor: colors.accent.blue,
  },
  stopContent: {
    flex: 1,
  },
  stopName: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500',
    marginBottom: 2,
  },
  stopNameSelected: {
    fontWeight: '700',
  },
  stopTimes: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stopTime: {
    fontSize: 13,
    color: colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  stopDelay: {
    fontSize: 13,
    fontWeight: '600',
  },
  platformBadge: {
    backgroundColor: colors.background.tertiary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  platformText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryContainer: {
    padding: spacing.xl,
    backgroundColor: colors.background.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
  },
  summaryStat: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  summaryValueCo2: {
    color: colors.accent.green,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.default,
  },
  saveButton: {
    backgroundColor: colors.accent.green,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.background.tertiary,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
