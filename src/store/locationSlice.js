import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

// Geofence check boundary
const kurnoolPolygon = [
  { latitude: 15.845928, longitude: 78.012744 },
  { latitude: 15.846311, longitude: 78.019729 },
  { latitude: 15.839716, longitude: 78.027036 },
  { latitude: 15.846872, longitude: 78.031149 },
  { latitude: 15.84623, longitude: 78.034459 },
  { latitude: 15.838115, longitude: 78.049654 },
  { latitude: 15.82565, longitude: 78.056682 },
  { latitude: 15.818905, longitude: 78.060495 },
  { latitude: 15.815102, longitude: 78.065114 },
  { latitude: 15.801613, longitude: 78.072318 },
  { latitude: 15.798335, longitude: 78.078557 },
  { latitude: 15.79411, longitude: 78.078435 },
  { latitude: 15.786917, longitude: 78.078888 },
  { latitude: 15.776939, longitude: 78.073002 },
  { latitude: 15.772624, longitude: 78.057852 },
  { latitude: 15.768974, longitude: 78.054399 },
  { latitude: 15.765935, longitude: 78.049634 },
  { latitude: 15.77651, longitude: 78.02883 },
  { latitude: 15.813778, longitude: 77.996924 },
  { latitude: 15.847026, longitude: 78.005964 }
];

