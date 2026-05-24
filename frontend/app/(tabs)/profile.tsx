import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../../utils/i18n';
import { apiCall } from '../../utils/api';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language);

  const handleShare = async () => {
    try {
      const data = await apiCall('/shares', { method: 'POST' });
      let baseUrl = 'http://localhost:8081';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        baseUrl = window.location.origin;
      }
      
      const shareLink = `${baseUrl}/share/${data.token}`;
      
      await Share.share({
        message: `Here is my Health Guardian profile and medication log: ${shareLink}`,
        title: 'Health Guardian Data Sharing',
        url: shareLink,
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to generate share link',
      });
    }
  };

  const handleLogout = () => {
    Alert.alert(t('logout'), 'Are you sure you want to logout?', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('logout'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleLanguageChange = async (lang: string) => {
    await changeLanguage(lang);
    setCurrentLang(lang);
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.card,
      alignItems: 'center',
      padding: 32,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    name: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 4,
    },
    email: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    section: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
    },
    infoRow: {
      paddingVertical: 8,
    },
    infoItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    infoText: {
      marginLeft: 16,
    },
    infoLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    infoValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
    settingsItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
    },
    settingsText: {
      fontSize: 16,
      color: colors.text,
      marginLeft: 16,
      flex: 1,
    },
    languageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    languageText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
    },
    menuText: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      marginLeft: 16,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.danger,
      marginHorizontal: 16,
      marginTop: 16,
      padding: 16,
      borderRadius: 12,
      gap: 8,
    },
    logoutText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    footer: {
      alignItems: 'center',
      padding: 32,
    },
    footerText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    footerSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
      opacity: 0.7,
    },
  });

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle" size={100} color={colors.primary} />
        </View>
        <Text style={dynamicStyles.name}>{user?.name}</Text>
        <Text style={dynamicStyles.email}>{user?.email}</Text>
      </View>

      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>{t('personalInfo')}</Text>
        
        <View style={dynamicStyles.infoCard}>
          <View style={dynamicStyles.infoRow}>
            <View style={dynamicStyles.infoItem}>
              <Ionicons name="calendar" size={24} color={colors.primary} />
              <View style={dynamicStyles.infoText}>
                <Text style={dynamicStyles.infoLabel}>{t('age')}</Text>
                <Text style={dynamicStyles.infoValue}>{user?.age} years</Text>
              </View>
            </View>
          </View>

          <View style={dynamicStyles.divider} />

          <View style={dynamicStyles.infoRow}>
            <View style={dynamicStyles.infoItem}>
              <Ionicons 
                name={user?.gender === 'male' ? 'male' : user?.gender === 'female' ? 'female' : 'transgender'} 
                size={24} 
                color={colors.primary} 
              />
              <View style={dynamicStyles.infoText}>
                <Text style={dynamicStyles.infoLabel}>{t('gender')}</Text>
                <Text style={dynamicStyles.infoValue}>
                  {user?.gender ? t(user.gender) : 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>{t('settings')}</Text>
        
        {/* Dark Mode Toggle */}
        <View style={dynamicStyles.settingsItem}>
          <Ionicons name={isDark ? 'moon' : 'sunny'} size={24} color={colors.primary} />
          <Text style={dynamicStyles.settingsText}>{t('darkMode')}</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#E1E8ED', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {/* Language Selection */}
        <View style={dynamicStyles.settingsItem}>
          <Ionicons name="language" size={24} color={colors.primary} />
          <Text style={dynamicStyles.settingsText}>{t('language')}</Text>
          <View style={dynamicStyles.languageButton}>
            <TouchableOpacity
              onPress={() => handleLanguageChange('en')}
              style={[
                styles.langBtn,
                currentLang === 'en' && { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  dynamicStyles.languageText,
                  currentLang === 'en' && { color: '#fff' },
                ]}
              >
                EN
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleLanguageChange('ta')}
              style={[
                styles.langBtn,
                currentLang === 'ta' && { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  dynamicStyles.languageText,
                  currentLang === 'ta' && { color: '#fff' },
                ]}
              >
                தமிழ்
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>Caregiver Sharing</Text>
        <TouchableOpacity style={dynamicStyles.menuItem} onPress={handleShare}>
          <Ionicons name="share-social" size={24} color={colors.primary} />
          <Text style={dynamicStyles.menuText}>Share health log with doctor</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>App Information</Text>
        
        <TouchableOpacity style={dynamicStyles.menuItem}>
          <Ionicons name="information-circle" size={24} color={colors.textSecondary} />
          <Text style={dynamicStyles.menuText}>{t('about')}</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={dynamicStyles.menuItem}>
          <Ionicons name="shield-checkmark" size={24} color={colors.textSecondary} />
          <Text style={dynamicStyles.menuText}>{t('privacyPolicy')}</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={dynamicStyles.menuItem}>
          <Ionicons name="help-circle" size={24} color={colors.textSecondary} />
          <Text style={dynamicStyles.menuText}>{t('helpSupport')}</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={dynamicStyles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out" size={24} color="#fff" />
        <Text style={dynamicStyles.logoutText}>{t('logout')}</Text>
      </TouchableOpacity>

      <View style={dynamicStyles.footer}>
        <Text style={dynamicStyles.footerText}>Health Guardian v1.0.0</Text>
        <Text style={dynamicStyles.footerSubtext}>Your AI Health Companion</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatarContainer: {
    marginBottom: 16,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
});
