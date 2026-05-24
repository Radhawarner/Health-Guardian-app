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
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../contexts/ThemeContext';
import { apiCall } from '../../utils/api';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface Medicine {
  id: string;
  name: string;
  dosage: string;
  timing: string[];
  frequency: string;
  active: boolean;
}

// Default alarm times for each slot
const DEFAULT_ALARM_TIMES: Record<string, { hour: number; minute: number }> = {
  morning: { hour: 8, minute: 0 },
  afternoon: { hour: 13, minute: 0 },
  night: { hour: 21, minute: 0 },
};

const TIME_ICONS: Record<string, any> = {
  morning: 'sunny',
  afternoon: 'partly-sunny',
  night: 'moon',
};

const TIME_COLORS: Record<string, string> = {
  morning: '#F39C12',
  afternoon: '#E67E22',
  night: '#8E44AD',
};

async function scheduleAlarmForMedicine(
  medicineName: string,
  dosage: string,
  timingSlot: string,
  hour: number,
  minute: number
): Promise<string | null> {
  // Web does not support scheduled (daily trigger) notifications
  if (Platform.OS === 'web') {
    console.log(`[Web] Alarm would fire at ${hour}:${minute} for ${medicineName} (${timingSlot})`);
    return null;
  }
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💊 Medicine Reminder',
        body: `Time to take ${medicineName} (${dosage}) — ${
          timingSlot.charAt(0).toUpperCase() + timingSlot.slice(1)
        }`,
        sound: true,
        data: { medicineName, timingSlot },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        repeats: true,
      } as any,
    });
    return id;
  } catch (e) {
    console.warn('Alarm schedule failed:', e);
    return null;
  }
}

