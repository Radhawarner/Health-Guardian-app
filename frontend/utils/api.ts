import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const getBackendUrl = () => {
  const envUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl) {
    return envUrl;
  }
  if (__DEV__) {
    return 'http://localhost:8001';
  }
  return '';
};

export const BACKEND_URL = getBackendUrl();
export const API_URL = `${BACKEND_URL}/api`;

// Fetch with timeout support
const fetchWithTimeout = (url: string, options: RequestInit, timeoutMs = 60000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

// Warm up the Render backend (fire-and-forget, called on app load)
export const warmUpBackend = async () => {
  if (!BACKEND_URL) return;
  try {
    await fetchWithTimeout(`${BACKEND_URL}/health`, { method: 'GET' }, 60000);
  } catch {
    // Ignore — this is just a wake-up call
  }
};

export const apiCall = async (
  endpoint: string,
  options: RequestInit = {},
  retries = 2
): Promise<any> => {
  const token = await AsyncStorage.getItem('token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      }, 60000);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'API call failed');
      }

      return await response.json();
    } catch (error: any) {
      const isLastAttempt = attempt === retries;
      const isAbort = error.name === 'AbortError';

      if (isLastAttempt) {
        if (isAbort) {
          throw new Error('Request timed out. The server may be waking up — please try again in a moment.');
        }
        throw new Error(error.message || 'Network error');
      }
      // Wait 2s before retrying
      await new Promise(res => setTimeout(res, 2000));
    }
  }
};