const isPointInPolygon = (point, polygon) => {
  const x = point.latitude, y = point.longitude;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude, yi = polygon[i].longitude;
    const xj = polygon[j].latitude, yj = polygon[j].longitude;
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

export const checkLocationAndCalculateDistances = createAsyncThunk(
  'location/checkLocationAndCalculateDistances',
  async (arg, { rejectWithValue, dispatch }) => {
    // support both signature formats: list directly or { restaurantsList, customCoords }
    const restaurantsList = Array.isArray(arg) ? arg : arg.restaurantsList;
    const customCoords = Array.isArray(arg) ? null : arg.customCoords;

    console.log('[Location Redux] Thunk action triggered. Verifying status and permission...');
    try {
      let latitude, longitude;

      if (customCoords && customCoords.latitude !== undefined && customCoords.longitude !== undefined) {
        latitude = customCoords.latitude;
        longitude = customCoords.longitude;
        console.log('[Location Redux] Using custom coordinates passed to thunk:', latitude, longitude);
      } else {
        // 1. Check if location services are enabled globally (GPS is ON)
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        console.log('[Location Redux] GPS services enabled globally:', servicesEnabled);
        if (!servicesEnabled) {
          return rejectWithValue({
            type: 'GPS_OFF',
            message: 'GPS is turned off. Please enable device location.'
          });
        }

        // 2. Check and request location permission
        let { status } = await Location.getForegroundPermissionsAsync();
        console.log('[Location Redux] Current permission status:', status);
        if (status !== 'granted') {
          const permissionResponse = await Location.requestForegroundPermissionsAsync();
          status = permissionResponse.status;
          console.log('[Location Redux] Permission requested response:', status);
        }

        if (status !== 'granted') {
          return rejectWithValue({
            type: 'PERMISSION_DENIED',
            message: 'Location permission is required to calculate delivery distance.'
          });
        }

        // 3. Request coordinates
        console.log('[Location Redux] Querying current coordinates...');
        if (typeof window !== 'undefined' && window.navigator && window.navigator.geolocation) {
          const getWebPosition = () => new Promise((resolve, reject) => {
            window.navigator.geolocation.getCurrentPosition(
              (pos) => resolve({
                coords: {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                }
              }),
              (err) => reject(err),
              { enableHighAccuracy: false, timeout: 6000, maximumAge: 10000 }
            );
          });
          const location = await getWebPosition();
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
        } else {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
        }
      }
      console.log('[Location Redux] Location coordinates verified:', latitude, longitude);

      // 4. Verify Kurnool geofence
      const inside = isPointInPolygon({ latitude, longitude }, kurnoolPolygon);
      console.log('[Location Redux] Geofence check inside Kurnool:', inside);
      if (!inside) {
        return rejectWithValue({
          type: 'OUT_OF_ZONE',
          message: 'Service is only available in Kurnool.'
        });
      }

      // 5. Instantly compute initial air distances
      const initialDistances = {};
      restaurantsList.forEach(rest => {
        const restLoc = rest.restaurantLocation;
        if (restLoc && restLoc.lat !== undefined && restLoc.lng !== undefined) {
          const airDist = getHaversineDistance(latitude, longitude, restLoc.lat, restLoc.lng);
          const formatted = `${airDist.toFixed(1)} km`;
          if (rest._id) initialDistances[String(rest._id)] = formatted;
          if (rest.restId) initialDistances[String(rest.restId)] = formatted;
        }
      });
      console.log('[Location Redux] Set zero-latency initial air distances:', initialDistances);
      dispatch(setRoadDistances(initialDistances));

      // 6. Try loading cached road distances from AsyncStorage
      try {
        const cached = await AsyncStorage.getItem('cached_road_distances');
        if (cached) {
          const parsed = JSON.parse(cached);
          console.log('[Location Redux] Loaded cached road distances:', parsed);
          dispatch(setRoadDistances(parsed));
        }
      } catch (err) {
        console.warn('[Location Redux] Cache load error:', err);
      }

      // 7. Request exact road route distance from backend API for all restaurants in parallel
      console.log('[Location Redux] Querying backend /distance endpoint for exact road distances...');
      const updatedDistances = {};
      await Promise.all(restaurantsList.map(async (rest) => {
        const restId = rest._id || rest.restId;
        const restLoc = rest.restaurantLocation;
        if (restLoc && restLoc.lat !== undefined && restLoc.lng !== undefined) {
          const airDist = getHaversineDistance(latitude, longitude, restLoc.lat, restLoc.lng);
          if (airDist > 30) {
            console.log(`[Location Redux] Skipping backend road distance for ${rest.name || 'restaurant'} because air distance is too large (${airDist.toFixed(1)} km)`);
            return;
          }

          try {
            const url = `${API_URL}/distance?originLat=${latitude}&originLng=${longitude}&restaurantId=${restId}`;
            console.log(`[Location Redux] Fetching distance for ${rest.name} from: ${url}`);
            const response = await fetch(url);
            if (response.ok) {
              const resData = await response.json();
              console.log(`[Location Redux] Backend response for ${rest.name}:`, resData);
              if (resData.success && resData.distance) {
                if (rest._id) updatedDistances[String(rest._id)] = resData.distance;
                if (rest.restId) updatedDistances[String(rest.restId)] = resData.distance;
              }
            } else {
              console.warn(`[Location Redux] Backend returned error status ${response.status} for ${rest.name}`);
            }
          } catch (err) {
            console.warn(`[Location Redux] Failed to fetch road distance for ${rest.name}:`, err);
          }
        }
      }));

      // Cache updated road distances
      if (Object.keys(updatedDistances).length > 0) {
        console.log('[Location Redux] Saving updated road distances to AsyncStorage cache:', updatedDistances);
        AsyncStorage.setItem('cached_road_distances', JSON.stringify(updatedDistances)).catch(err =>
          console.warn('[Location Redux] Cache write error:', err)
        );
      }

      return {
        userLocation: { latitude, longitude },
        updatedDistances
      };

    } catch (error) {
      console.error('[Location Redux] Error in location check:', error);
      return rejectWithValue({
        type: 'ERROR',
        message: error.message || 'Failed to get location.'
      });
    }
  }
);

const locationSlice = createSlice({
  name: 'location',
  initialState: {
    userLocation: null,
    roadDistances: {},
    locationStatus: 'idle', // 'idle' | 'requesting' | 'inside' | 'outside' | 'denied'
    showLocationModal: false,
    showFetchingModal: false,
    showOutOfZoneModal: false,
    locationError: null,
    selectedSavedAddressId: null,
  },
  reducers: {
    setRoadDistances: (state, action) => {
      state.roadDistances = { ...state.roadDistances, ...action.payload };
    },
    resetLocationState: (state) => {
      state.locationStatus = 'idle';
      state.showLocationModal = false;
      state.showFetchingModal = false;
      state.showOutOfZoneModal = false;
      state.locationError = null;
    },
    skipLocation: (state) => {
      state.locationStatus = 'skipped';
      state.showLocationModal = false;
      state.showFetchingModal = false;
      state.showOutOfZoneModal = false;
      state.locationError = null;
    },
    setSelectedSavedAddressId: (state, action) => {
      state.selectedSavedAddressId = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkLocationAndCalculateDistances.pending, (state) => {
        state.locationStatus = 'requesting';
        state.showFetchingModal = true;
        state.showLocationModal = false;
        state.showOutOfZoneModal = false;
        state.locationError = null;
      })
      .addCase(checkLocationAndCalculateDistances.fulfilled, (state, action) => {
        state.locationStatus = 'inside';
        state.userLocation = action.payload.userLocation;
        state.roadDistances = { ...state.roadDistances, ...action.payload.updatedDistances };
        state.showFetchingModal = false;
        state.showLocationModal = false;
        state.showOutOfZoneModal = false;
        state.locationError = null;
      })
      .addCase(checkLocationAndCalculateDistances.rejected, (state, action) => {
        const errorDetail = action.payload || { type: 'ERROR', message: 'Failed to get location.' };
        state.locationError = errorDetail.message;
        state.showFetchingModal = false;
        
        if (errorDetail.type === 'OUT_OF_ZONE') {
          state.locationStatus = 'outside';
          state.showOutOfZoneModal = true;
        } else {
          state.locationStatus = 'denied';
          state.showLocationModal = true;
        }
      });
  }
});

export const { setRoadDistances, resetLocationState, skipLocation, setSelectedSavedAddressId } = locationSlice.actions;
export default locationSlice.reducer;
