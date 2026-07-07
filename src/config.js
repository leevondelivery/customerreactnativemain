import { Platform } from 'react-native';

const getApiUrl = () => {
  // For local development:
  // - We use your machine's current local Wi-Fi IP address (10.93.153.192) for Android.
  //   This allows connecting from a physical Android device on your local Wi-Fi.
  if (Platform.OS === 'android') {
    return 'http://10.93.153.192:5000';
  }
  return 'http://localhost:5000';
};

export const API_URL = getApiUrl();
