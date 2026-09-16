import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
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
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return 0;
  const R = 6371; // Radius of the earth in km
  const dLat = (nLat2 - nLat1) * Math.PI / 180;
  const dLon = (nLon2 - nLon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(nLat1 * Math.PI / 180) * Math.cos(nLat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

const getRestaurantCoords = (rest) => {
  if (!rest) return null;
  const loc = rest.restaurantLocation || rest.location || rest.coords || rest.geo || rest;
  if (!loc) return null;

  let rawLat, rawLng;

  // Handle GeoJSON array format [c1, c2]
  if (loc.coordinates && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    const c1 = Number(loc.coordinates[0]);
    const c2 = Number(loc.coordinates[1]);
    if (!isNaN(c1) && !isNaN(c2) && c1 !== 0 && c2 !== 0) {
      // Automatic detection for India/Kurnool coordinates (lat ~15.8, lng ~78.0)
      if (Math.abs(c1) < 45 && Math.abs(c2) > 45) {
        rawLat = c1;
        rawLng = c2;
      } else if (Math.abs(c2) < 45 && Math.abs(c1) > 45) {
        rawLat = c2;
        rawLng = c1;
      } else {
        rawLng = c1;
        rawLat = c2;
      }
    }
  } else if (loc.coordinates && typeof loc.coordinates === 'string') {
    const parts = loc.coordinates.trim().split(/[,\s]+/);
    if (parts.length >= 2) {
      const c1 = Number(parts[0]);
      const c2 = Number(parts[1]);
      if (!isNaN(c1) && !isNaN(c2) && c1 !== 0 && c2 !== 0) {
        if (Math.abs(c1) < 45 && Math.abs(c2) > 45) {
          rawLat = c1;
          rawLng = c2;
        } else if (Math.abs(c2) < 45 && Math.abs(c1) > 45) {
          rawLat = c2;
          rawLng = c1;
        } else {
          rawLng = c1;
          rawLat = c2;
        }
      }
    }
  }

  if (rawLat === undefined || rawLng === undefined) {
    rawLat = loc.lat ?? loc.latitude ?? loc.latitute ?? rest.lat ?? rest.latitude;
    rawLng = loc.lng ?? loc.longitude ?? loc.longtitude ?? rest.lng ?? rest.longitude;
  }

  if (rawLat === undefined || rawLng === undefined || rawLat === null || rawLng === null) return null;
  let lat = Number(rawLat);
  let lng = Number(rawLng);
  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

  // Auto-correct if lat and lng were swapped (e.g., lat > 45 and lng < 45 in India)
  if (Math.abs(lat) > 45 && Math.abs(lng) < 45) {
    const temp = lat;
    lat = lng;
    lng = temp;
  }

  return { lat, lng };
};

export const checkLocationAndCalculateDistances = createAsyncThunk(
  'location/checkLocationAndCalculateDistances',
  async (arg, { rejectWithValue, dispatch }) => {
    // support both signature formats: list directly or { restaurantsList, customCoords }
    const restaurantsList = Array.isArray(arg) ? arg : (arg && arg.restaurantsList ? arg.restaurantsList : []);
    const customCoords = (arg && !Array.isArray(arg)) ? arg.customCoords : null;

    console.log('[Location Redux] Thunk action triggered. Verifying status and permission...');
    try {
      let latitude, longitude;

      const customLat = customCoords ? (customCoords.latitude ?? customCoords.lat) : undefined;
      const customLng = customCoords ? (customCoords.longitude ?? customCoords.lng) : undefined;

      if (customLat !== undefined && customLng !== undefined && customLat !== null && customLng !== null && !isNaN(Number(customLat)) && !isNaN(Number(customLng))) {
        latitude = Number(customLat);
        longitude = Number(customLng);
        console.log('[Location Redux] Using custom coordinates passed to thunk:', latitude, longitude);
      } else {
        // Check if user has an active order in progress; if so, do not fetch GPS location
        const uid = await AsyncStorage.getItem('userid');
        if (uid) {
          const cachedActiveOrder = await AsyncStorage.getItem(`has_active_order_${uid}`);
          if (cachedActiveOrder === 'true') {
            console.log('[Location Redux] User has an active order in progress. Skipping GPS location fetch.');
            return rejectWithValue({
              type: 'ACTIVE_ORDER',
              message: 'Active order in progress.'
            });
          }
        }

        // 1. Check if location services are enabled globally (GPS is ON)
        let servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled && Platform.OS === 'android') {
          try {
            console.log('[Location Redux] GPS is off, prompting user system-wide via enableNetworkProviderAsync...');
            await Location.enableNetworkProviderAsync();
            // Wait 500ms for system to register provider bootup
            await new Promise(resolve => setTimeout(resolve, 500));
            servicesEnabled = await Location.hasServicesEnabledAsync();
          } catch (e) {
            console.warn('[Location Redux] enableNetworkProviderAsync prompt failed or cancelled:', e);
          }
        }

        if (!servicesEnabled) {
          console.log('[Location Redux] GPS is still off, waiting 1000ms to verify again...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          servicesEnabled = await Location.hasServicesEnabledAsync();
        }

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

        // 3. Request coordinates with pinpoint precision
        console.log('[Location Redux] Querying current coordinates...');
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.navigator && window.navigator.geolocation) {
          const getWebPosition = () => new Promise((resolve, reject) => {
            window.navigator.geolocation.getCurrentPosition(
              (pos) => resolve({
                coords: {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                }
              }),
              (err) => reject(err),
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
            );
          });
          const location = await getWebPosition();
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
        } else {
          try {
            // Tier 1: Try Highest navigation accuracy (pinpoint GPS satellite fix)
            const positionPromise = Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Highest,
              timeout: 8000,
            });
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Location timeout')), 8500)
            );
            const location = await Promise.race([positionPromise, timeoutPromise]);
            latitude = location.coords.latitude;
            longitude = location.coords.longitude;
            console.log('[Location Redux Mobile] Pinpoint satellite GPS coordinates acquired:', latitude, longitude);
          } catch (posErr) {
            console.warn('[Location Redux] Highest accuracy timed out, trying High accuracy fallback:', posErr.message);
            try {
              // Tier 2: Try High accuracy with shorter timeout
              const highAccLoc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
                timeout: 5000,
              });
              latitude = highAccLoc.coords.latitude;
              longitude = highAccLoc.coords.longitude;
              console.log('[Location Redux] High accuracy location acquired:', latitude, longitude);
            } catch (tier2Err) {
              console.warn('[Location Redux] Attempting recent known position (< 5 mins old):', tier2Err.message);
              const fallbackLoc = await Location.getLastKnownPositionAsync({
                maxAge: 300000, // strictly reject positions older than 5 minutes
              });
              if (fallbackLoc && fallbackLoc.coords) {
                latitude = fallbackLoc.coords.latitude;
                longitude = fallbackLoc.coords.longitude;
                console.log('[Location Redux] Successfully retrieved fresh recent position:', latitude, longitude);
              } else {
                console.error('[Location Redux] All GPS queries failed to retrieve location.');
                return rejectWithValue({
                  type: 'LOCATION_FAILED',
                  message: 'Could not fetch device GPS location. Please check device location settings.'
                });
              }
            }
          }
        }
      }

      console.log('[Location Redux] Active customer coordinates:', latitude, longitude);

      // 4. Verify Kurnool geofence (strictly inside polygon boundary)
      const insideGeofence = isPointInPolygon({ latitude, longitude }, kurnoolPolygon);
      console.log('[Location Redux] Geofence check inside Kurnool polygon:', insideGeofence);
      if (!insideGeofence) {
        return rejectWithValue({
          type: 'OUT_OF_ZONE',
          message: 'Service is only available in Kurnool.'
        });
      }

      // 5. Attempt Reverse Geocoding to resolve street/area address
      let userAddress = null;
      try {
        const reverseResults = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (reverseResults && reverseResults.length > 0) {
          const res = reverseResults[0];
          const areaParts = [res.name, res.street, res.district || res.subregion || res.city].filter(Boolean);
          const formattedStr = areaParts.length > 0 ? areaParts.join(', ') : 'Kurnool';
          userAddress = {
            formattedAddress: formattedStr,
            street: res.street || res.name || '',
            subregion: res.district || res.subregion || res.city || 'Kurnool',
            city: res.city || 'Kurnool',
          };
          console.log('[Location Redux] Resolved address via reverse geocoding:', userAddress);
        }
      } catch (geocodeErr) {
        console.warn('[Location Redux] Reverse geocoding warning:', geocodeErr.message);
      }

      // 6. Request exact Google Maps road route distance directly from backend API for all restaurants in 1 batch call
      console.log('[Location Redux] Fetching Google Maps road distances from backend...');
      const updatedDistances = {};
      if (restaurantsList && restaurantsList.length > 0) {
        const destinationItems = [];
        restaurantsList.forEach((rest) => {
          const restId = rest._id || rest.restId || rest.id;
          const restCoords = getRestaurantCoords(rest);
          if (restId && restCoords) {
            destinationItems.push({
              id: String(restId),
              lat: restCoords.lat,
              lng: restCoords.lng,
            });
          }
        });

        if (destinationItems.length > 0) {
          try {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;
            const batchRes = await fetch(`${API_URL}/distance/batch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                originLat: latitude,
                originLng: longitude,
                destinations: destinationItems,
              }),
              signal: controller ? controller.signal : undefined,
            });
            if (timeoutId) clearTimeout(timeoutId);

            if (batchRes.ok) {
              const batchData = await batchRes.json();
              if (batchData.success && batchData.distances) {
                restaurantsList.forEach((rest) => {
                  const restId = rest._id || rest.restId || rest.id;
                  let distText = batchData.distances[String(restId)];

                  if (distText) {
                    const keys = [rest._id, rest.restId, rest.id, rest.restaurantId, rest.name, rest.restaurantName].filter(Boolean);
                    keys.forEach(k => { updatedDistances[String(k)] = distText; });
                  }
                });
              }
            }
          } catch (batchErr) {
            console.warn('[Location Redux] Google Maps / backend batch distance query error:', batchErr);
          }
        }
      }

      console.log('[Location Redux] Final exact backend road distances:', updatedDistances);

      return {
        userLocation: { latitude, longitude },
        userAddress,
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
    userAddress: null,
    roadDistances: {},
    locationStatus: 'idle', // 'idle' | 'requesting' | 'inside' | 'outside' | 'denied'
    showLocationModal: false,
    showFetchingModal: false,
    showOutOfZoneModal: false,
    locationError: null,
    selectedSavedAddressId: null,
    savedAddresses: [],
  },
  reducers: {
    setRoadDistances: (state, action) => {
      state.roadDistances = { ...state.roadDistances, ...action.payload };
    },
    setSavedAddressesRedux: (state, action) => {
      state.savedAddresses = action.payload || [];
    },
    resetLocationState: (state) => {
      state.userLocation = null;
      state.userAddress = null;
      state.roadDistances = {};
      state.locationStatus = 'idle';
      state.showLocationModal = false;
      state.showFetchingModal = false;
      state.showOutOfZoneModal = false;
      state.locationError = null;
      state.selectedSavedAddressId = null;
      state.savedAddresses = [];
    },
    skipLocation: (state) => {
      state.userLocation = null;
      state.userAddress = null;
      state.roadDistances = {};
      state.locationStatus = 'skipped';
      state.showLocationModal = false;
      state.showFetchingModal = false;
      state.showOutOfZoneModal = false;
      state.locationError = null;
      state.selectedSavedAddressId = null;
      AsyncStorage.removeItem('user_location_choice');
      AsyncStorage.removeItem('selected_saved_address_id');
    },
    setSelectedSavedAddressId: (state, action) => {
      state.selectedSavedAddressId = action.payload;
      if (action.payload) {
        AsyncStorage.setItem('selected_saved_address_id', String(action.payload));
        AsyncStorage.setItem('user_location_choice', 'saved');
      } else {
        AsyncStorage.removeItem('selected_saved_address_id');
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkLocationAndCalculateDistances.pending, (state, action) => {
        state.locationStatus = 'requesting';
        if (!state.userLocation || (action.meta && action.meta.arg && action.meta.arg.forceModal)) {
          state.showFetchingModal = true;
        }
        state.showLocationModal = false;
        state.showOutOfZoneModal = false;
        state.locationError = null;
      })
      .addCase(checkLocationAndCalculateDistances.fulfilled, (state, action) => {
        state.locationStatus = 'inside';
        state.userLocation = action.payload.userLocation;
        if (action.payload.userAddress) {
          state.userAddress = action.payload.userAddress;
        }
        if (action.payload.updatedDistances) {
          state.roadDistances = { ...state.roadDistances, ...action.payload.updatedDistances };
        }
        state.showFetchingModal = false;
        state.showLocationModal = false;
        state.showOutOfZoneModal = false;
        state.locationError = null;
        AsyncStorage.setItem('user_location_choice', 'inside');
      })
      .addCase(checkLocationAndCalculateDistances.rejected, (state, action) => {
        const errorDetail = action.payload || { type: 'ERROR', message: 'Failed to get location.' };
        state.locationError = errorDetail.message;
        state.showFetchingModal = false;

        if (errorDetail.type === 'ACTIVE_ORDER') {
          state.locationStatus = 'skipped';
          state.showLocationModal = false;
          state.showOutOfZoneModal = false;
        } else if (errorDetail.type === 'OUT_OF_ZONE') {
          state.locationStatus = 'outside';
          state.showOutOfZoneModal = true;
        } else {
          state.locationStatus = 'denied';
          state.showLocationModal = false;
        }
      });
  }
});

export const { setRoadDistances, setSavedAddressesRedux, resetLocationState, skipLocation, setSelectedSavedAddressId } = locationSlice.actions;
export default locationSlice.reducer;
