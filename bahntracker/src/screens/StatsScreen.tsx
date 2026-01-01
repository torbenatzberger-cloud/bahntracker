import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllTimeStats, getYearlyStats, getMonthlyStats, getAchievements } from '../services/storage';
import { YearlyStats, Achievement, MonthlyStats } from '../types';
import { formatCo2, getCo2Comparison } from '../utils/co2';
import { colors, spacing, borderRadius, typography } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function StatsScreen() {
  const [allTimeStats, setAllTimeStats] = useState({
    totalTrips: 0,
    totalDistanceKm: 0,
    totalDurationMinutes: 0,
    totalCo2SavedKg: 0,
    totalDelayMinutes: 0,
  });
  const [yearlyStats, setYearlyStats] = useState<YearlyStats | null>(null);
  const [currentMonthStats, setCurrentMonthStats] = useState<MonthlyStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const loadData = useCallback(async () => {
    const [allTime, yearly, achiev] = await Promise.all([
      getAllTimeStats(),
      getYearlyStats(selectedYear),
      getAchievements(),
    ]);
    const now = new Date();
    const monthly = await getMonthlyStats(now.getFullYear(), now.getMonth());
    setAllTimeStats(allTime);
    setYearlyStats(yearly);
    setCurrentMonthStats(monthly);
    setAchievements(achiev);
  }, [selectedYear]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const formatHours = (m: number) => {
    const hours = Math.floor(m / 60);
    const mins = m % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const unlocked = achievements.filter((a) => a.unlockedAt);
  const locked = achievements.filter((a) => !a.unlockedAt);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Statistiken</Text>
        </View>

        {/* Gesamtbilanz Card */}
        <View style={styles.heroCard}>
          <Text style={styles.cardLabel}>GESAMTBILANZ</Text>
          <View style={styles.heroNumberContainer}>
            <Text style={styles.heroNumber}>
              {allTimeStats.totalDistanceKm.toLocaleString('de-DE')}
            </Text>
            <Text style={styles.heroUnit}>km</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridValue}>{allTimeStats.totalTrips}</Text>
              <Text style={styles.gridLabel}>Fahrten</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridValue}>{formatHours(allTimeStats.totalDurationMinutes)}</Text>
              <Text style={styles.gridLabel}>im Zug</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={[styles.gridValue, styles.greenText]}>
                {formatCo2(allTimeStats.totalCo2SavedKg)}
              </Text>
              <Text style={styles.gridLabel}>CO₂ gespart</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={[styles.gridValue, allTimeStats.totalDelayMinutes > 0 && styles.redText]}>
                {formatHours(allTimeStats.totalDelayMinutes)}
              </Text>
              <Text style={styles.gridLabel}>Verspätung</Text>
            </View>
          </View>

          {allTimeStats.totalCo2SavedKg > 0 && (
            <View style={styles.co2Badge}>
              <Text style={styles.co2BadgeText}>
                🌱 {getCo2Comparison(allTimeStats.totalCo2SavedKg)}
              </Text>
            </View>
          )}
        </View>

        {/* Aktueller Monat */}
        {currentMonthStats && currentMonthStats.totalTrips > 0 && (
          <View style={styles.monthCard}>
            <Text style={styles.monthTitle}>
              {currentMonthStats.month} {currentMonthStats.year}
            </Text>
            <View style={styles.monthStatsRow}>
              <View style={styles.monthStat}>
                <Text style={styles.monthStatValue}>{currentMonthStats.totalDistanceKm}</Text>
                <Text style={styles.monthStatLabel}>km</Text>
              </View>
              <View style={styles.monthStatDivider} />
              <View style={styles.monthStat}>
                <Text style={styles.monthStatValue}>{currentMonthStats.totalTrips}</Text>
                <Text style={styles.monthStatLabel}>Fahrten</Text>
              </View>
              <View style={styles.monthStatDivider} />
              <View style={styles.monthStat}>
                <Text style={[styles.monthStatValue, styles.greenText]}>
                  {currentMonthStats.totalCo2SavedKg.toFixed(1)}
                </Text>
                <Text style={styles.monthStatLabel}>kg CO₂</Text>
              </View>
              <View style={styles.monthStatDivider} />
              <View style={styles.monthStat}>
                <Text style={styles.monthStatValue}>{currentMonthStats.onTimePercentage}%</Text>
                <Text style={styles.monthStatLabel}>pünktlich</Text>
              </View>
            </View>
          </View>
        )}

        {/* Jahresübersicht */}
        {yearlyStats && yearlyStats.totalTrips > 0 && (
          <View style={styles.yearSection}>
            <View style={styles.yearHeader}>
              <Text style={styles.sectionTitle}>Jahr {selectedYear}</Text>
              <View style={styles.yearSelector}>
                <TouchableOpacity
                  onPress={() => setSelectedYear((y) => y - 1)}
                  style={styles.yearButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.yearButtonText}>←</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedYear((y) => Math.min(y + 1, new Date().getFullYear()))}
                  style={styles.yearButton}
                  disabled={selectedYear >= new Date().getFullYear()}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.yearButtonText,
                      selectedYear >= new Date().getFullYear() && styles.yearButtonDisabled,
                    ]}
                  >
                    →
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.highlightsRow}>
              {yearlyStats.longestTrip && (
                <View style={styles.highlightCard}>
                  <View style={styles.highlightIconContainer}>
                    <Text style={styles.highlightIcon}>🛤️</Text>
                  </View>
                  <Text style={styles.highlightLabel}>Längste Fahrt</Text>
                  <Text style={styles.highlightValue}>{yearlyStats.longestTrip.distanceKm} km</Text>
                </View>
              )}
              {yearlyStats.mostDelayedTrip && yearlyStats.mostDelayedTrip.delayMinutes > 0 && (
                <View style={styles.highlightCard}>
                  <View style={styles.highlightIconContainer}>
                    <Text style={styles.highlightIcon}>⏰</Text>
                  </View>
                  <Text style={styles.highlightLabel}>Max. Verspätung</Text>
                  <Text style={[styles.highlightValue, styles.redText]}>
                    +{yearlyStats.mostDelayedTrip.delayMinutes} min
                  </Text>
                </View>
              )}
            </View>

            {yearlyStats.mostUsedRoute && (
              <View style={styles.routeCard}>
                <Text style={styles.routeLabel}>MEISTGEFAHRENE STRECKE</Text>
                <Text style={styles.routeValue}>{yearlyStats.mostUsedRoute}</Text>
              </View>
            )}
          </View>
        )}

        {/* Erfolge */}
        <View style={styles.achievementsSection}>
          <Text style={styles.sectionTitle}>Erfolge</Text>

          {unlocked.length > 0 && (
            <View style={styles.achievementGroup}>
              <Text style={styles.achievementGroupTitle}>FREIGESCHALTET</Text>
              {unlocked.map((a) => (
                <View key={a.id} style={styles.achievementCard}>
                  <View style={styles.achievementIconContainer}>
                    <Text style={styles.achievementIcon}>{a.icon}</Text>
                  </View>
                  <View style={styles.achievementInfo}>
                    <Text style={styles.achievementName}>{a.name}</Text>
                    <Text style={styles.achievementDesc}>{a.description}</Text>
                  </View>
                  <View style={styles.achievementCheck}>
                    <Text style={styles.achievementCheckText}>✓</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {locked.length > 0 && (
            <View style={styles.achievementGroup}>
              <Text style={styles.achievementGroupTitle}>NOCH ZU ERREICHEN</Text>
              {locked.map((a) => {
                const progress = Math.min(((a.progress || 0) / (a.target || 100)) * 100, 100);
                return (
                  <View key={a.id} style={[styles.achievementCard, styles.achievementCardLocked]}>
                    <View style={[styles.achievementIconContainer, styles.achievementIconLocked]}>
                      <Text style={styles.achievementIcon}>{a.icon}</Text>
                    </View>
                    <View style={styles.achievementInfo}>
                      <Text style={[styles.achievementName, styles.achievementNameLocked]}>
                        {a.name}
                      </Text>
                      <View style={styles.progressBarContainer}>
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, { width: `${progress}%` }]} />
                        </View>
                        <Text style={styles.progressText}>
                          {Math.round(a.progress || 0)} / {a.target}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
  },
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  heroCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xxl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.lg,
  },
  cardLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  heroNumberContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  heroNumber: {
    fontSize: 56,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '50%',
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  gridValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  gridLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  greenText: {
    color: colors.accent.green,
  },
  redText: {
    color: colors.accent.red,
  },
  co2Badge: {
    backgroundColor: colors.category.co2.bg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  co2BadgeText: {
    color: colors.category.co2.text,
    fontSize: 14,
    fontWeight: '600',
  },
  monthCard: {
    backgroundColor: 'rgba(88, 166, 255, 0.1)',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(88, 166, 255, 0.2)',
    marginBottom: spacing.lg,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent.blue,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  monthStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  monthStat: {
    alignItems: 'center',
    flex: 1,
  },
  monthStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  monthStatLabel: {
    fontSize: 11,
    color: colors.accent.blue,
    marginTop: 2,
  },
  monthStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(88, 166, 255, 0.2)',
  },
  yearSection: {
    marginBottom: spacing.xxl,
  },
  yearHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  yearSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  yearButton: {
    width: 36,
    height: 36,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearButtonText: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  yearButtonDisabled: {
    color: colors.text.disabled,
  },
  highlightsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  highlightCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  highlightIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  highlightIcon: {
    fontSize: 24,
  },
  highlightLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  highlightValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  routeCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  routeLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  routeValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  achievementsSection: {
    marginTop: spacing.lg,
  },
  achievementGroup: {
    marginTop: spacing.lg,
  },
  achievementGroupTitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  achievementCardLocked: {
    opacity: 0.7,
  },
  achievementIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  achievementIconLocked: {
    opacity: 0.5,
  },
  achievementIcon: {
    fontSize: 24,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  achievementNameLocked: {
    color: colors.text.secondary,
  },
  achievementDesc: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  achievementCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent.green,
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementCheckText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  progressBarContainer: {
    marginTop: spacing.sm,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.blue,
    borderRadius: borderRadius.full,
  },
  progressText: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
});
