import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { searchTrainByNumber } from '../services/transportApi';
import { TrainJourney } from '../types';
import { colors, spacing, borderRadius, typography, getTrainTypeColor } from '../theme';

export default function HomeScreen({ navigation }: any) {
  const [trainNumber, setTrainNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<TrainJourney[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handleTextChange = useCallback((text: string) => {
    setTrainNumber(text);

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Hide suggestions if input is too short
    if (text.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoading(false);
      return;
    }

    // Show loading indicator
    setLoading(true);

    // Debounce: Wait 400ms after last keystroke
    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await searchTrainByNumber(text);
        setSuggestions(results.slice(0, 10)); // Limit to 10 results
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  const handleSelectSuggestion = useCallback((journey: TrainJourney) => {
    setShowSuggestions(false);
    setTrainNumber('');
    setSuggestions([]);
    navigation.navigate('TripDetail', { journey });
  }, [navigation]);

  const formatTime = (d?: string) =>
    d ? new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  const renderSuggestion = (item: TrainJourney, index: number) => (
    <TouchableOpacity
      key={`${item.tripId}-${index}`}
      style={[
        styles.suggestionItem,
        index === suggestions.length - 1 && styles.suggestionItemLast,
      ]}
      onPress={() => handleSelectSuggestion(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.trainBadge, { backgroundColor: getTrainTypeColor(item.trainType) }]}>
        <Text style={styles.trainBadgeText}>{item.trainType}</Text>
      </View>
      <View style={styles.suggestionContent}>
        <Text style={styles.suggestionTrain}>{item.trainName}</Text>
        <Text style={styles.suggestionRoute} numberOfLines={1}>
          {item.origin.station.name} → {item.destination.station.name}
        </Text>
      </View>
      <Text style={styles.suggestionTime}>{formatTime(item.origin.departure)}</Text>
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

        <View style={styles.searchSection}>
          <Text style={styles.inputLabel}>ZUG SUCHEN</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={trainNumber}
              onChangeText={handleTextChange}
              placeholder="ICE 123, RE 456, RB 789..."
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            />
            {loading && (
              <ActivityIndicator
                style={styles.inputLoader}
                color={colors.accent.blue}
                size="small"
              />
            )}
          </View>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.suggestionsList}
              >
                {suggestions.map((item, index) => renderSuggestion(item, index))}
              </ScrollView>
            </View>
          )}

          {/* No results message */}
          {!loading && trainNumber.length >= 2 && suggestions.length === 0 && showSuggestions === false && (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>
                Kein Zug gefunden für "{trainNumber}"
              </Text>
            </View>
          )}
        </View>

        {/* Tips Section - only shown when no search active */}
        {trainNumber.length === 0 && (
          <View style={styles.tipsSection}>
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>So funktioniert's</Text>
              <View style={styles.tipItem}>
                <View style={styles.tipBullet}>
                  <Text style={styles.tipBulletText}>1</Text>
                </View>
                <Text style={styles.tipText}>Zugnummer eingeben (z.B. ICE 579)</Text>
              </View>
              <View style={styles.tipItem}>
                <View style={styles.tipBullet}>
                  <Text style={styles.tipBulletText}>2</Text>
                </View>
                <Text style={styles.tipText}>Zug aus den Vorschlägen auswählen</Text>
              </View>
              <View style={styles.tipItem}>
                <View style={styles.tipBullet}>
                  <Text style={styles.tipBulletText}>3</Text>
                </View>
                <Text style={styles.tipText}>Start- und Zielbahnhof markieren</Text>
              </View>
              <View style={styles.tipItem}>
                <View style={styles.tipBullet}>
                  <Text style={styles.tipBulletText}>4</Text>
                </View>
                <Text style={styles.tipText}>Fahrt speichern und Statistiken ansehen</Text>
              </View>
            </View>

            <View style={styles.examplesCard}>
              <Text style={styles.examplesTitle}>Beispiele</Text>
              <View style={styles.exampleRow}>
                <TouchableOpacity
                  style={styles.exampleChip}
                  onPress={() => handleTextChange('ICE 579')}
                >
                  <Text style={styles.exampleChipText}>ICE 579</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.exampleChip}
                  onPress={() => handleTextChange('RE 1')}
                >
                  <Text style={styles.exampleChipText}>RE 1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.exampleChip}
                  onPress={() => handleTextChange('IC 2023')}
                >
                  <Text style={styles.exampleChipText}>IC 2023</Text>
                </TouchableOpacity>
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
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    ...typography.header,
    fontSize: 32,
    color: colors.text.primary,
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  searchSection: {
    paddingHorizontal: spacing.xl,
    zIndex: 1000,
  },
  inputLabel: {
    ...typography.label,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    height: 56,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingRight: 50, // Space for loader
    fontSize: 18,
    color: colors.text.primary,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  inputLoader: {
    position: 'absolute',
    right: spacing.lg,
    top: 18,
  },
  suggestionsContainer: {
    marginTop: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    maxHeight: 350,
    overflow: 'hidden',
  },
  suggestionsList: {
    borderRadius: borderRadius.lg,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  trainBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
  },
  trainBadgeText: {
    color: '#fff',
    ...typography.badge,
  },
  suggestionContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  suggestionTrain: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  suggestionRoute: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  suggestionTime: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  noResultsContainer: {
    marginTop: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  noResultsText: {
    color: colors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
  },
  tipsSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    flex: 1,
  },
  tipsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.lg,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  tipBulletText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  tipText: {
    fontSize: 14,
    color: colors.text.secondary,
    flex: 1,
  },
  examplesCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  exampleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  exampleChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  exampleChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
});
