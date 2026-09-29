import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Set to true for Local Backend (port 5000), false for Production Railway
const USE_LOCAL_BACKEND = false;

const getLocalBackendUrl = () => {
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000`;
    }
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
};

export const API_URL = USE_LOCAL_BACKEND
  ? getLocalBackendUrl()
  : 'https://customerbackendfile-production.up.railway.app';

export const CONTACT_INFO = {
  phone: '7207610235',
  displayPhone: '+91 7207610235',
  email: 'support@leevondelivery.in',
  socials: {
    youtube: 'https://www.youtube.com/@LeevonDelivery',
    x: 'https://x.com/Leevondelivery',
    linkedin: 'https://www.linkedin.com/in/leevon-delivery-047511424',
    instagram: 'https://www.instagram.com/leevondelivery/',
    facebook: 'https://www.facebook.com/profile.php?id=61588710924852',
  },
};