async function cancelAlarmsForMedicine(notificationIds: string[]) {
  for (const id of notificationIds) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

// Convert 24h to 12h format
function to12Hour(hour24: number): { hour12: number; ampm: 'AM' | 'PM' } {
  if (hour24 === 0) return { hour12: 12, ampm: 'AM' };
  if (hour24 < 12) return { hour12: hour24, ampm: 'AM' };
  if (hour24 === 12) return { hour12: 12, ampm: 'PM' };
  return { hour12: hour24 - 12, ampm: 'PM' };
}

// Convert 12h back to 24h
function to24Hour(hour12: number, ampm: 'AM' | 'PM'): number {
  if (ampm === 'AM') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

// Format 24h time as "8:00 AM"
function formatTime12(hour24: number, minute: number): string {
  const { hour12, ampm } = to12Hour(hour24);
  return `${hour12}:${pad(minute)} ${ampm}`;
}

export default function MedicinesScreen() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [selectedTiming, setSelectedTiming] = useState<string[]>([]);
  const [alarmTimes, setAlarmTimes] = useState<Record<string, { hour: number; minute: number }>>(
    { ...DEFAULT_ALARM_TIMES }
  );
  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [medicineToDelete, setMedicineToDelete] = useState<{ id: string; name: string } | null>(null);
  const [activeTimingSlot, setActiveTimingSlot] = useState<string>('morning');
  const [pickerHour, setPickerHour] = useState(8); // 1-12 display hour
  const [pickerMinute, setPickerMinute] = useState(0);
  const [pickerAmPm, setPickerAmPm] = useState<'AM' | 'PM'>('AM');

  const { colors, isDark } = useTheme();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadMedicines();
    // Request notification permissions on mount
    Notifications.requestPermissionsAsync();
  }, []);

  const loadMedicines = async () => {
    try {
      const data = await apiCall('/medicines');
      setMedicines(data);
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
    loadMedicines();
  };

  const toggleTiming = (time: string) => {
    if (selectedTiming.includes(time)) {
      setSelectedTiming(selectedTiming.filter((t) => t !== time));
    } else {
      setSelectedTiming([...selectedTiming, time]);
    }
  };

  const openTimePicker = (slot: string) => {
    setActiveTimingSlot(slot);
    const { hour12, ampm } = to12Hour(alarmTimes[slot].hour);
    setPickerHour(hour12);
    setPickerMinute(alarmTimes[slot].minute);
    setPickerAmPm(ampm);
    setShowTimePicker(true);
  };

  const confirmTimePicker = () => {
    const hour24 = to24Hour(pickerHour, pickerAmPm);
    setAlarmTimes((prev) => ({
      ...prev,
      [activeTimingSlot]: { hour: hour24, minute: pickerMinute },
    }));
    setShowTimePicker(false);
  };

  const handleAddMedicine = async () => {
    if (!name || !dosage || selectedTiming.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all fields and select at least one timing',
      });
      return;
    }

    setSubmitting(true);
    try {
      await apiCall('/medicines', {
        method: 'POST',
        body: JSON.stringify({
          name,
          dosage,
          timing: selectedTiming,
          frequency,
        }),
      });

      // Schedule local alarms for each selected timing slot
      const scheduled: string[] = [];
      for (const slot of selectedTiming) {
        const { hour, minute } = alarmTimes[slot];
        const notifId = await scheduleAlarmForMedicine(name, dosage, slot, hour, minute);
        if (notifId) scheduled.push(notifId);
      }

      setShowAddModal(false);
      resetForm();
      loadMedicines();

      const alarmSummary = selectedTiming
        .map(
          (s) =>
            `${s.charAt(0).toUpperCase() + s.slice(1)}: ${formatTime12(alarmTimes[s].hour, alarmTimes[s].minute)}`
        )
        .join('\n');

      const isWeb = Platform.OS === 'web';
      Toast.show({
        type: 'success',
        text1: 'Medicine Added',
        text2: isWeb
          ? `${name} added. Web push alarms not supported.`
          : `${name} added with daily alarms.`,
        visibilityTime: 4000,
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

  const handleDeleteMedicine = (id: string, medicineName: string) => {
    setMedicineToDelete({ id, name: medicineName });
  };

  const confirmDelete = async () => {
    if (!medicineToDelete) return;
    const { id, name } = medicineToDelete;
    
    // Close modal immediately
    setMedicineToDelete(null);
    
    // Optimistic UI — remove from list immediately
    setMedicines((prev) => prev.filter((m) => m.id !== id));
    try {
      await apiCall(`/medicines/${id}`, { method: 'DELETE' });
      // Sync with server in background
      loadMedicines();
    } catch (error: any) {
      // Revert optimistic update on error
      loadMedicines();
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to delete medicine',
      });
    }
  };

  const resetForm = () => {
    setName('');
    setDosage('');
    setSelectedTiming([]);
    setFrequency('daily');
    setAlarmTimes({ ...DEFAULT_ALARM_TIMES });
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
    scrollView: { flex: 1 },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      marginTop: 100,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    medicinesList: { padding: 16 },
    medicineCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    medicineHeader: { flexDirection: 'row', alignItems: 'flex-start' },
    medicineIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: isDark ? '#1a365d' : '#EBF5FB',
      justifyContent: 'center',
      alignItems: 'center',
    },
    medicineInfo: { flex: 1, marginLeft: 12 },
    medicineName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    medicineDosage: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    timingContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 10,
      gap: 8,
    },
    timingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      gap: 4,
    },
    timingText: {
      fontSize: 12,
      color: '#fff',
      fontWeight: '700',
    },
    frequency: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 8,
      fontStyle: 'italic',
    },
    deleteButton: { padding: 8 },
    addButton: {
      position: 'absolute',
      right: 20,
      bottom: 20,
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 10,
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: '92%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: colors.text },
    modalBody: { padding: 20 },
    label: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      marginTop: 14,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
    },
    // Timing options
    timingOptions: { gap: 10 },
    timingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    timingRowActive: {
      borderColor: colors.primary,
    },
    timingToggle: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      gap: 10,
    },
    timingToggleActive: {
      backgroundColor: colors.primary + '18',
    },
    timingOptionText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    timingOptionTextActive: { color: colors.primary },
    alarmTimeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
      gap: 6,
    },
    alarmTimeBtnActive: {
      backgroundColor: colors.primary + '18',
      borderLeftColor: colors.primary,
    },
    alarmTimeText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    alarmTimeTextActive: { color: colors.primary },
    // Frequency
    frequencyOptions: { flexDirection: 'row', gap: 12 },
    frequencyOption: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
    },
    frequencyOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    frequencyOptionText: { fontSize: 15, fontWeight: '600', color: colors.text },
    frequencyOptionTextActive: { color: '#fff' },
    // Submit
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      padding: 16,
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 20,
    },
    submitButtonDisabled: { opacity: 0.6 },
    submitButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
    // Time picker modal
    timePickerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    timePickerCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 28,
      width: '100%',
      alignItems: 'center',
    },
    timePickerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 24,
    },
    timeDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 28,
    },
    timeDigitBlock: { alignItems: 'center' },
    timeDigitText: {
      fontSize: 56,
      fontWeight: '800',
      color: colors.primary,
      lineHeight: 64,
    },
    timeColon: {
      fontSize: 48,
      fontWeight: '800',
      color: colors.primary,
      marginHorizontal: 8,
      lineHeight: 64,
    },
    timeAdjustRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 6,
    },
    timeAdjustBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? '#2d3748' : '#f0f4f8',
      justifyContent: 'center',
      alignItems: 'center',
    },
    timeAdjustLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
      width: 52,
      textAlign: 'center',
    },
    timePickerActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
      width: '100%',
    },
    timePickerCancel: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
    },
    timePickerCancelText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
    timePickerConfirm: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    timePickerConfirmText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  });

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <ScrollView
        style={dynamicStyles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {medicines.length === 0 ? (
          <View style={dynamicStyles.emptyState}>
            <Ionicons name="medkit-outline" size={72} color={colors.textSecondary} />
            <Text style={dynamicStyles.emptyText}>No medicines added yet</Text>
            <Text style={dynamicStyles.emptySubtext}>
              Tap the + button to add your first medicine with alarm reminders
            </Text>
          </View>
        ) : (
          <View style={dynamicStyles.medicinesList}>
            {medicines.map((medicine) => (
              <View key={medicine.id} style={dynamicStyles.medicineCard}>
                <View style={dynamicStyles.medicineHeader}>
                  <View style={dynamicStyles.medicineIcon}>
                    <Ionicons name="medkit" size={26} color={colors.primary} />
                  </View>
                  <View style={dynamicStyles.medicineInfo}>
                    <Text style={dynamicStyles.medicineName}>{medicine.name}</Text>
                    <Text style={dynamicStyles.medicineDosage}>{medicine.dosage}</Text>
                    <View style={dynamicStyles.timingContainer}>
                      {medicine.timing.map((time) => (
                        <View
                          key={time}
                          style={[
                            dynamicStyles.timingBadge,
                            { backgroundColor: TIME_COLORS[time] || '#4A90E2' },
                          ]}
                        >
                          <Ionicons name={TIME_ICONS[time] || 'time'} size={12} color="#fff" />
                          <Text style={dynamicStyles.timingText}>
                            {time.charAt(0).toUpperCase() + time.slice(1)}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <Text style={dynamicStyles.frequency}>
                      📅 {medicine.frequency === 'daily' ? 'Daily' : 'Weekly'} • 🔔 Alarm active
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={dynamicStyles.deleteButton}
                    onPress={() => handleDeleteMedicine(medicine.id, medicine.name)}
                  >
                    <Ionicons name="trash-outline" size={22} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={dynamicStyles.addButton} onPress={() => setShowAddModal(true)}>
        <Ionicons name="add" size={34} color="#fff" />
      </TouchableOpacity>

      {/* ── Add Medicine Modal ── */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Add Medicine</Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={dynamicStyles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={dynamicStyles.label}>Medicine Name</Text>
              <TextInput
                style={dynamicStyles.input}
                placeholder="e.g., Aspirin"
                value={name}
                onChangeText={setName}
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={dynamicStyles.label}>Dosage</Text>
              <TextInput
                style={dynamicStyles.input}
                placeholder="e.g., 500mg"
                value={dosage}
                onChangeText={setDosage}
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={dynamicStyles.label}>Timing & Alarm Time</Text>
              <View style={dynamicStyles.timingOptions}>
                {['morning', 'afternoon', 'night'].map((slot) => {
                  const isActive = selectedTiming.includes(slot);
                  const t = alarmTimes[slot];
                  return (
                    <View
                      key={slot}
                      style={[
                        dynamicStyles.timingRow,
                        isActive && dynamicStyles.timingRowActive,
                      ]}
                    >
                      {/* Left: toggle timing on/off */}
                      <TouchableOpacity
                        style={[
                          dynamicStyles.timingToggle,
                          isActive && dynamicStyles.timingToggleActive,
                        ]}
                        onPress={() => toggleTiming(slot)}
                      >
                        <Ionicons
                          name={TIME_ICONS[slot]}
                          size={22}
                          color={isActive ? colors.primary : colors.textSecondary}
                        />
                        <Text
                          style={[
                            dynamicStyles.timingOptionText,
                            isActive && dynamicStyles.timingOptionTextActive,
                          ]}
                        >
                          {slot.charAt(0).toUpperCase() + slot.slice(1)}
                        </Text>
                      </TouchableOpacity>

                      {/* Right: alarm time button */}
                      <TouchableOpacity
                        style={[
                          dynamicStyles.alarmTimeBtn,
                          isActive && dynamicStyles.alarmTimeBtnActive,
                        ]}
                        onPress={() => openTimePicker(slot)}
                      >
                        <Ionicons
                          name="alarm"
                          size={16}
                          color={isActive ? colors.primary : colors.textSecondary}
                        />
                        <Text
                          style={[
                            dynamicStyles.alarmTimeText,
                            isActive && dynamicStyles.alarmTimeTextActive,
                          ]}
                        >
                          {formatTime12(t.hour, t.minute)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              <Text style={dynamicStyles.label}>Frequency</Text>
              <View style={dynamicStyles.frequencyOptions}>
                {['daily', 'weekly'].map((freq) => (
                  <TouchableOpacity
                    key={freq}
                    style={[
                      dynamicStyles.frequencyOption,
                      frequency === freq && dynamicStyles.frequencyOptionActive,
                    ]}
                    onPress={() => setFrequency(freq)}
                  >
                    <Text
                      style={[
                        dynamicStyles.frequencyOptionText,
                        frequency === freq && dynamicStyles.frequencyOptionTextActive,
                      ]}
                    >
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[dynamicStyles.submitButton, submitting && dynamicStyles.submitButtonDisabled]}
                onPress={handleAddMedicine}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={dynamicStyles.submitButtonText}>🔔 Add Medicine & Set Alarms</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Custom Time Picker Modal (12h AM/PM) ── */}
      <Modal
        visible={showTimePicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={dynamicStyles.timePickerOverlay}>
          <View style={dynamicStyles.timePickerCard}>
            <Text style={dynamicStyles.timePickerTitle}>
              Set {activeTimingSlot.charAt(0).toUpperCase() + activeTimingSlot.slice(1)} Alarm
            </Text>

            {/* Time display: HH : MM  AM/PM */}
            <View style={dynamicStyles.timeDisplay}>
              {/* Hours (1–12) */}
              <View style={dynamicStyles.timeDigitBlock}>
                <TouchableOpacity
                  style={dynamicStyles.timeAdjustBtn}
                  onPress={() => setPickerHour((h) => h === 12 ? 1 : h + 1)}
                >
                  <Ionicons name="chevron-up" size={22} color={colors.primary} />
                </TouchableOpacity>
                <Text style={dynamicStyles.timeDigitText}>{pad(pickerHour)}</Text>
                <TouchableOpacity
                  style={dynamicStyles.timeAdjustBtn}
                  onPress={() => setPickerHour((h) => h === 1 ? 12 : h - 1)}
                >
                  <Ionicons name="chevron-down" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <Text style={dynamicStyles.timeColon}>:</Text>

              {/* Minutes */}
              <View style={dynamicStyles.timeDigitBlock}>
                <TouchableOpacity
                  style={dynamicStyles.timeAdjustBtn}
                  onPress={() => setPickerMinute((m) => (m + 5) % 60)}
                >
                  <Ionicons name="chevron-up" size={22} color={colors.primary} />
                </TouchableOpacity>
                <Text style={dynamicStyles.timeDigitText}>{pad(pickerMinute)}</Text>
                <TouchableOpacity
                  style={dynamicStyles.timeAdjustBtn}
                  onPress={() => setPickerMinute((m) => (m - 5 + 60) % 60)}
                >
                  <Ionicons name="chevron-down" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* AM / PM toggle */}
              <View style={{ marginLeft: 16, justifyContent: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setPickerAmPm('AM')}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: pickerAmPm === 'AM' ? colors.primary : (isDark ? '#2d3748' : '#f0f4f8'),
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: '800', color: pickerAmPm === 'AM' ? '#fff' : colors.textSecondary }}>
                    AM
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPickerAmPm('PM')}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: pickerAmPm === 'PM' ? colors.primary : (isDark ? '#2d3748' : '#f0f4f8'),
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: '800', color: pickerAmPm === 'PM' ? '#fff' : colors.textSecondary }}>
                    PM
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={dynamicStyles.timeAdjustRow}>
              <Text style={dynamicStyles.timeAdjustLabel}>Hour</Text>
              <View style={{ width: 16 }} />
              <Text style={dynamicStyles.timeAdjustLabel}>Min</Text>
              <View style={{ width: 48 }} />
            </View>

            <View style={dynamicStyles.timePickerActions}>
              <TouchableOpacity
                style={dynamicStyles.timePickerCancel}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={dynamicStyles.timePickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={dynamicStyles.timePickerConfirm}
                onPress={confirmTimePicker}
              >
                <Text style={dynamicStyles.timePickerConfirmText}>Set Alarm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        visible={medicineToDelete !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setMedicineToDelete(null)}
      >
        <View style={dynamicStyles.timePickerOverlay}>
          <View style={dynamicStyles.timePickerCard}>
            <Ionicons name="trash" size={48} color={colors.danger} style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
              Delete Medicine
            </Text>
            <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
              Are you sure you want to delete <Text style={{ fontWeight: 'bold', color: colors.text }}>{medicineToDelete?.name}</Text>?{'\n'}This action cannot be undone.
            </Text>
            <View style={dynamicStyles.timePickerActions}>
              <TouchableOpacity
                style={dynamicStyles.timePickerCancel}
                onPress={() => setMedicineToDelete(null)}
              >
                <Text style={dynamicStyles.timePickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.timePickerConfirm, { backgroundColor: colors.danger }]}
                onPress={confirmDelete}
              >
                <Text style={dynamicStyles.timePickerConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
