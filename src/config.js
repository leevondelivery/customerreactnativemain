import { Platform } from 'react-native';
import Constants from 'expo-constants';

const getApiUrl = () => {
  // If explicitly set via environment variable:
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Live Railway backend URL:
  return 'https://customerbackendfile-production.up.railway.app';
};

export const API_URL = getApiUrl();

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

