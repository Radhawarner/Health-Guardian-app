import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const resources = {
  en: {
    translation: {
      // Auth
      login: 'Login',
      register: 'Register',
      email: 'Email',
      password: 'Password',
      name: 'Full Name',
      age: 'Age',
      gender: 'Gender',
      male: 'Male',
      female: 'Female',
      other: 'Other',
      dontHaveAccount: "Don't have an account? Register",
      alreadyHaveAccount: 'Already have an account? Login',
      
      // Dashboard
      hello: 'Hello',
      howFeeling: 'How are you feeling today?',
      dashboard: 'Dashboard',
      todaysMedicines: "Today's Medicines",
      healthStats: 'Latest Health Stats',
      alerts: 'Alerts',
      healthRiskAssessment: 'Health Risk Assessment',
      overallRiskLevel: 'Overall Risk Level',
      riskScore: 'Risk Score',
      recommendations: 'Recommendations',
      
      // Medicines
      medicines: 'Medicines',
      addMedicine: 'Add Medicine',
      medicineName: 'Medicine Name',
      dosage: 'Dosage',
      timing: 'Timing',
      frequency: 'Frequency',
      morning: 'Morning',
      afternoon: 'Afternoon',
      night: 'Night',
      daily: 'Daily',
      weekly: 'Weekly',
      taken: 'Taken',
      missed: 'Missed',
      pending: 'Pending',
      deleteMedicine: 'Delete Medicine',
      
      // Health
      health: 'Health',
      addHealthLog: 'Add Health Log',
      weight: 'Weight',
      bloodPressure: 'Blood Pressure',
      bloodSugar: 'Blood Sugar',
      heartRate: 'Heart Rate',
      recentLogs: 'Recent Logs',
      trend: 'Trend',
      
      // Profile
      profile: 'Profile',
      personalInfo: 'Personal Information',
      about: 'About',
      privacyPolicy: 'Privacy Policy',
      helpSupport: 'Help & Support',
      logout: 'Logout',
      settings: 'Settings',
      darkMode: 'Dark Mode',
      language: 'Language',
      
      // Common
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      success: 'Success',
      error: 'Error',
      loading: 'Loading',
      noData: 'No data available',
      
      // Risk Levels
      low: 'Low',
      medium: 'Medium',
      high: 'High',
    },
  },
  ta: {
    translation: {
      // Auth
      login: 'உள்நுழைய',
      register: 'பதிவு செய்ய',
      email: 'மின்னஞ்சல்',
      password: 'கடவுச்சொல்',
      name: 'முழு பெயர்',
      age: 'வயது',
      gender: 'பாலினம்',
      male: 'ஆண்',
      female: 'பெண்',
      other: 'மற்றவை',
      dontHaveAccount: 'கணக்கு இல்லையா? பதிவு செய்யுங்கள்',
      alreadyHaveAccount: 'ஏற்கனவே கணக்கு உள்ளதா? உள்நுழையவும்',
      
      // Dashboard
      hello: 'வணக்கம்',
      howFeeling: 'இன்று எப்படி உணர்கிறீர்கள்?',
      dashboard: 'டாஷ்போர்டு',
      todaysMedicines: 'இன்றைய மருந்துகள்',
      healthStats: 'சமீபத்திய சுகாதார புள்ளிவிவரங்கள்',
      alerts: 'எச்சரிக்கைகள்',
      healthRiskAssessment: 'சுகாதார ஆபத்து மதிப்பீடு',
      overallRiskLevel: 'ஒட்டுமொத்த ஆபத்து நிலை',
      riskScore: 'ஆபத்து மதிப்பெண்',
      recommendations: 'பரிந்துரைகள்',
      
      // Medicines
      medicines: 'மருந்துகள்',
      addMedicine: 'மருந்து சேர்க்க',
      medicineName: 'மருந்தின் பெயர்',
      dosage: 'டோஸ்',
      timing: 'நேரம்',
      frequency: 'அதிர்வெண்',
      morning: 'காலை',
      afternoon: 'மதியம்',
      night: 'இரவு',
      daily: 'தினசரி',
      weekly: 'வாராந்திர',
      taken: 'எடுத்தது',
      missed: 'தவறவிட்டது',
      pending: 'நிலுவையில்',
      deleteMedicine: 'மருந்தை நீக்கு',
      
      // Health
      health: 'சுகாதாரம்',
      addHealthLog: 'சுகாதார பதிவு சேர்க்க',
      weight: 'எடை',
      bloodPressure: 'இரத்த அழுத்தம்',
      bloodSugar: 'இரத்த சர்க்கரை',
      heartRate: 'இதய துடிப்பு',
      recentLogs: 'சமீபத்திய பதிவுகள்',
      trend: 'போக்கு',
      
      // Profile
      profile: 'சுயவிவரம்',
      personalInfo: 'தனிப்பட்ட தகவல்',
      about: 'பற்றி',
      privacyPolicy: 'தனியுரிமை கொள்கை',
      helpSupport: 'உதவி மற்றும் ஆதரவு',
      logout: 'வெளியேறு',
      settings: 'அமைப்புகள்',
      darkMode: 'இருண்ட பயன்முறை',
      language: 'மொழி',
      
      // Common
      save: 'சேமி',
      cancel: 'ரத்து செய்',
      delete: 'நீக்கு',
      edit: 'திருத்து',
      close: 'மூடு',
      success: 'வெற்றி',
      error: 'பிழை',
      loading: 'ஏற்றுகிறது',
      noData: 'தரவு இல்லை',
      
      // Risk Levels
      low: 'குறைவு',
      medium: 'நடுத்தர',
      high: 'உயர்',
    },
  },
};

const getStoredLanguage = async () => {
  try {
    const lang = await AsyncStorage.getItem('language');
    return lang || 'en';
  } catch (error) {
    return 'en';
  }
};

const initI18n = async () => {
  const language = await getStoredLanguage();
  
  i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });
};

initI18n();

export const changeLanguage = async (lang: string) => {
  await AsyncStorage.setItem('language', lang);
  i18n.changeLanguage(lang);
};

export default i18n;
