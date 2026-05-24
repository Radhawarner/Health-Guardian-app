import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useTheme } from '../contexts/ThemeContext';

interface MissedMedicine {
  id: string;
  medicine_name: string;
  dosage: string;
  scheduled_time: string;
}

interface Props {
  visible: boolean;
  missedMedicines: MissedMedicine[];
  onClose: () => void;
  onMarkTaken: (id: string) => void;
}

export default function MissedMedicineAlert({
  visible,
  missedMedicines,
  onClose,
  onMarkTaken,
}: Props) {
  const { colors } = useTheme();
  const [scaleAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible && missedMedicines.length > 0) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();

      // Speak the alert
      const medicineNames = missedMedicines.map((m) => m.medicine_name).join(', ');
      Speech.speak(
        `Reminder! You have ${missedMedicines.length} missed ${
          missedMedicines.length === 1 ? 'medicine' : 'medicines'
        }: ${medicineNames}. Please take your medicine now.`,
        {
          language: 'en-US',
          pitch: 1.0,
          rate: 0.9,
        }
      );
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible, missedMedicines]);

  const handleClose = () => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const speakMedicine = (medicine: MissedMedicine) => {
    Speech.speak(
      `${medicine.medicine_name}, ${medicine.dosage}, scheduled for ${medicine.scheduled_time}`,
      {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
      }
    );
  };

  if (!visible || missedMedicines.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            { backgroundColor: colors.card, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="alarm" size={80} color="#E74C3C" />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            ⚠️ Missed Medicine Alert
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            You have {missedMedicines.length} missed{' '}
            {missedMedicines.length === 1 ? 'medicine' : 'medicines'}
          </Text>

          <View style={styles.medicineList}>
            {missedMedicines.map((medicine) => (
              <View
                key={medicine.id}
                style={[styles.medicineCard, { backgroundColor: colors.background }]}
              >
                <View style={styles.medicineInfo}>
                  <TouchableOpacity
                    onPress={() => speakMedicine(medicine)}
                    style={styles.speakerButton}
                  >
                    <Ionicons name="volume-high" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <View style={styles.medicineDetails}>
                    <Text style={[styles.medicineName, { color: colors.text }]}>
                      {medicine.medicine_name}
                    </Text>
                    <Text style={[styles.medicineDosage, { color: colors.textSecondary }]}>
                      {medicine.dosage} - {medicine.scheduled_time}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.takenButton}
                  onPress={() => onMarkTaken(medicine.id)}
                >
                  <Ionicons name="checkmark-circle" size={32} color="#27AE60" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>I'll Take Them Now</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dismissButton} onPress={handleClose}>
            <Text style={[styles.dismissText, { color: colors.textSecondary }]}>
              Dismiss
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  medicineList: {
    width: '100%',
    maxHeight: 300,
  },
  medicineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  medicineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  speakerButton: {
    padding: 8,
    marginRight: 12,
  },
  medicineDetails: {
    flex: 1,
  },
  medicineName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  medicineDosage: {
    fontSize: 14,
    marginTop: 4,
  },
  takenButton: {
    marginLeft: 12,
  },
  closeButton: {
    backgroundColor: '#27AE60',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dismissButton: {
    marginTop: 12,
    padding: 8,
  },
  dismissText: {
    fontSize: 16,
  },
});
