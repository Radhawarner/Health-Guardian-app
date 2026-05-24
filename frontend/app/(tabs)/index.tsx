import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { apiCall } from '../../utils/api';

interface Medicine {
  id: string;
  medicine_name: string;
  dosage: string;
  scheduled_time: string;
  status: string;
}

interface HealthStats {
  weight?: number;
  blood_pressure?: string;
  blood_sugar?: number;
  heart_rate?: number;
  date: string;
}

interface AlertItem {
  id: string;
  type: string;
  message: string;
  severity: string;
  created_at: string;
}

interface RiskPrediction {
  overall_risk_level: string;
  overall_risk_score: number;
  recommendations: string[];
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayMedicines, setTodayMedicines] = useState<Medicine[]>([]);
  const [healthStats, setHealthStats] = useState<HealthStats | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [riskPrediction, setRiskPrediction] = useState<RiskPrediction | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const data = await apiCall('/dashboard');
      setTodayMedicines(data.today_medicines || []);
      setHealthStats(data.health_stats);
      setAlerts(data.alerts || []);
      setRiskPrediction(data.risk_prediction);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const markMedicineStatus = async (scheduleId: string, status: string) => {
    try {
      await apiCall(`/medicines/schedule/${scheduleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      loadDashboard();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message,
      });
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high':
        return '#E74C3C';
      case 'medium':
        return '#F39C12';
      case 'low':
        return '#27AE60';
      default:
        return '#95A5A6';
    }
  };

  const getTimeIcon = (time: string) => {
    switch (time) {
      case 'morning':
        return 'sunny';
      case 'afternoon':
        return 'partly-sunny';
      case 'night':
        return 'moon';
      default:
        return 'time';
    }
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.primary,
      padding: 24,
      paddingTop: 16,
    },
    greeting: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#fff',
    },
    subGreeting: {
      fontSize: 16,
      color: '#fff',
      opacity: 0.9,
      marginTop: 4,
    },
    section: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
    alertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
      borderLeftWidth: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    alertMessage: {
      flex: 1,
      marginLeft: 12,
      fontSize: 14,
      color: colors.text,
    },
    riskCard: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    riskHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    riskTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    riskBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    riskBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
    },
    riskScore: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 12,
    },
    recommendationsContainer: {
      marginTop: 8,
    },
    recommendationsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    recommendationItem: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    medicineCard: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    medicineHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    medicineInfo: {
      flex: 1,
      marginLeft: 12,
    },
    medicineName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
    },
    medicineDosage: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    medicineTime: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    medicineActions: {
      flexDirection: 'row',
      gap: 8,
    },
    statusButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    takenButton: {
      backgroundColor: colors.success,
    },
    missedButton: {
      backgroundColor: colors.danger,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    takenBadge: {
      backgroundColor: colors.success,
    },
    missedBadge: {
      backgroundColor: colors.danger,
    },
    statusBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
    },
    emptyState: {
      alignItems: 'center',
      padding: 32,
      backgroundColor: colors.card,
      borderRadius: 12,
    },
    emptyText: {
      marginTop: 12,
      fontSize: 16,
      color: colors.textSecondary,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    statCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 8,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
  });

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={dynamicStyles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.greeting}>Hello, {user?.name}!</Text>
          <Text style={dynamicStyles.subGreeting}>How are you feeling today?</Text>
        </View>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Alerts</Text>
            {alerts.map((alert) => (
              <View
                key={alert.id}
                style={[
                  dynamicStyles.alertCard,
                  { borderLeftColor: alert.severity === 'high' ? '#E74C3C' : '#F39C12' },
                ]}
              >
                <Ionicons
                  name={alert.type === 'medicine_missed' ? 'alarm' : 'warning'}
                  size={24}
                  color={alert.severity === 'high' ? '#E74C3C' : '#F39C12'}
                />
                <Text style={dynamicStyles.alertMessage}>{alert.message}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Risk Prediction */}
        {riskPrediction && riskPrediction.overall_risk_level !== 'unknown' && (
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Health Risk Assessment</Text>
            <View style={dynamicStyles.riskCard}>
              <View style={dynamicStyles.riskHeader}>
                <Text style={dynamicStyles.riskTitle}>Overall Risk Level</Text>
                <View
                  style={[
                    dynamicStyles.riskBadge,
                    { backgroundColor: getRiskColor(riskPrediction.overall_risk_level) },
                  ]}
                >
                  <Text style={dynamicStyles.riskBadgeText}>
                    {riskPrediction.overall_risk_level.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={dynamicStyles.riskScore}>
                Risk Score: {riskPrediction.overall_risk_score}/100
              </Text>
              {riskPrediction.recommendations.length > 0 && (
                <View style={dynamicStyles.recommendationsContainer}>
                  <Text style={dynamicStyles.recommendationsTitle}>Recommendations:</Text>
                  {riskPrediction.recommendations.slice(0, 2).map((rec, index) => (
                    <Text key={index} style={dynamicStyles.recommendationItem}>
                      • {rec}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Today's Medicines */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Today's Medicines</Text>
          {todayMedicines.length === 0 ? (
            <View style={dynamicStyles.emptyState}>
              <Ionicons name="medkit-outline" size={48} color="#BDC3C7" />
              <Text style={dynamicStyles.emptyText}>No medicines scheduled for today</Text>
            </View>
          ) : (
            todayMedicines.map((medicine) => (
              <View key={medicine.id} style={dynamicStyles.medicineCard}>
                <View style={dynamicStyles.medicineHeader}>
                  <Ionicons
                    name={getTimeIcon(medicine.scheduled_time)}
                    size={24}
                    color="#4A90E2"
                  />
                  <View style={dynamicStyles.medicineInfo}>
                    <Text style={dynamicStyles.medicineName}>{medicine.medicine_name}</Text>
                    <Text style={dynamicStyles.medicineDosage}>{medicine.dosage}</Text>
                    <Text style={dynamicStyles.medicineTime}>
                      {medicine.scheduled_time.charAt(0).toUpperCase() +
                        medicine.scheduled_time.slice(1)}
                    </Text>
                  </View>
                  <View style={dynamicStyles.medicineActions}>
                    {medicine.status === 'pending' ? (
                      <>
                        <TouchableOpacity
                          style={[dynamicStyles.statusButton, dynamicStyles.takenButton]}
                          onPress={() => markMedicineStatus(medicine.id, 'taken')}
                        >
                          <Ionicons name="checkmark" size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[dynamicStyles.statusButton, dynamicStyles.missedButton]}
                          onPress={() => markMedicineStatus(medicine.id, 'missed')}
                        >
                          <Ionicons name="close" size={20} color="#fff" />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View
                        style={[
                          dynamicStyles.statusBadge,
                          medicine.status === 'taken'
                            ? dynamicStyles.takenBadge
                            : dynamicStyles.missedBadge,
                        ]}
                      >
                        <Text style={dynamicStyles.statusBadgeText}>
                          {medicine.status.toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Health Stats */}
        {healthStats && (
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Latest Health Stats</Text>
            <View style={dynamicStyles.statsGrid}>
              {healthStats.weight && (
                <View style={dynamicStyles.statCard}>
                  <Ionicons name="fitness" size={32} color="#3498DB" />
                  <Text style={dynamicStyles.statValue}>{healthStats.weight} kg</Text>
                  <Text style={dynamicStyles.statLabel}>Weight</Text>
                </View>
              )}
              {healthStats.blood_pressure && (
                <View style={dynamicStyles.statCard}>
                  <Ionicons name="heart" size={32} color="#E74C3C" />
                  <Text style={dynamicStyles.statValue}>{healthStats.blood_pressure}</Text>
                  <Text style={dynamicStyles.statLabel}>Blood Pressure</Text>
                </View>
              )}
              {healthStats.blood_sugar && (
                <View style={dynamicStyles.statCard}>
                  <Ionicons name="water" size={32} color="#9B59B6" />
                  <Text style={dynamicStyles.statValue}>{healthStats.blood_sugar}</Text>
                  <Text style={dynamicStyles.statLabel}>Blood Sugar</Text>
                </View>
              )}
              {healthStats.heart_rate && (
                <View style={dynamicStyles.statCard}>
                  <Ionicons name="pulse" size={32} color="#E91E63" />
                  <Text style={dynamicStyles.statValue}>{healthStats.heart_rate}</Text>
                  <Text style={dynamicStyles.statLabel}>Heart Rate</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

// Styles deleted to use dynamicStyles inline
