import React, { useState } from 'react';
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
  Modal,
} from 'react-native';
import { searchTrainByNumber } from '../services/transportApi';
import { TrainJourney } from '../types';
import { colors, spacing, borderRadius, typography, getTrainTypeColor, modalStyle } from '../theme';

export default function HomeScreen({ navigation }: any) {
  const [trainNumber, setTrainNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<TrainJourney[]>([]);
  const [showResultsModal, setShowResultsModal] = useState(false);

  const handleSearch = async () => {
    const query = trainNumber.trim();
    if (!query) return;

    setLoading(true);
    setError(null);

    try {
      const results = await searchTrainByNumber(query);

      if (results.length === 0) {
        setError(`Kein Zug gefunden für "${query}"`);
      } else if (results.length === 1) {
        // Direkt zur Detail-Ansicht
        navigation.navigate('TripDetail', { journey: results[0] });
        setTrainNumber('');
      } else {
        // Mehrere Ergebnisse → Modal anzeigen
        setSearchResults(results);
        setShowResultsModal(true);
      }
    } catch (e: any) {
      if (e?.message?.includes('503') || e?.message?.includes('Service')) {
        setError('Die Bahn-API ist momentan überlastet. Bitte warte kurz und versuche es erneut.');
      } else if (e?.message?.includes('500')) {
        setError('Server-Fehler. Bitte versuche es später erneut.');
      } else {
        setError('Suche fehlgeschlagen. Prüfe deine Internetverbindung.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectResult = (journey: TrainJourney) => {
    setShowResultsModal(false);
    setSearchResults([]);
    setTrainNumber('');
    navigation.navigate('TripDetail', { journey });
  };

  const formatTime = (d?: string) =>
    d ? new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  const renderResultItem = (item: TrainJourney, index: number) => (
    <TouchableOpacity
      key={`${item.tripId}-${index}`}
      style={[
        styles.resultItem,
        index === searchResults.length - 1 && styles.resultItemLast,
      ]}
      onPress={() => handleSelectResult(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.trainBadge, { backgroundColor: getTrainTypeColor(item.trainType) }]}>
        <Text style={styles.trainBadgeText}>{item.trainType}</Text>
      </View>
      <View style={styles.resultContent}>
        <Text style={styles.resultTrain}>{item.trainName}</Text>
        <Text style={styles.resultRoute} numberOfLines={1}>
          {item.origin.station.name} → {item.destination.station.name}
        </Text>
      </View>
      <Text style={styles.resultTime}>{formatTime(item.origin.departure)}</Text>
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
          <View style={styles.searchRow}>
            <TextInput
              style={styles.input}
              value={trainNumber}
              onChangeText={setTrainNumber}
              onSubmitEditing={handleSearch}
              placeholder="ICE 513, RE 1, RB 789..."
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.searchButton, loading && styles.searchButtonDisabled]}
              onPress={handleSearch}
              disabled={loading || !trainNumber.trim()}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.searchButtonText}>Suchen</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Error message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>

        {/* Tips Section */}
        {!loading && !error && (
          <View style={styles.tipsSection}>
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>So funktioniert's</Text>
              <View style={styles.tipItem}>
                <View style={styles.tipBullet}>
                  <Text style={styles.tipBulletText}>1</Text>
                </View>
                <Text style={styles.tipText}>Zugnummer eingeben (z.B. ICE 513)</Text>
              </View>
              <View style={styles.tipItem}>
                <View style={styles.tipBullet}>
                  <Text style={styles.tipBulletText}>2</Text>
                </View>
                <Text style={styles.tipText}>Suchen-Button drücken oder Enter</Text>
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
                  onPress={() => setTrainNumber('ICE 513')}
                >
                  <Text style={styles.exampleChipText}>ICE 513</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.exampleChip}
                  onPress={() => setTrainNumber('RE 1')}
                >
                  <Text style={styles.exampleChipText}>RE 1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.exampleChip}
                  onPress={() => setTrainNumber('IC 2023')}
                >
                  <Text style={styles.exampleChipText}>IC 2023</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Results Modal */}
        <Modal
          visible={showResultsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowResultsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Zug auswählen</Text>
                <TouchableOpacity
                  onPress={() => setShowResultsModal(false)}
                  style={styles.modalCloseButton}
                >
                  <Text style={styles.modalCloseText}>×</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>
                {searchResults.length} Züge gefunden für "{trainNumber}"
              </Text>
              <ScrollView
                style={styles.resultsList}
                showsVerticalScrollIndicator={false}
              >
                {searchResults.map((item, index) => renderResultItem(item, index))}
              </ScrollView>
            </View>
          </View>
        </Modal>
        {/* Version */}
        <Text style={styles.versionText}>v1.6.0</Text>
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
  },
  inputLabel: {
    ...typography.label,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  searchRow: {
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
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.accent.blue,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorContainer: {
    marginTop: spacing.md,
    padding: spacing.lg,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: colors.accent.red,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
    paddingHorizontal: spacing.xl,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.header,
    fontSize: 22,
    color: colors.text.primary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
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
  resultsList: {
    maxHeight: 400,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  resultItemLast: {
    marginBottom: 0,
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
  resultContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  resultTrain: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  resultRoute: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  resultTime: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  versionText: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingBottom: spacing.md,
  },
});
