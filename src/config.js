import { Platform } from 'react-native';
import Constants from 'expo-constants';

const PORT = 5000;

const getApiUrl = () => {
  // 1. If explicitly set via environment variable:
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Dynamic host detection for Expo Go / Physical Device on local Wi-Fi:
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    const devMachineIp = hostUri.split(':')[0];
    if (devMachineIp && devMachineIp !== 'localhost' && devMachineIp !== '127.0.0.1') {
      return `http://${devMachineIp}:${PORT}`;
    }
  }

  // 3. Android Emulator uses 10.0.2.2 to reach host localhost:
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${PORT}`;
  }

  // 4. Default localhost for iOS Simulator and Web browser:
  return `http://localhost:${PORT}`;
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

