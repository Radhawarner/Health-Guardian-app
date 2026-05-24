import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { apiCall } from '../../utils/api';

interface Patient {
  name: string;
  age: number;
  gender: string;
}

interface Medicine {
  id: string;
  name: string;
  dosage: string;
  timing: string[];
  frequency: string;
}

interface HealthLog {
  id: string;
  date: string;
  weight?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  blood_sugar?: number;
  heart_rate?: number;
}

interface ShareData {
  patient: Patient;
  medicines: Medicine[];
  health_logs: HealthLog[];
}

export default function ShareScreen() {
  const { token } = useLocalSearchParams();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchSharedData();
    }
  }, [token]);

  const fetchSharedData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiCall(`/public/shares/${token}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load shared report');
    } finally {
      setLoading(false);
    }
  };

  const getTimingBadgeColor = (timing: string) => {
    switch (timing.toLowerCase()) {
      case 'morning':
        return '#FFF3E0'; // light orange
      case 'afternoon':
        return '#FFFDE7'; // light yellow
      case 'night':
        return '#EDE7F6'; // light purple
      default:
        return colors.background;
    }
  };

  const getTimingTextColor = (timing: string) => {
    switch (timing.toLowerCase()) {
      case 'morning':
        return '#E65100';
      case 'afternoon':
        return '#F57F17';
      case 'night':
        return '#4A148C';
      default:
        return colors.text;
    }
  };

  const getTimingIcon = (timing: string) => {
    switch (timing.toLowerCase()) {
      case 'morning':
        return 'sunny';
      case 'afternoon':
        return 'sunny-outline';
      case 'night':
        return 'moon';
      default:
        return 'time-outline';
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 12 }]}>
          Loading secure patient report...
        </Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Ionicons name="alert-circle" size={80} color={colors.danger} />
        <Text style={[styles.errorTitle, { color: colors.text, marginTop: 16 }]}>
          Link Invalid or Expired
        </Text>
        <Text style={[styles.errorSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>
          {error || 'This shared health record is no longer available or active.'}
        </Text>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.actionBtnText}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { patient, medicines, health_logs } = data;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header section with patient profile card */}
      <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.patientProfileRow}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="medical" size={40} color={colors.primary} />
          </View>
          <View style={styles.patientMeta}>
            <View style={styles.badgeRow}>
              <View style={[styles.secureBadge, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="shield-checkmark" size={12} color={colors.success} />
                <Text style={[styles.secureBadgeText, { color: colors.success }]}>SECURE REPORT</Text>
              </View>
            </View>
            <Text style={[styles.patientName, { color: colors.text }]}>{patient.name}</Text>
            <Text style={[styles.patientSub, { color: colors.textSecondary }]}>
              {patient.age} years old • {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
            </Text>
          </View>
        </View>
      </View>

      {/* Medicines Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="color-filter" size={20} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Medication Plan</Text>
        </View>

        {medicines.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="bandage-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No active medications logged.</Text>
          </View>
        ) : (
          medicines.map((med) => (
            <View
              key={med.id}
              style={[styles.medCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.medHeader}>
                <Text style={[styles.medName, { color: colors.text }]}>{med.name}</Text>
                <Text style={[styles.medFreq, { color: colors.primary }]}>{med.frequency}</Text>
              </View>
              <Text style={[styles.medDosage, { color: colors.textSecondary }]}>
                Dosage: {med.dosage}
              </Text>
              <View style={styles.timingList}>
                {med.timing.map((t, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.timingBadge,
                      { backgroundColor: getTimingBadgeColor(t) },
                    ]}
                  >
                    <Ionicons name={getTimingIcon(t)} size={14} color={getTimingTextColor(t)} />
                    <Text style={[styles.timingText, { color: getTimingTextColor(t) }]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </View>

      {/* Health Metrics logs */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="heart" size={20} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Health Metrics</Text>
        </View>

        {health_logs.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="analytics-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No health metrics logged yet.</Text>
          </View>
        ) : (
          health_logs.map((log) => (
            <View
              key={log.id}
              style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.logHeader}>
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.logDate, { color: colors.textSecondary }]}>{log.date}</Text>
              </View>

              <View style={styles.metricsGrid}>
                {log.weight && (
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Weight</Text>
                    <Text style={[styles.metricValue, { color: colors.text }]}>{log.weight} kg</Text>
                  </View>
                )}
                {log.systolic_bp && log.diastolic_bp && (
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Blood Pressure</Text>
                    <Text style={[styles.metricValue, { color: colors.text }]}>
                      {log.systolic_bp}/{log.diastolic_bp} mmHg
                    </Text>
                  </View>
                )}
                {log.blood_sugar && (
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Blood Sugar</Text>
                    <Text style={[styles.metricValue, { color: colors.text }]}>{log.blood_sugar} mg/dL</Text>
                  </View>
                )}
                {log.heart_rate && (
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Heart Rate</Text>
                    <Text style={[styles.metricValue, { color: colors.text }]}>{log.heart_rate} bpm</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          End of patient report • Health Guardian Secure Report
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  errorSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  patientProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  patientMeta: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    gap: 4,
  },
  secureBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  patientName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  patientSub: {
    fontSize: 14,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  medCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  medHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  medName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  medFreq: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  medDosage: {
    fontSize: 14,
    marginBottom: 10,
  },
  timingList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  timingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  logCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  logDate: {
    fontSize: 13,
    fontWeight: '500',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricItem: {
    width: '47%',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 12,
  },
});
