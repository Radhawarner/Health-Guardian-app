import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../contexts/ThemeContext';
import { LineChart } from 'react-native-gifted-charts';
import { apiCall } from '../../utils/api';
import { format } from 'date-fns';

interface HealthLog {
  id: string;
  date: string;
  weight?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  blood_sugar?: number;
  heart_rate?: number;
}

const screenWidth = Dimensions.get('window').width;

export default function HealthScreen() {
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [weight, setWeight] = useState('');
  const [systolicBP, setSystolicBP] = useState('');
  const [diastolicBP, setDiastolicBP] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { colors, isDark } = useTheme();
  const [selectedMetric, setSelectedMetric] = useState<string>('weight');

  useEffect(() => {
    loadHealthLogs();
  }, []);

  const loadHealthLogs = async () => {
    try {
      const data = await apiCall('/health-logs?limit=30');
      setLogs(data.reverse()); // Reverse to show oldest first for charts
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
    loadHealthLogs();
  };

  const handleAddLog = async () => {
    if (!weight && !systolicBP && !bloodSugar && !heartRate) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter at least one health metric',
      });
      return;
    }

    const logData: any = {};
    if (weight) logData.weight = parseFloat(weight);
    if (systolicBP) logData.systolic_bp = parseInt(systolicBP);
    if (diastolicBP) logData.diastolic_bp = parseInt(diastolicBP);
    if (bloodSugar) logData.blood_sugar = parseFloat(bloodSugar);
    if (heartRate) logData.heart_rate = parseInt(heartRate);

    setSubmitting(true);
    try {
      await apiCall('/health-logs', {
        method: 'POST',
        body: JSON.stringify(logData),
      });

      setShowAddModal(false);
      resetForm();
      loadHealthLogs();
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Health log added successfully',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setWeight('');
    setSystolicBP('');
    setDiastolicBP('');
    setBloodSugar('');
    setHeartRate('');
  };

  const getChartData = (metric: string) => {
    const filteredLogs = logs.filter((log) => {
      switch (metric) {
        case 'weight':
          return log.weight;
        case 'bp':
          return log.systolic_bp;
        case 'sugar':
          return log.blood_sugar;
        case 'heart':
          return log.heart_rate;
        default:
          return false;
      }
    });

    return filteredLogs.slice(-10).map((log, index) => ({
      value:
        metric === 'weight'
          ? log.weight!
          : metric === 'bp'
          ? log.systolic_bp!
          : metric === 'sugar'
          ? log.blood_sugar!
          : log.heart_rate!,
      label: format(new Date(log.date), 'MM/dd'),
    }));
  };

  const getLatestValue = (metric: string) => {
    const latestLog = logs[logs.length - 1];
    if (!latestLog) return 'N/A';

    switch (metric) {
      case 'weight':
        return latestLog.weight ? `${latestLog.weight} kg` : 'N/A';
      case 'bp':
        return latestLog.systolic_bp
          ? `${latestLog.systolic_bp}/${latestLog.diastolic_bp || 0}`
          : 'N/A';
      case 'sugar':
        return latestLog.blood_sugar ? `${latestLog.blood_sugar} mg/dL` : 'N/A';
      case 'heart':
        return latestLog.heart_rate ? `${latestLog.heart_rate} bpm` : 'N/A';
      default:
        return 'N/A';
    }
  };

  const getMetricColor = (metric: string) => {
    switch (metric) {
      case 'weight':
        return '#3498DB';
      case 'bp':
        return '#E74C3C';
      case 'sugar':
        return '#9B59B6';
      case 'heart':
        return '#E91E63';
      default:
        return '#4A90E2';
    }
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'weight':
        return 'fitness';
      case 'bp':
        return 'heart';
      case 'sugar':
        return 'water';
      case 'heart':
        return 'pulse';
      default:
        return 'stats-chart';
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
    scrollView: {
      flex: 1,
    },
    metricsSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 12,
      gap: 12,
    },
    metricCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
    },
    metricCardActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    metricLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    metricLabelActive: {
      color: '#fff',
    },
    metricValue: {
      fontSize: 14,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 4,
    },
    metricValueActive: {
      color: '#fff',
    },
    chartContainer: {
      backgroundColor: colors.card,
      margin: 16,
      padding: 16,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    chartTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
    },
    emptyChart: {
      alignItems: 'center',
      padding: 48,
      marginHorizontal: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
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
      fontWeight: '600',
    },
    emptySubtext: {
      marginTop: 4,
      fontSize: 14,
      color: colors.textSecondary,
    },
    logsSection: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
    logCard: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    logDate: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    logMetrics: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    logMetric: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    logMetricText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    addButton: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
    },
    modalBody: {
      padding: 20,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      marginTop: 12,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
    },
    bpContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    bpInput: {
      flex: 1,
    },
    bpSeparator: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 16,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
  });

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const chartData = getChartData(selectedMetric);

  return (
    <View style={dynamicStyles.container}>
      <ScrollView
        style={dynamicStyles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Metrics Selector */}
        <View style={dynamicStyles.metricsSelector}>
          {[
            { key: 'weight', label: 'Weight', icon: 'fitness' },
            { key: 'bp', label: 'Blood Pressure', icon: 'heart' },
            { key: 'sugar', label: 'Blood Sugar', icon: 'water' },
            { key: 'heart', label: 'Heart Rate', icon: 'pulse' },
          ].map((metric) => (
            <TouchableOpacity
              key={metric.key}
              style={[
                dynamicStyles.metricCard,
                selectedMetric === metric.key && dynamicStyles.metricCardActive,
              ]}
              onPress={() => setSelectedMetric(metric.key)}
            >
              <Ionicons
                name={metric.icon as any}
                size={28}
                color={
                  selectedMetric === metric.key ? '#fff' : getMetricColor(metric.key)
                }
              />
              <Text
                style={[
                  dynamicStyles.metricLabel,
                  selectedMetric === metric.key && dynamicStyles.metricLabelActive,
                ]}
              >
                {metric.label}
              </Text>
              <Text
                style={[
                  dynamicStyles.metricValue,
                  selectedMetric === metric.key && dynamicStyles.metricValueActive,
                ]}
              >
                {getLatestValue(metric.key)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart */}
        {chartData.length > 0 ? (
          <View style={dynamicStyles.chartContainer}>
            <Text style={dynamicStyles.chartTitle}>
              {selectedMetric === 'weight'
                ? 'Weight'
                : selectedMetric === 'bp'
                ? 'Blood Pressure (Systolic)'
                : selectedMetric === 'sugar'
                ? 'Blood Sugar'
                : 'Heart Rate'}{' '}
              Trend
            </Text>
            <LineChart
              data={chartData}
              width={screenWidth - 48}
              height={220}
              color={getMetricColor(selectedMetric)}
              thickness={3}
              startFillColor={getMetricColor(selectedMetric)}
              endFillColor={getMetricColor(selectedMetric)}
              startOpacity={0.4}
              endOpacity={0.1}
              spacing={chartData.length > 5 ? 40 : 60}
              initialSpacing={20}
              noOfSections={5}
              yAxisColor={colors.border}
              xAxisColor={colors.border}
              yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
              areaChart
              curved
            />
          </View>
        ) : (
          <View style={dynamicStyles.emptyChart}>
            <Ionicons name="stats-chart-outline" size={64} color="#BDC3C7" />
            <Text style={dynamicStyles.emptyText}>No data available for this metric</Text>
            <Text style={dynamicStyles.emptySubtext}>Add health logs to see trends</Text>
          </View>
        )}

        {/* Recent Logs */}
        <View style={dynamicStyles.logsSection}>
          <Text style={dynamicStyles.sectionTitle}>Recent Logs</Text>
          {logs.length === 0 ? (
            <View style={dynamicStyles.emptyState}>
              <Ionicons name="clipboard-outline" size={48} color="#BDC3C7" />
              <Text style={dynamicStyles.emptyText}>No health logs yet</Text>
            </View>
          ) : (
            logs
              .slice()
              .reverse()
              .slice(0, 10)
              .map((log) => (
                <View key={log.id} style={dynamicStyles.logCard}>
                  <Text style={dynamicStyles.logDate}>
                    {format(new Date(log.date), 'MMMM dd, yyyy')}
                  </Text>
                  <View style={dynamicStyles.logMetrics}>
                    {log.weight && (
                      <View style={dynamicStyles.logMetric}>
                        <Ionicons name="fitness" size={16} color="#3498DB" />
                        <Text style={dynamicStyles.logMetricText}>{log.weight} kg</Text>
                      </View>
                    )}
                    {log.systolic_bp && (
                      <View style={dynamicStyles.logMetric}>
                        <Ionicons name="heart" size={16} color="#E74C3C" />
                        <Text style={dynamicStyles.logMetricText}>
                          {log.systolic_bp}/{log.diastolic_bp}
                        </Text>
                      </View>
                    )}
                    {log.blood_sugar && (
                      <View style={dynamicStyles.logMetric}>
                        <Ionicons name="water" size={16} color="#9B59B6" />
                        <Text style={dynamicStyles.logMetricText}>
                          {log.blood_sugar} mg/dL
                        </Text>
                      </View>
                    )}
                    {log.heart_rate && (
                      <View style={dynamicStyles.logMetric}>
                        <Ionicons name="pulse" size={16} color="#E91E63" />
                        <Text style={dynamicStyles.logMetricText}>{log.heart_rate} bpm</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
          )}
        </View>
      </ScrollView>

      <TouchableOpacity style={dynamicStyles.addButton} onPress={() => setShowAddModal(true)}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Add Health Log Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Add Health Log</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={dynamicStyles.modalBody}>
              <Text style={dynamicStyles.label}>Weight (kg)</Text>
              <TextInput
                style={dynamicStyles.input}
                placeholder="e.g., 70.5"
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={dynamicStyles.label}>Blood Pressure (mmHg)</Text>
              <View style={dynamicStyles.bpContainer}>
                <TextInput
                  style={[dynamicStyles.input, dynamicStyles.bpInput]}
                  placeholder="Systolic"
                  value={systolicBP}
                  onChangeText={setSystolicBP}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={dynamicStyles.bpSeparator}>/</Text>
                <TextInput
                  style={[dynamicStyles.input, dynamicStyles.bpInput]}
                  placeholder="Diastolic"
                  value={diastolicBP}
                  onChangeText={setDiastolicBP}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <Text style={dynamicStyles.label}>Blood Sugar (mg/dL)</Text>
              <TextInput
                style={dynamicStyles.input}
                placeholder="e.g., 110"
                value={bloodSugar}
                onChangeText={setBloodSugar}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={dynamicStyles.label}>Heart Rate (bpm)</Text>
              <TextInput
                style={dynamicStyles.input}
                placeholder="e.g., 72"
                value={heartRate}
                onChangeText={setHeartRate}
                keyboardType="number-pad"
                placeholderTextColor={colors.textSecondary}
              />

              <TouchableOpacity
                style={[dynamicStyles.submitButton, submitting && dynamicStyles.submitButtonDisabled]}
                onPress={handleAddLog}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={dynamicStyles.submitButtonText}>Add Log</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Styles deleted to use dynamicStyles inline
