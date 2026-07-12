const getApiUrl = () => {
  // For local web browser testing:
  // return 'http://localhost:5000';
  
  // For Expo Go on physical mobile devices (configured with your local IP):
  // return 'http://192.168.0.105:5000';
  
  // Current production URL:
  return 'https://customerbackendfile-production.up.railway.app';
};

export const API_URL = getApiUrl();
