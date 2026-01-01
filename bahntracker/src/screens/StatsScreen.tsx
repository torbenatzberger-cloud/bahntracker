import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllTimeStats, getYearlyStats, getMonthlyStats, getAchievements } from '../services/storage';
import { YearlyStats, Achievement, MonthlyStats } from '../types';
import { formatCo2, getCo2Comparison } from '../utils/co2';

export default function StatsScreen() {
  const [allTimeStats, setAllTimeStats] = useState({ totalTrips: 0, totalDistanceKm: 0, totalDurationMinutes: 0, totalCo2SavedKg: 0, totalDelayMinutes: 0 });
  const [yearlyStats, setYearlyStats] = useState<YearlyStats | null>(null);
  const [currentMonthStats, setCurrentMonthStats] = useState<MonthlyStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const loadData = useCallback(async () => {
    const [allTime, yearly, achiev] = await Promise.all([getAllTimeStats(), getYearlyStats(selectedYear), getAchievements()]);
    const now = new Date();
    const monthly = await getMonthlyStats(now.getFullYear(), now.getMonth());
    setAllTimeStats(allTime); setYearlyStats(yearly); setCurrentMonthStats(monthly); setAchievements(achiev);
  }, [selectedYear]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
  const formatHours = (m: number) => Math.floor(m / 60);
  const unlocked = achievements.filter(a => a.unlockedAt);
  const locked = achievements.filter(a => !a.unlockedAt);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}><Text style={styles.headerTitle}>📊 Statistiken</Text></View>
        <View style={styles.allTimeCard}>
          <Text style={styles.cardTitle}>Gesamtbilanz</Text>
          <View style={styles.bigStatRow}><View style={styles.bigStat}><Text style={styles.bigStatValue}>{allTimeStats.totalDistanceKm.toLocaleString('de-DE')}</Text><Text style={styles.bigStatLabel}>Kilometer</Text></View></View>
          <View style={styles.statsGrid}>
            <View style={styles.gridStat}><Text style={styles.gridStatValue}>{allTimeStats.totalTrips}</Text><Text style={styles.gridStatLabel}>Fahrten</Text></View>
            <View style={styles.gridStat}><Text style={styles.gridStatValue}>{formatHours(allTimeStats.totalDurationMinutes)}h</Text><Text style={styles.gridStatLabel}>im Zug</Text></View>
            <View style={styles.gridStat}><Text style={[styles.gridStatValue, styles.greenText]}>{formatCo2(allTimeStats.totalCo2SavedKg)}</Text><Text style={styles.gridStatLabel}>CO₂ gespart</Text></View>
            <View style={styles.gridStat}><Text style={[styles.gridStatValue, styles.redText]}>{formatHours(allTimeStats.totalDelayMinutes)}h</Text><Text style={styles.gridStatLabel}>Verspätung</Text></View>
          </View>
          {allTimeStats.totalCo2SavedKg > 0 && <View style={styles.co2Comparison}><Text style={styles.co2ComparisonText}>🌱 {getCo2Comparison(allTimeStats.totalCo2SavedKg)}</Text></View>}
        </View>
        {currentMonthStats && currentMonthStats.totalTrips > 0 && (
          <View style={styles.monthHighlight}>
            <Text style={styles.monthTitle}>📅 {currentMonthStats.month} {currentMonthStats.year}</Text>
            <View style={styles.monthStats}>
              <View style={styles.monthStat}><Text style={styles.monthStatValue}>{currentMonthStats.totalDistanceKm}</Text><Text style={styles.monthStatLabel}>km</Text></View>
              <View style={styles.monthStat}><Text style={styles.monthStatValue}>{currentMonthStats.totalTrips}</Text><Text style={styles.monthStatLabel}>Fahrten</Text></View>
              <View style={styles.monthStat}><Text style={[styles.monthStatValue, styles.greenText]}>{currentMonthStats.totalCo2SavedKg.toFixed(1)}</Text><Text style={styles.monthStatLabel}>kg CO₂</Text></View>
              <View style={styles.monthStat}><Text style={styles.monthStatValue}>{currentMonthStats.onTimePercentage}%</Text><Text style={styles.monthStatLabel}>pünktlich</Text></View>
            </View>
          </View>
        )}
        {yearlyStats && yearlyStats.totalTrips > 0 && (
          <View style={styles.yearSection}>
            <View style={styles.yearHeader}>
              <Text style={styles.sectionTitle}>Jahr {selectedYear}</Text>
              <View style={styles.yearSelector}>
                <TouchableOpacity onPress={() => setSelectedYear(y => y - 1)} style={styles.yearButton}><Text style={styles.yearButtonText}>←</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedYear(y => Math.min(y + 1, new Date().getFullYear()))} style={styles.yearButton} disabled={selectedYear >= new Date().getFullYear()}><Text style={[styles.yearButtonText, selectedYear >= new Date().getFullYear() && styles.yearButtonDisabled]}>→</Text></TouchableOpacity>
              </View>
            </View>
            <View style={styles.highlightsRow}>
              {yearlyStats.longestTrip && <View style={styles.highlightCard}><Text style={styles.highlightIcon}>🛤️</Text><Text style={styles.highlightTitle}>Längste Fahrt</Text><Text style={styles.highlightValue}>{yearlyStats.longestTrip.distanceKm} km</Text></View>}
              {yearlyStats.mostDelayedTrip && yearlyStats.mostDelayedTrip.delayMinutes > 0 && <View style={styles.highlightCard}><Text style={styles.highlightIcon}>⏰</Text><Text style={styles.highlightTitle}>Max. Verspätung</Text><Text style={[styles.highlightValue, styles.redText]}>+{yearlyStats.mostDelayedTrip.delayMinutes} min</Text></View>}
            </View>
            {yearlyStats.mostUsedRoute && <View style={styles.routeCard}><Text style={styles.routeLabel}>🔄 Meistgefahrene Strecke</Text><Text style={styles.routeValue}>{yearlyStats.mostUsedRoute}</Text></View>}
          </View>
        )}
        <View style={styles.achievementsSection}>
          <Text style={styles.sectionTitle}>🏆 Erfolge</Text>
          {unlocked.length > 0 && <View style={styles.achievementsList}><Text style={styles.achievementsSubtitle}>Freigeschaltet</Text>{unlocked.map(a => <View key={a.id} style={styles.achievementCard}><Text style={styles.achievementIcon}>{a.icon}</Text><View style={styles.achievementInfo}><Text style={styles.achievementName}>{a.name}</Text><Text style={styles.achievementDesc}>{a.description}</Text></View><Text style={styles.achievementCheck}>✓</Text></View>)}</View>}
          {locked.length > 0 && <View style={styles.achievementsList}><Text style={styles.achievementsSubtitle}>Noch zu erreichen</Text>{locked.map(a => { const pct = Math.min(((a.progress || 0) / (a.target || 100)) * 100, 100); return <View key={a.id} style={[styles.achievementCard, styles.achievementLocked]}><Text style={[styles.achievementIcon, styles.achievementIconLocked]}>{a.icon}</Text><View style={styles.achievementInfo}><Text style={[styles.achievementName, styles.achievementNameLocked]}>{a.name}</Text><View style={styles.progressBar}><View style={[styles.progressFill, { width: `${pct}%` }]} /></View><Text style={styles.progressText}>{a.progress || 0} / {a.target}</Text></View></View>; })}</View>}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#f8fafc' },
  allTimeCard: { marginHorizontal: 20, backgroundColor: '#1e293b', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#334155' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  bigStatRow: { alignItems: 'center', marginBottom: 20 },
  bigStat: { alignItems: 'center' },
  bigStatValue: { fontSize: 48, fontWeight: '800', color: '#f8fafc', letterSpacing: -2 },
  bigStatLabel: { fontSize: 16, color: '#64748b', marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridStat: { width: '50%', paddingVertical: 12, alignItems: 'center' },
  gridStatValue: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
  gridStatLabel: { fontSize: 13, color: '#64748b', marginTop: 2 },
  greenText: { color: '#22c55e' },
  redText: { color: '#ef4444' },
  co2Comparison: { backgroundColor: 'rgba(34, 197, 94, 0.15)', padding: 12, borderRadius: 8, marginTop: 12 },
  co2ComparisonText: { color: '#86efac', fontSize: 14, textAlign: 'center' },
  monthHighlight: { marginHorizontal: 20, marginTop: 16, backgroundColor: '#1e3a5f', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e40af' },
  monthTitle: { fontSize: 16, fontWeight: '700', color: '#93c5fd', marginBottom: 12 },
  monthStats: { flexDirection: 'row', justifyContent: 'space-around' },
  monthStat: { alignItems: 'center' },
  monthStatValue: { fontSize: 20, fontWeight: '700', color: '#f8fafc' },
  monthStatLabel: { fontSize: 11, color: '#93c5fd', marginTop: 2 },
  yearSection: { marginTop: 24, paddingHorizontal: 20 },
  yearHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  yearSelector: { flexDirection: 'row', gap: 8 },
  yearButton: { width: 36, height: 36, backgroundColor: '#334155', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  yearButtonText: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  yearButtonDisabled: { color: '#475569' },
  highlightsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  highlightCard: { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 14, alignItems: 'center' },
  highlightIcon: { fontSize: 24, marginBottom: 6 },
  highlightTitle: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  highlightValue: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  routeCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 16 },
  routeLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  routeValue: { fontSize: 15, fontWeight: '600', color: '#f8fafc' },
  achievementsSection: { marginTop: 24, paddingHorizontal: 20 },
  achievementsList: { marginTop: 16 },
  achievementsSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 12, textTransform: 'uppercase' },
  achievementCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  achievementLocked: { opacity: 0.7 },
  achievementIcon: { fontSize: 28, marginRight: 14 },
  achievementIconLocked: { opacity: 0.5 },
  achievementInfo: { flex: 1 },
  achievementName: { fontSize: 15, fontWeight: '600', color: '#f8fafc' },
  achievementNameLocked: { color: '#94a3b8' },
  achievementDesc: { fontSize: 13, color: '#64748b', marginTop: 2 },
  achievementCheck: { color: '#22c55e', fontSize: 20, fontWeight: '700' },
  progressBar: { height: 6, backgroundColor: '#334155', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 3 },
  progressText: { fontSize: 11, color: '#64748b', marginTop: 4 },
});
