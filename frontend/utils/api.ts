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
  return ''; // Relative path for single-domain same-origin deployments
};

export const BACKEND_URL = getBackendUrl();
export const API_URL = `${BACKEND_URL}/api`;

export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  try {
    const token = await AsyncStorage.getItem('token');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'API call failed');
    }

    return await response.json();
  } catch (error: any) {
    throw new Error(error.message || 'Network error');
  }
};
