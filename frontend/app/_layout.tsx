import React, { useEffect, useState, useCallback } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiCall, warmUpBackend } from '../utils/api';
import '../utils/i18n';

// Configure notification behavior for when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Register service worker on web
if (Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('Service Worker registered:', reg.scope))
      .catch((err) => console.warn('Service Worker registration failed:', err));
  });
}

// Warm up Render backend as early as possible to avoid cold-start on mobile
warmUpBackend();

// Global variable to hold the deferred install prompt
let deferredPrompt: any = null;

function InstallBanner() {
  const [showInstall, setShowInstall] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      setShowInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);

    // Also detect if already installed (standalone mode)
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstall(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('Install prompt outcome:', outcome);
    deferredPrompt = null;
    setShowInstall(false);
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (!showInstall || dismissed || Platform.OS !== 'web') return null;

  return (
    <View style={installStyles.container}>
      <View style={installStyles.banner}>
        <View style={installStyles.textContainer}>
          <Text style={installStyles.title}>📱 Install Health Guardian</Text>
          <Text style={installStyles.subtitle}>Add to your home screen for quick access</Text>
        </View>
        <View style={installStyles.buttonRow}>
          <TouchableOpacity onPress={handleInstall} style={installStyles.installButton}>
            <Text style={installStyles.installButtonText}>Install</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDismiss} style={installStyles.dismissButton}>
            <Text style={installStyles.dismissButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const installStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    pointerEvents: 'box-none',
  },
  banner: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 420,
    width: '90%',
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: '#aaaacc',
    fontSize: 12,
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  installButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  installButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  dismissButton: {
    padding: 6,
  },
  dismissButtonText: {
    color: '#888',
    fontSize: 18,
  },
});

function AppNavigator() {
  const { token } = useAuth();

  useEffect(() => {
    async function registerForPushNotificationsAsync() {
      if (Platform.OS === 'web') {
        return;
      }
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          console.log('Push notification permissions denied');
          return;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        const expoPushToken = tokenData.data;
        await AsyncStorage.setItem('push_token', expoPushToken);

        if (token) {
          await apiCall('/users/push-token', {
            method: 'POST',
            body: JSON.stringify({ token: expoPushToken }),
          });
          console.log('Push token successfully registered with backend:', expoPushToken);
        }
      } catch (error) {
        console.warn('Could not retrieve/register Expo push token:', error);
      }
    }

    registerForPushNotificationsAsync();
  }, [token]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(auth)/register" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="share/[token]" />
    </Stack>
  );
}

import Toast from 'react-native-toast-message';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppNavigator />
        <InstallBanner />
        <Toast />
      </AuthProvider>
    </ThemeProvider>
  );
}
