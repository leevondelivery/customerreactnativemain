import { Feather, FontAwesome, FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Dimensions,
  FlatList,
  LayoutAnimation,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  BackHandler,
  ToastAndroid,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import LoadingView from '../../components/LoadingView';
import { API_URL } from '../../config';
import { checkLocationAndCalculateDistances, setSelectedSavedAddressId, setSavedAddressesRedux, skipLocation } from '../../store/locationSlice';
import { fetchAllRestaurantMenus, fetchRestaurantMenu, fetchRestaurants, loadCachedRestaurants, updateRestaurantStatuses } from '../../store/restaurantsSlice';
import { styles } from '../../styles/restaurentlist.styles';
import { useTabBar } from '../_layout';

const { width: screenWidth } = Dimensions.get('window');
const CAROUSEL_WIDTH = Math.min(screenWidth, 500) - 32;

// Precise search query matcher (matches word prefixes so searching 'lassi' matches 'Lassi' items only, NOT 'Classic')
const isTextMatchingQuery = (text, query) => {
  if (!text || !query) return false;
  const t = String(text).toLowerCase().trim();
  const q = String(query).toLowerCase().trim();
  if (!q) return false;

  const words = t.split(/[\s,/\-\(\)]+/).filter(Boolean);
  const queryWords = q.split(/[\s,/\-\(\)]+/).filter(Boolean);

  if (queryWords.length === 0) return false;

  return queryWords.every((qWord) => {
    // Singuar variant if query word ends with 's' and length > 3 (e.g. 'fries' -> 'frie')
    const sWord = (qWord.length > 3 && qWord.endsWith('s')) ? qWord.slice(0, -1) : null;
    return words.some((w) => w.startsWith(qWord) || (sWord && w.startsWith(sWord)));
  });
};

// Layout animation preset for seamless layout reflows on filter / sort without opacity masks
const SMOOTH_LAYOUT_ANIMATION = {
  duration: 180,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.scaleXY,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.scaleXY,
  },
};

// Ultra-fast smooth animated wrapper for card transitions when filtering/sorting (clean spring physics with 100% solid cards, no dimming mask)
function AnimatedCardWrapper({ index = 0, filterKey, children, style }) {
  const [animValue] = useState(() => new Animated.Value(1));
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    animValue.setValue(0);
    const delay = Math.min(index * 4, 16);
    const timer = setTimeout(() => {
      Animated.spring(animValue, {
        toValue: 1,
        tension: 280,
        friction: 18,
        useNativeDriver: true,
      }).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [filterKey, animValue, index]);

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });

  const scale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1],
  });

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// A cross-platform image component to bypass React Native Web's CORS checks on web
function CarouselImage({ uri, style }) {
  if (Platform.OS === 'web') {
    return (
      <img
        src={uri}
        style={{
          width: style.width,
          height: style.height,
          borderRadius: style.borderRadius,
          objectFit: 'cover',
        }}
        alt="Carousel Image"
      />
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="cover"
    />
  );
}

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

const getClosingSoonStatus = (closeTimeStr, now) => {
  if (!closeTimeStr) return null;

  const match = closeTimeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const closeHours = parseInt(match[1], 10);
  const closeMinutes = parseInt(match[2], 10);

  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();

  const closeTotalMinutes = closeHours * 60 + closeMinutes;
  const currentTotalMinutes = currentHours * 60 + currentMinutes;

  let diff = closeTotalMinutes - currentTotalMinutes;

  // Handle cross-midnight case (e.g. closes at 00:02, now is 23:59)
  if (diff < 0) {
    diff += 1440; // 24 hours in minutes
  }

  // If it's between 1 and 5 minutes
  if (diff >= 1 && diff <= 5) {
    return `Closes in ${diff}m`;
  }

  return null;
};

// Track location modal display per app session to avoid re-opening when navigating back
let globalHasShownDeliverToModal = false;
let globalHasCheckedInitialLocation = false;
let globalHasPrefetchedMenus = false;

export default function RestaurantListScreen() {
  const [nowTime, setNowTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showTabBar, hideTabBar } = useTabBar();
  const lastOffsetY = useRef(0);
  const flatListRef = useRef(null);
  const categoryScrollRef = useRef(null);

  const dispatch = useDispatch();
  const restaurants = useSelector((state) => state.restaurants.list);
  const menus = useSelector((state) => state.restaurants.menus || {});
  const carouselItems = useSelector((state) => state.restaurants.carousel || []);
  const categories = useSelector((state) => state.restaurants.categories || []);
  const initialLoaded = useSelector((state) => state.restaurants.initialLoaded);
  const reduxLoading = useSelector((state) => state.restaurants.loading);

  // Redux Selectors for Global Location State
  const {
    userLocation,
    userAddress,
    roadDistances,
    locationStatus,
    showLocationModal,
    showFetchingModal,
    showOutOfZoneModal,
    locationError,
    selectedSavedAddressId,
    savedAddresses = [],
  } = useSelector((state) => state.location);

  const handleEnableLocation = async () => {
    console.log('[Location UI] handleEnableLocation triggered.');
    try {
      if (Platform.OS === 'android') {
        try {
          await Location.enableNetworkProviderAsync();
        } catch (e) {
          console.warn('Network provider enable failed:', e);
        }
      }
      dispatch(checkLocationAndCalculateDistances(restaurants));
    } catch (err) {
      console.warn('handleEnableLocation error:', err);
    }
  };

  const handleOpenSettings = () => {
    console.log('[Location UI] Opening app settings...');
    Platform.OS === 'ios' ? Linking.openURL('app-settings:') : Linking.openSettings();
  };

  const [userid, setUserid] = useState(null);
  const [showDeliverToModal, setShowDeliverToModal] = useState(false);
  const hasTriggeredDistanceCalc = useRef(false);

  useEffect(() => {
    const initLocationFlow = async () => {
      if (globalHasCheckedInitialLocation || globalHasShownDeliverToModal) return;
      globalHasCheckedInitialLocation = true;
      globalHasShownDeliverToModal = true;

      const uid = await AsyncStorage.getItem('userid');
      setUserid(uid);

      const savedAddrId = await AsyncStorage.getItem('selected_saved_address_id');

      let hasActiveOrder = false;

      if (uid) {
        try {
          const cachedAddr = await AsyncStorage.getItem(`saved_addresses_${uid}`);
          if (cachedAddr) {
            const parsed = JSON.parse(cachedAddr) || [];
            dispatch(setSavedAddressesRedux(parsed));
          }

          const cachedActiveOrder = await AsyncStorage.getItem(`has_active_order_${uid}`);
          if (cachedActiveOrder === 'true') {
            hasActiveOrder = true;
          }
        } catch (e) {}
      }

      // Check if device location (GPS) is enabled and permission is granted
      let isLocationActive = false;
      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        const permission = await Location.getForegroundPermissionsAsync();
        if (servicesEnabled && permission.status === 'granted') {
          isLocationActive = true;
        }
      } catch (locErr) {
        console.warn('[RestaurantList] Error checking location status:', locErr);
      }

      if (isLocationActive) {
        // Location is ON & permitted: Directly calculate distances and DO NOT show modal
        setShowDeliverToModal(false);
        if (savedAddrId) {
          dispatch(setSelectedSavedAddressId(savedAddrId));
        } else {
          dispatch(checkLocationAndCalculateDistances(restaurants));
        }
      } else {
        // Location is OFF or not permitted: Show Deliver To modal (unless user has active order)
        if (!hasActiveOrder) {
          setShowDeliverToModal(true);
        } else {
          setShowDeliverToModal(false);
        }
        if (savedAddrId) {
          dispatch(setSelectedSavedAddressId(savedAddrId));
        }
      }

      // Asynchronously verify addresses & active order status in background without delaying UI
      if (uid) {
        fetch(`${API_URL}/user/${uid}/addresses`)
          .then(res => res.json())
          .then(async (data) => {
            if (data.success && data.addresses) {
              dispatch(setSavedAddressesRedux(data.addresses));
              await AsyncStorage.setItem(`saved_addresses_${uid}`, JSON.stringify(data.addresses));
            }
          })
          .catch(() => {});

        try {
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const timeoutId = controller ? setTimeout(() => controller.abort(), 1500) : null;
          const orderRes = await fetch(`${API_URL}/orderstatus/user/${uid}`, {
            signal: controller ? controller.signal : undefined
          });
          if (timeoutId) clearTimeout(timeoutId);
          if (orderRes.ok) {
            const orderData = await orderRes.json();
            let isActive = false;
            if (orderData.success && orderData.orderStatus) {
              const sStr = (orderData.orderStatus.status || orderData.orderStatus.orderStatus || '').toLowerCase().trim();
              const isRej = sStr.includes('reject') || sStr.includes('cancel') || sStr.includes('declin') || sStr.includes('failed');
              isActive = !isRej;
            }
            await AsyncStorage.setItem(`has_active_order_${uid}`, isActive ? 'true' : 'false');
            if (isActive) {
              globalHasShownDeliverToModal = true;
              setShowDeliverToModal(false);
            }
          }
        } catch (orderErr) {
          console.warn('[RestaurantList] Background order check error:', orderErr.message);
        }
      }
    };

    initLocationFlow();
  }, [dispatch, restaurants]);

  // When restaurants list loads from network/cache and location is already determined, calculate distances
  useEffect(() => {
    if (restaurants && restaurants.length > 0 && userLocation && !selectedSavedAddressId) {
      const sampleId = restaurants[0]?._id || restaurants[0]?.restId || restaurants[0]?.id;
      if (sampleId && !roadDistances[String(sampleId)] && !hasTriggeredDistanceCalc.current) {
        hasTriggeredDistanceCalc.current = true;
        dispatch(checkLocationAndCalculateDistances({
          restaurantsList: restaurants,
          customCoords: userLocation
        }));
      }
    }
  }, [restaurants, userLocation, roadDistances, selectedSavedAddressId, dispatch]);

  const lastBackPressTime = useRef(0);

  // Toast state and animated values
  const [toastConfig, setToastConfig] = useState({ visible: false, message: '', type: 'success' });
  const [toastOpacity] = useState(() => new Animated.Value(0));
  const [toastTranslateY] = useState(() => new Animated.Value(30));
  const toastTimeoutRef = useRef(null);

  const triggerToast = useCallback((message, type = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastOpacity.setValue(0);
    toastTranslateY.setValue(30);
    setToastConfig({ visible: true, message, type });

    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    toastTimeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: 30,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setToastConfig({ visible: false, message: '', type: 'success' });
      });
    }, type === 'warning' ? 3000 : 2000);
  }, [toastOpacity, toastTranslateY]);

  useFocusEffect(
    useCallback(() => {
      showTabBar(true);
      let isMounted = true;

      const onBackPress = () => {
        const now = Date.now();
        if (lastBackPressTime.current && now - lastBackPressTime.current < 2000) {
          BackHandler.exitApp();
          return true;
        }

        lastBackPressTime.current = now;
        if (Platform.OS === 'android') {
          ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        }
        triggerToast('PRESS BACK AGAIN TO EXIT APP', 'warning');
        return true;
      };

      const backSubscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      const syncFocusLocation = async () => {
        const uid = await AsyncStorage.getItem('userid');
        if (uid) {
          try {
            const cachedActiveOrder = await AsyncStorage.getItem(`has_active_order_${uid}`);
            if (cachedActiveOrder === 'true' && isMounted) {
              setShowDeliverToModal(false);
              globalHasShownDeliverToModal = true;
            }

            const savedAddrId = await AsyncStorage.getItem('selected_saved_address_id');
            if (savedAddrId && savedAddrId !== selectedSavedAddressId) {
              dispatch(setSelectedSavedAddressId(savedAddrId));
            }

            // Only load cached addresses if Redux state is empty
            if ((!savedAddresses || savedAddresses.length === 0) && isMounted) {
              const cached = await AsyncStorage.getItem(`saved_addresses_${uid}`);
              if (cached) {
                const parsed = JSON.parse(cached) || [];
                dispatch(setSavedAddressesRedux(parsed));
              }
            }
          } catch (err) {
            console.warn('[RestaurantList] Error loading addresses on focus:', err);
          }
        }
      };

      syncFocusLocation();

      return () => {
        isMounted = false;
        backSubscription.remove();
      };
    }, [dispatch, showTabBar, triggerToast])
  );

  const formatTimeAMPM = (timeStr) => {
    if (!timeStr) return '';
    const str = String(timeStr).trim();
    if (str.toUpperCase().includes('AM') || str.toUpperCase().includes('PM')) {
      return str;
    }
    const parts = str.split(':');
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1].slice(0, 2);
      if (isNaN(hours)) return str;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      return `${hours}:${minutes} ${ampm}`;
    }
    return str;
  };

  const isRestActive = (item) => {
    if (!item) return true;
    return item.isActive !== false && item.isActive !== 'false' && item.isactive !== false && item.isactive !== 'false' && item.isActive !== 0 && item.isactive !== 0 && item.status !== 'closed' && item.status !== 'INACTIVE';
  };

  const handlePressRestaurant = useCallback((item, displayName) => {
    const isActive = isRestActive(item);
    if (!isActive) {
      triggerToast('THIS RESTAURANT IS CURRENTLY CLOSED!', 'warning');
      return;
    }
    const targetId = item._id || item.restId;
    if (targetId) {
      dispatch(fetchRestaurantMenu(targetId));
    }
    router.push({
      pathname: `/restaurentlist/${item._id || item.restId}`,
      params: {
        restId: item.restId,
        name: displayName,
        logoUrl: item.logoUrl || '',
        address: item.address || '',
        openTime: item.openTime || '',
        closeTime: item.closeTime || '',
        offerTitle: item.offerTitle || ''
      }
    });
  }, [dispatch, router, triggerToast]);

  const handlePressCarousel = useCallback((item) => {
    if (!item || !item.restaurantId || !item.restaurantId.trim()) {
      return;
    }
    const targetRestId = item.restaurantId.trim();
    const foundRestaurant = restaurants.find(
      (r) => String(r.restId) === String(targetRestId) || String(r._id) === String(targetRestId)
    );

    if (foundRestaurant) {
      handlePressRestaurant(foundRestaurant, foundRestaurant.name || item.title || 'Restaurant');
    } else {
      dispatch(fetchRestaurantMenu(targetRestId));
      router.push({
        pathname: `/restaurentlist/${targetRestId}`,
        params: {
          restId: targetRestId,
          name: item.title || 'Restaurant',
          logoUrl: '',
          address: '',
          openTime: '',
          closeTime: '',
          offerTitle: '',
        },
      });
    }
  }, [restaurants, handlePressRestaurant, dispatch, router]);

  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeType, setActiveType] = useState('All'); // 'All', 'Veg', 'Non-Veg'
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Horizontal category scroll indicators state
  const [canScrollCatLeft, setCanScrollCatLeft] = useState(false);
  const [canScrollCatRight, setCanScrollCatRight] = useState(true);
  const currentCatScrollX = useRef(0);

  const handleCategoryScroll = useCallback((event) => {
    const { contentOffset } = event.nativeEvent;
    const x = contentOffset?.x || 0;
    currentCatScrollX.current = x;
    const isScrolled = x > 15;
    
    setCanScrollCatLeft((prev) => (prev !== isScrolled ? isScrolled : prev));
    setCanScrollCatRight((prev) => (prev === isScrolled ? !isScrolled : prev));
  }, []);

  const handleScrollCatLeft = useCallback(() => {
    const newX = Math.max(0, currentCatScrollX.current - 240);
    categoryScrollRef.current?.scrollTo({ x: newX, animated: true });
  }, []);

  const handleScrollCatRight = useCallback(() => {
    const newX = currentCatScrollX.current + 240;
    categoryScrollRef.current?.scrollTo({ x: newX, animated: true });
  }, []);

  // Animated values for filter pills (sliding indicator + button spring scale micro-animations)
  const [filterTranslateX] = useState(() => new Animated.Value(0));
  const [allScale] = useState(() => new Animated.Value(1));
  const [vegScale] = useState(() => new Animated.Value(1));
  const [nonVegScale] = useState(() => new Animated.Value(1));

  const animateButtonPress = useCallback((scaleAnim) => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleActiveTypeChange = useCallback((type) => {
    if (activeType === type) return;

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      try {
        LayoutAnimation.configureNext(SMOOTH_LAYOUT_ANIMATION);
      } catch (_e) {}
    }

    let targetX = 0;
    if (type === 'Veg') targetX = 42;
    else if (type === 'Non-Veg') targetX = 84;

    Animated.spring(filterTranslateX, {
      toValue: targetX,
      tension: 240,
      friction: 18,
      useNativeDriver: true,
    }).start();

    setActiveType(type);
  }, [activeType, filterTranslateX]);

  const handleSelectCategory = useCallback((catName) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      try {
        LayoutAnimation.configureNext(SMOOTH_LAYOUT_ANIMATION);
      } catch (_e) {}
    }
    setSelectedCategory(catName);
  }, []);



  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const loading = !initialLoaded && reduxLoading;

  // Carousel auto-scroll state
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);



  // Scroll handler for hiding/showing floating tab bar
  const handleScroll = (event) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    const diff = currentOffset - lastOffsetY.current;

    if (Math.abs(diff) > 3) {
      if (diff > 0 && currentOffset > 25) {
        hideTabBar();
      } else if (diff < 0) {
        showTabBar();
      }
      lastOffsetY.current = currentOffset;
    }
  };

  // Fetch initial data on mount (load cache first, then fetch live updates)
  useEffect(() => {
    console.log(`[RestaurantList] Screen focused/mounted. initialLoaded: ${initialLoaded}, reduxLoading: ${reduxLoading}`);
    if (!initialLoaded && !reduxLoading) {
      console.log('[RestaurantList] Loading cached data and fetching fresh restaurants...');
      dispatch(loadCachedRestaurants()).then(() => {
        dispatch(fetchRestaurants());
      });
    }
  }, [dispatch, initialLoaded, reduxLoading]);

  // Background Menu Prefetching for Instant Item Search & Instant Menu Open (runs immediately once restaurants are loaded)
  useEffect(() => {
    if (restaurants && restaurants.length > 0 && !globalHasPrefetchedMenus) {
      globalHasPrefetchedMenus = true;
      dispatch(fetchAllRestaurantMenus(restaurants));
    }
  }, [dispatch, restaurants]);

  // Auto-trigger distance calculation as soon as restaurants are loaded
  useEffect(() => {
    let isCancelled = false;
    const triggerDistance = async () => {
      if (restaurants && restaurants.length > 0 && !hasTriggeredDistanceCalc.current && locationStatus !== 'requesting') {
        const uid = await AsyncStorage.getItem('userid');
        if (uid) {
          const cachedActiveOrder = await AsyncStorage.getItem(`has_active_order_${uid}`);
          if (cachedActiveOrder === 'true') {
            return;
          }
        }
        if (isCancelled) return;
        const hasAnyDistance = restaurants.some(r => roadDistances && (roadDistances[r._id] || roadDistances[r.restId] || roadDistances[r.id] || roadDistances[r.name]));
        if (!hasAnyDistance) {
          hasTriggeredDistanceCalc.current = true;
          if (selectedSavedAddressId) {
            const addrList = Array.isArray(savedAddresses) ? savedAddresses : [];
            const selectedAddr = addrList.find(a => a && typeof a === 'object' && String(a.id || a._id) === String(selectedSavedAddressId));
            const sLat = selectedAddr?.lat ?? selectedAddr?.latitude;
            const sLng = selectedAddr?.lng ?? selectedAddr?.longitude;
            if (sLat && sLng) {
              dispatch(checkLocationAndCalculateDistances({
                restaurantsList: restaurants,
                customCoords: { latitude: Number(sLat), longitude: Number(sLng) }
              }));
              return;
            }
          }
          dispatch(checkLocationAndCalculateDistances(restaurants));
        }
      }
    };
    triggerDistance();
    return () => {
      isCancelled = true;
    };
  }, [restaurants, roadDistances, dispatch, selectedSavedAddressId, savedAddresses, locationStatus]);

  const lastStatusFetchTimeRef = useRef(0);

  // Focus Effect: Re-fetch fresh restaurant statuses silently in background (at most once every 30s)
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const now = Date.now();
      if (now - lastStatusFetchTimeRef.current < 30000) {
        return;
      }
      lastStatusFetchTimeRef.current = now;

      const timer = setTimeout(async () => {
        try {
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;

          const restRes = await fetch(`${API_URL}/restaurants?t=${Date.now()}`, {
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
            signal: controller ? controller.signal : undefined,
          });
          if (timeoutId) clearTimeout(timeoutId);

          if (restRes.ok) {
            const restData = await restRes.json();
            const freshList = restData.restaurants || [];
            if (isMounted && freshList.length > 0) {
              dispatch(updateRestaurantStatuses(freshList));
            }
          }
        } catch (error) {
          console.warn('[RestaurantList] Error updating status on focus:', error);
        }
      }, 1000);

      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }, [dispatch])
  );

  // Background Polling for Restaurant active status updates (every 15 seconds with timeout & AppState awareness)
  useEffect(() => {
    const fetchStatusesSilently = async () => {
      if (AppState.currentState !== 'active') return;
      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;

        const restRes = await fetch(`${API_URL}/restaurants?t=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
          signal: controller ? controller.signal : undefined,
        });
        if (timeoutId) clearTimeout(timeoutId);

        const restData = await restRes.json();
        if (restRes.ok && (restData.success || restData.restaurants)) {
          dispatch(updateRestaurantStatuses(restData.restaurants || []));
        }
      } catch (error) {
        console.warn('[RestaurantList] Background polling error:', error.message);
      }
    };

    const interval = setInterval(fetchStatusesSilently, 15000);

    // Also listen to AppState changes (e.g. app resuming after 3 hours)
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        console.log('[RestaurantList] App resumed. Fetching fresh restaurant statuses...');
        fetchStatusesSilently();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [dispatch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await dispatch(fetchRestaurants()).unwrap();
    } catch (error) {
      console.error('[RestaurantList] Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Carousel Auto-Scroll Logic (runs only when app is active)
  useEffect(() => {
    if (carouselItems.length === 0) return;

    const interval = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      setActiveCarouselIndex((prevIndex) => {
        let nextIndex = prevIndex + 1;
        if (nextIndex >= carouselItems.length) {
          nextIndex = 0;
        }
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        return nextIndex;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [carouselItems]);

  const onMomentumScrollEnd = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / CAROUSEL_WIDTH);
    setActiveCarouselIndex(index);
  };

  const [initialLoadingTimeout, setInitialLoadingTimeout] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoadingTimeout(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Memoized filter and search calculations to prevent heavy re-computations on every render tick
  const { filteredList, matchingItemsMap } = useMemo(() => {
    const matchingMap = {};
    if (!restaurants || restaurants.length === 0) {
      return { filteredList: [], matchingItemsMap: matchingMap };
    }

    const query = searchQuery ? searchQuery.trim().toLowerCase() : '';
    const hasQuery = Boolean(query);
    const isAllType = activeType === 'All';
    const hasCatFilter = Boolean(selectedCategory);

    // Fast-path: Default home view with no filters applied executes in ~0.1ms
    if (!hasQuery && !hasCatFilter && isAllType) {
      const sorted = [...restaurants].sort((a, b) => {
        const aActive = isRestActive(a);
        const bActive = isRestActive(b);
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;

        const posA = a.position !== undefined ? Number(a.position) : 999999;
        const posB = b.position !== undefined ? Number(b.position) : 999999;
        return (isNaN(posA) ? 999999 : posA) - (isNaN(posB) ? 999999 : posB);
      });
      return { filteredList: sorted, matchingItemsMap: matchingMap };
    }

    let normalSelected = '';
    let singularSelected = '';
    if (hasCatFilter) {
      normalSelected = selectedCategory.toLowerCase().trim();
      singularSelected = normalSelected.endsWith('s') ? normalSelected.slice(0, -1) : normalSelected;
    }

    const list = restaurants
      .filter((item) => {
        // Fast Step 1: Filter by Veg/Non-Veg
        if (!isAllType) {
          const restType = item.vegOrNonVeg || 'Both';
          if (activeType === 'Veg' && restType !== 'Veg') return false;
          if (activeType === 'Non-Veg' && restType !== 'Non-Veg' && restType !== 'Both') return false;
        }

        // Fast Step 2: Filter by selected category
        if (hasCatFilter) {
          const itemCats = item.categories;
          if (!itemCats || itemCats.length === 0) return false;

          let hasCategory = false;
          for (let i = 0; i < itemCats.length; i++) {
            const c = itemCats[i];
            if (!c || typeof c !== 'string') continue;
            const normalC = c.toLowerCase().trim();
            if (
              normalC.includes(normalSelected) ||
              normalSelected.includes(normalC) ||
              (singularSelected && normalC.includes(singularSelected))
            ) {
              hasCategory = true;
              break;
            }
          }
          if (!hasCategory) return false;
        }

        const restIdKey = item._id || item.restId;
        const restMenu = menus[restIdKey] || menus[item.restId] || menus[item._id] || [];

        // Populate matching menu items for selected category filter display
        if (hasCatFilter && !hasQuery && restMenu.length > 0) {
          const catMatchingItems = [];
          for (let i = 0; i < restMenu.length; i++) {
            const mItem = restMenu[i];
            if (!mItem) continue;
            const isAvail = mItem.itemStatus !== false && mItem.itemStatus !== 'false' && mItem.itemStatus !== 0 &&
                            mItem.itemtodisplayintherestuarentapp !== false && mItem.itemtodisplayintherestuarentapp !== 'false' && mItem.itemtodisplayintherestuarentapp !== 0 &&
                            mItem.status !== 'unavailable' && mItem.status !== 'OUT_OF_STOCK' && mItem.status !== 'inactive' && mItem.status !== false && mItem.status !== 0 &&
                            mItem.available !== false && mItem.available !== 'false' && mItem.available !== 0 &&
                            mItem.isAvailable !== false && mItem.isAvailable !== 'false' && mItem.isAvailable !== 0;
            if (!isAvail) continue;

            const itemCat = (mItem.category || '').toLowerCase().trim();
            const singularCat = itemCat.endsWith('s') ? itemCat.slice(0, -1) : itemCat;

            if (
              itemCat.includes(normalSelected) ||
              normalSelected.includes(itemCat) ||
              (singularSelected && itemCat.includes(singularSelected)) ||
              (singularCat && normalSelected.includes(singularCat))
            ) {
              catMatchingItems.push(mItem);
            }
          }
          if (catMatchingItems.length > 0) {
            matchingMap[item._id || item.restId] = catMatchingItems;
          }
        }

        // Fast Step 3: Search query (only evaluate menu items if user typed a search query!)
        if (hasQuery) {
          const nameField = item.name || item.email || '';
          const addressField = item.address || '';

          const matchesName = isTextMatchingQuery(nameField, query);
          const matchesAddress = query.length >= 3 && addressField.toLowerCase().includes(query);

          const itemCats = item.categories || [];
          let hasCategoryMatch = false;
          for (let i = 0; i < itemCats.length; i++) {
            if (itemCats[i] && isTextMatchingQuery(itemCats[i], query)) {
              hasCategoryMatch = true;
              break;
            }
          }

          let matchingItems = [];
          if (restMenu.length > 0) {
            for (let i = 0; i < restMenu.length; i++) {
              const mItem = restMenu[i];
              if (!mItem) continue;
              const isAvail = mItem.itemStatus !== false && mItem.itemStatus !== 'false' && mItem.itemStatus !== 0 &&
                              mItem.itemtodisplayintherestuarentapp !== false && mItem.itemtodisplayintherestuarentapp !== 'false' && mItem.itemtodisplayintherestuarentapp !== 0 &&
                              mItem.status !== 'unavailable' && mItem.status !== 'OUT_OF_STOCK' && mItem.status !== 'inactive' && mItem.status !== false && mItem.status !== 0 &&
                              mItem.available !== false && mItem.available !== 'false' && mItem.available !== 0 &&
                              mItem.isAvailable !== false && mItem.isAvailable !== 'false' && mItem.isAvailable !== 0;
              if (!isAvail) continue;

              const itemName = mItem.itemName || mItem.name || '';
              const itemCat = mItem.category || '';
              const itemDesc = mItem.description || '';

              if (
                isTextMatchingQuery(itemName, query) ||
                isTextMatchingQuery(itemCat, query) ||
                isTextMatchingQuery(itemDesc, query)
              ) {
                matchingItems.push(mItem);
              }
            }
          }

          const hasItemMatch = matchingItems.length > 0;
          const matchesSearch = matchesName || matchesAddress || hasCategoryMatch || hasItemMatch;
          if (!matchesSearch) return false;

          if (hasItemMatch) {
            matchingMap[item._id || item.restId] = matchingItems;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const aActive = isRestActive(a);
        const bActive = isRestActive(b);
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;

        const parsePos = (val) => {
          if (val === undefined || val === null || val === '') return 999999;
          const num = Number(val);
          return isNaN(num) ? 999999 : num;
        };

        const posA = parsePos(a.position ?? a.pos);
        const posB = parsePos(b.position ?? b.pos);

        if (posA !== posB) return posA - posB;

        return 0;
      });

    return { filteredList: list, matchingItemsMap: matchingMap };
  }, [restaurants, searchQuery, activeType, selectedCategory, menus]);

  const isWarningToast = toastConfig.type === 'warning';
  const toastBgColor = isWarningToast ? '#D32F2F' : '#008000';
  const toastIconColor = isWarningToast ? '#D32F2F' : '#008000';
  const toastIconName = isWarningToast ? 'alert' : 'checkmark';

  const renderHeader = useMemo(() => (
    <View>
      {/* Top Location Selection Bar */}
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgb(224, 214, 188)',
          marginHorizontal: 0,
          marginTop: 0,
          marginBottom: 16,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 14,
          gap: 10,
        }}
        activeOpacity={0.75}
        onPress={() => setShowDeliverToModal(true)}
      >
        <Feather name="map-pin" size={18} color="#FA4D56" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, color: '#808C94', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Deliver to
          </Text>
          <Text style={{ fontSize: 13, color: '#1E3545', fontWeight: '600' }} numberOfLines={1}>
            {(() => {
              if (selectedSavedAddressId) {
                const addrList = Array.isArray(savedAddresses) ? savedAddresses : [];
                const selectedAddr = addrList.find(
                  (a) => a && typeof a === 'object' && String(a.id || a._id) === String(selectedSavedAddressId)
                );
                if (selectedAddr) {
                  const tagLabel = selectedAddr.tag || selectedAddr.label || 'Saved Address';
                  const detailStr = [selectedAddr.flatNo, selectedAddr.street].filter(Boolean).join(', ');
                  return detailStr ? `${tagLabel} - ${detailStr}` : tagLabel;
                }
                return 'Saved Address';
              }
              if (locationStatus === 'inside') {
                if (userAddress && (userAddress.formattedAddress || userAddress.street)) {
                  return userAddress.formattedAddress || [userAddress.street, userAddress.subregion || userAddress.city].filter(Boolean).join(', ');
                }
                return 'Current Location (GPS)';
              }
              if (locationStatus === 'skipped') {
                return 'Skipped location (Explore only)';
              }
              return 'Select your location...';
            })()}
          </Text>
        </View>
        <Feather name="chevron-down" size={18} color="#1E3545" />
      </TouchableOpacity>

      {/* Fast CDN-mapped Carousel */}
      {carouselItems.length > 0 && (
        <View style={styles.carouselContainer}>
          <FlatList
            ref={flatListRef}
            data={carouselItems}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item._id || item.carouselId}
            onMomentumScrollEnd={onMomentumScrollEnd}
            getItemLayout={(data, index) => ({
              length: CAROUSEL_WIDTH,
              offset: CAROUSEL_WIDTH * index,
              index,
            })}
            renderItem={({ item }) => {
              const hasTargetRest = !!(item.restaurantId && item.restaurantId.trim());
              return (
                <TouchableOpacity
                  activeOpacity={hasTargetRest ? 0.85 : 1}
                  onPress={() => handlePressCarousel(item)}
                  disabled={!hasTargetRest}
                  style={[styles.carouselSlide, { width: CAROUSEL_WIDTH }]}
                >
                  <CarouselImage
                    uri={item.imageUrl}
                    style={styles.carouselImage}
                  />
                  {!!(item.tag || item.title) && (
                    <View style={styles.carouselOverlay}>
                      {item.tag ? <Text style={styles.carouselTag}>{item.tag}</Text> : null}
                      {item.title ? <Text style={styles.carouselTitle}>{item.title}</Text> : null}
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
          {/* Carousel Dot Indicators */}
          <View style={styles.paginationContainer}>
            {carouselItems.map((_, index) => (
              <View
                key={`dot-${index}`}
                style={[
                  styles.paginationDot,
                  activeCarouselIndex === index && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {/* Search Engine Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={20} color="#1E3545" />
          <TextInput
            style={styles.searchPlaceholderText}
            placeholder="Search restaurants or dishes..."
            placeholderTextColor="#808C94"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            numberOfLines={1}
            multiline={false}
            textAlignVertical="center"
            returnKeyType="search"
          />
        </View>

        <View style={styles.filterPillContainer}>
          {/* Smooth Animated Sliding Active Pill Background */}
          <Animated.View
            style={[
              styles.filterPillActiveBg,
              {
                transform: [{ translateX: filterTranslateX }],
              },
            ]}
          />

          {/* All segment */}
          <Animated.View style={{ transform: [{ scale: allScale }] }}>
            <TouchableOpacity
              style={styles.filterButton}
              activeOpacity={0.8}
              onPress={() => {
                animateButtonPress(allScale);
                handleActiveTypeChange('All');
              }}
            >
              <Text style={[
                styles.allButtonText,
                activeType !== 'All' && { color: '#666666' }
              ]}>All</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Veg green square dot segment */}
          <Animated.View style={{ transform: [{ scale: vegScale }] }}>
            <TouchableOpacity
              style={styles.filterButton}
              activeOpacity={0.8}
              onPress={() => {
                animateButtonPress(vegScale);
                handleActiveTypeChange('Veg');
              }}
            >
              <View style={{
                width: 20,
                height: 20,
                borderWidth: 2,
                borderColor: '#0F8A65',
                borderRadius: 4,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: activeType === 'Veg' ? '#E8F5E9' : '#FFF'
              }}>
                <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#0F8A65' }} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Non-veg red square dot segment */}
          <Animated.View style={{ transform: [{ scale: nonVegScale }] }}>
            <TouchableOpacity
              style={styles.filterButton}
              activeOpacity={0.8}
              onPress={() => {
                animateButtonPress(nonVegScale);
                handleActiveTypeChange('Non-Veg');
              }}
            >
              <View style={{
                width: 20,
                height: 20,
                borderWidth: 2,
                borderColor: '#E53935',
                borderRadius: 4,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: activeType === 'Non-Veg' ? '#FFEBEE' : '#FFF'
              }}>
                <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#E53935' }} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      {/* Horizontal Category Filter List */}
      {categories.length > 0 && (
        <View style={styles.categoriesContainer}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 4,
            marginBottom: 10,
            paddingHorizontal: 16,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#1E3545',
              paddingHorizontal: 12,
              paddingVertical: 3.5,
              borderRadius: 10,
              gap: 7,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.12,
              shadowRadius: 3,
              elevation: 2,
            }}>
              <View style={{
                width: 7,
                height: 7,
                borderRadius: 3.5,
                backgroundColor: '#0F8A65',
              }} />
              <Text style={{
                fontSize: 12,
                fontWeight: '800',
                color: '#FFFFFF',
                letterSpacing: 0.7,
                textTransform: 'uppercase',
              }}>
                Most Popular Categories
              </Text>
            </View>
            <View style={{
              flex: 1,
              height: 1.5,
              backgroundColor: 'rgba(30, 53, 69, 0.15)',
              marginLeft: 12,
              borderRadius: 1,
            }} />
          </View>

          <View style={{ position: 'relative' }}>
            <ScrollView
              ref={categoryScrollRef}
              horizontal
              bounces={false}
              overScrollMode="never"
              directionalLockEnabled={true}
              nestedScrollEnabled={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesScroll}
              onScroll={handleCategoryScroll}
              scrollEventThrottle={16}
            >
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.name;
                return (
                  <TouchableOpacity
                    key={cat._id}
                    style={[
                      styles.categoryCard,
                      isSelected && styles.categoryCardActive
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      handleSelectCategory(isSelected ? null : cat.name);
                    }}
                  >
                    <Image
                      source={{ uri: cat.imageUrl }}
                      style={[styles.categoryImage, isSelected && styles.categoryImageActive]}
                      contentFit="cover"
                      onError={(e) => console.log(`[Category Image Error] Failed to load "${cat.name}" from ${cat.imageUrl}:`, e.nativeEvent.error)}
                    />
                    <View style={[styles.categoryOverlay, isSelected && styles.categoryOverlayActive]}>
                      <Text
                        style={styles.categoryText}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.7}
                      >
                        {cat.name}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={styles.categoryCloseBadge}>
                        <Feather name="x" size={10} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {canScrollCatLeft && (
              <TouchableOpacity
                style={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  marginTop: -16,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: '#FFFFFF',
                  justifyContent: 'center',
                  alignItems: 'center',
                  elevation: 5,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  zIndex: 20,
                  borderWidth: 1,
                  borderColor: 'rgba(0, 0, 0, 0.08)',
                }}
                activeOpacity={0.8}
                onPress={handleScrollCatLeft}
              >
                <Feather name="chevron-left" size={20} color="#1E3545" />
              </TouchableOpacity>
            )}

            {canScrollCatRight && (
              <TouchableOpacity
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  marginTop: -16,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: '#FFFFFF',
                  justifyContent: 'center',
                  alignItems: 'center',
                  elevation: 5,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  zIndex: 20,
                  borderWidth: 1,
                  borderColor: 'rgba(0, 0, 0, 0.08)',
                }}
                activeOpacity={0.8}
                onPress={handleScrollCatRight}
              >
                <Feather name="chevron-right" size={20} color="#1E3545" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  ), [
    selectedSavedAddressId,
    savedAddresses,
    locationStatus,
    userAddress,
    carouselItems,
    activeCarouselIndex,
    searchQuery,
    filterTranslateX,
    allScale,
    activeType,
    vegScale,
    nonVegScale,
    categories,
    selectedCategory,
    canScrollCatLeft,
    canScrollCatRight,
    handlePressCarousel,
    handleActiveTypeChange,
    handleCategoryScroll,
    handleSelectCategory,
    handleScrollCatLeft,
    handleScrollCatRight,
    animateButtonPress
  ]);

  const renderRestaurantCard = useCallback(({ item, index: cardIdx }) => {
    const matchingDishes = matchingItemsMap[item._id || item.restId];
    const isActive = isRestActive(item);
    const imageUri = item.logoUrl || 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=500';
    const rawName = item.name || item.email || 'Restaurant';
    const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    return (
      <AnimatedCardWrapper
        key={item._id || item.restId}
        index={cardIdx}
        filterKey={`${activeType}_${selectedCategory || ''}_${searchQuery}`}
      >
        <TouchableOpacity
          style={[
            styles.restaurantCard,
            !isActive && { backgroundColor: '#E4E1D8' }
          ]}
          activeOpacity={isActive ? 0.85 : 1}
          onPress={() => handlePressRestaurant(item, displayName)}
        >
          <View style={styles.restaurantImageContainer}>
            <Image
              source={{ uri: imageUri }}
              style={[
                styles.restaurantImage,
                !isActive && Platform.OS === 'web' && { filter: 'grayscale(100%)' }
              ]}
              contentFit="cover"
            />
            <View style={[styles.ratingBadge, { backgroundColor: isActive ? '#2B783E' : '#707070' }]}>
              <FontAwesome name="star" size={10} color="#FFD200" />
              <Text style={styles.ratingText}>
                {((parseInt(item.restId || '1') % 5) * 0.1 + 4.1).toFixed(1)}
              </Text>
            </View>
          </View>

          <View style={styles.restaurantInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={[styles.restaurantName, !isActive && { color: '#606060' }, { marginBottom: 0, flex: 1, marginRight: 8 }]} numberOfLines={1}>{displayName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {(() => {
                  if (!isActive) {
                    return (
                      <View style={{
                        backgroundColor: '#DC2626',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <Feather name="clock" size={11} color="#FFF" />
                        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: 'bold' }}>
                          {item.openTime ? `Opens at ${formatTimeAMPM(item.openTime)}` : 'Closed'}
                        </Text>
                      </View>
                    );
                  }
                  const closingSoonText = getClosingSoonStatus(item.closeTime, nowTime);
                  if (!closingSoonText) return null;
                  return (
                    <View style={{
                      backgroundColor: '#D9534F',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 8,
                    }}>
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>
                        {closingSoonText}
                      </Text>
                    </View>
                  );
                })()}
                {item.offerTitle && item.offerTitle !== '0' && item.offerTitle !== 0 ? (
                  <View style={{
                    backgroundColor: '#FF6F00',
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                  }}>
                    <Text style={{
                      color: '#FFF',
                      fontSize: 11,
                      fontWeight: 'bold',
                    }}>
                      {item.offerTitle}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              {item.address ? (
                <View style={[styles.locationContainer, { flex: 1, marginRight: 8, marginBottom: 0 }]}>
                  <FontAwesome name="map-marker" size={14} color={isActive ? "#E05A47" : "#707070"} />
                  <Text style={[styles.locationText, !isActive && { color: '#7E8A81' }, { flexShrink: 1 }]} numberOfLines={1}>{item.address}</Text>
                </View>
              ) : null}

              {(() => {
                const distVal = roadDistances && (
                  roadDistances[item._id] ||
                  roadDistances[item.restId] ||
                  roadDistances[item.id] ||
                  roadDistances[item.restaurantId] ||
                  roadDistances[item.name]
                );
                if (!distVal) return null;
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <FontAwesome5 name="motorcycle" size={12} color={isActive ? "#2B783E" : "#707070"} />
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: isActive ? '#1E3545' : '#707070' }}>
                      {distVal}
                    </Text>
                  </View>
                );
              })()}
            </View>

            {(searchQuery || selectedCategory) && matchingDishes && matchingDishes.length > 0 ? (
              <View style={{
                marginTop: 8,
                paddingTop: 6,
                borderTopWidth: 1,
                borderTopColor: 'rgba(0, 0, 0, 0.08)',
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 6
              }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#1E3545', flexShrink: 0 }}>
                  Dishes:
                </Text>
                {matchingDishes.slice(0, 2).map((dish, idx) => (
                  <View key={idx} style={{
                    backgroundColor: '#E8F5E9',
                    borderColor: '#2B783E',
                    borderWidth: 1,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                  }}>
                    <Text style={{ fontSize: 11, color: '#2B783E', fontWeight: 'bold' }}>
                      {dish.itemName || dish.name}
                    </Text>
                  </View>
                ))}
                {matchingDishes.length > 2 && (
                  <View style={{
                    backgroundColor: '#2B783E',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                  }}>
                    <Text style={{ fontSize: 11, color: '#FFFFFF', fontWeight: 'bold' }}>
                      +{matchingDishes.length - 2} items
                    </Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      </AnimatedCardWrapper>
    );
  }, [
    matchingItemsMap,
    roadDistances,
    nowTime,
    searchQuery,
    selectedCategory,
    activeType,
    handlePressRestaurant
  ]);

  if (initialLoadingTimeout && !initialLoaded && reduxLoading && (!restaurants || restaurants.length === 0)) {
    return <LoadingView />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={filteredList}
        keyExtractor={(item) => item._id || item.restId}
        ListHeaderComponent={renderHeader}
        renderItem={renderRestaurantCard}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#E05A47" />
        }
      />

      {/* Toast Notification Banner */}
      {toastConfig.visible && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
        >
          <View style={[styles.toastContent, { backgroundColor: toastBgColor }]}>
            <View style={styles.toastIconContainer}>
              <Ionicons name={toastIconName} size={12} color={toastIconColor} />
            </View>
            <Text style={styles.toastText}>{toastConfig.message}</Text>
          </View>
        </Animated.View>
      )}

      {/* Fetching Location Overlay Modal */}
      <Modal transparent visible={showFetchingModal} animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.4)' }]}>
          <View style={[styles.modalContent, { backgroundColor: '#F9F9F6' }]}>
            <ActivityIndicator size="large" color="#1E3545" style={{ marginBottom: 16 }} />
            <Text style={styles.modalTitle}>Fetching Location & Distance</Text>
            <Text style={styles.modalSub}>
              Retrieving your coordinates and calculating delivery distances...
            </Text>
          </View>
        </View>
      </Modal>

      {/* GPS Off / Permission Denied Modal (Hidden — only 1 delivery location selector modal is shown) */}

      {/* Deliver To Selector Modal */}
      <Modal transparent visible={showDeliverToModal} animationType="slide" onRequestClose={() => {}}>
        <View style={[styles.modalOverlay, { backgroundColor: 'transparent' }]}>
          <View style={[styles.modalContent, { maxHeight: '80%', backgroundColor: 'rgb(224, 214, 188)', position: 'relative' }]}>
            {/* Top-Right X Close Symbol */}
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10
              }}
              activeOpacity={0.7}
              onPress={() => {
                setShowDeliverToModal(false);
                dispatch(skipLocation());
                showTabBar(true);
              }}
            >
              <Feather name="x" size={20} color="#1E3545" />
            </TouchableOpacity>

            <View style={[styles.modalIconContainer, { backgroundColor: '#F0F6F0' }]}>
              <Feather name="map-pin" size={30} color="#2B783E" />
            </View>
            <Text style={styles.modalTitle}>Select Delivery Location</Text>
            <Text style={[styles.modalSub, { marginBottom: 20 }]}>
              Please choose where you would like your food delivered:
            </Text>

            <ScrollView style={{ width: '100%', maxHeight: 310, marginBottom: 15 }} showsVerticalScrollIndicator={false}>
              {/* Option A: Current Location */}
              {(() => {
                const isCurrentSelected = !selectedSavedAddressId;
                return (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 14,
                      backgroundColor: isCurrentSelected ? '#F0F6F0' : '#FFF',
                      borderColor: isCurrentSelected ? '#2B783E' : '#E4E1D8',
                      borderWidth: 1,
                      borderRadius: 12,
                      marginBottom: 12,
                      gap: 12
                    }}
                    activeOpacity={0.8}
                    onPress={async () => {
                      setShowDeliverToModal(false);
                      dispatch(setSelectedSavedAddressId(null));
                      try {
                        if (Platform.OS === 'android') {
                          try {
                            await Location.enableNetworkProviderAsync();
                          } catch (e) {
                            console.warn('Network provider enable failed:', e);
                          }
                        }
                        await dispatch(checkLocationAndCalculateDistances(restaurants)).unwrap();
                        await AsyncStorage.setItem('user_location_choice', 'inside');
                      } catch (err) {
                        console.warn('[Location UI] Current location check skipped/failed:', err);
                        if (err && (err.type === 'PERMISSION_DENIED' || err.type === 'GPS_OFF')) {
                          dispatch(skipLocation());
                        }
                      }
                    }}
                  >
                    <Feather name="navigation" size={20} color={isCurrentSelected ? "#2B783E" : "#1E3545"} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: isCurrentSelected ? "#2B783E" : "#1E3545" }}>Use Current Location</Text>
                      <Text style={{ fontSize: 11, color: '#808C94' }}>{"Locate me using my device's GPS"}</Text>
                    </View>
                    {isCurrentSelected && <Feather name="check" size={18} color="#2B783E" />}
                  </TouchableOpacity>
                );
              })()}

              {/* Option B: Saved Addresses list */}
              {(() => {
                const addrList = Array.isArray(savedAddresses) ? savedAddresses : [];
                if (!addrList || addrList.length === 0) return null;

                return (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, color: '#000000', fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Saved Addresses
                    </Text>
                    {addrList.map((addr, addrIdx) => {
                      if (!addr || typeof addr !== 'object') return null;
                      const addrId = String(addr.id || addr._id || `addr-${addrIdx}`);
                      const isSelected = String(selectedSavedAddressId) === addrId;
                      const tagLabel = addr.tag || addr.label || 'Address';
                      const addrStreet = addr.street || addr.address || '';
                      const addrFlat = addr.flatNo ? `${addr.flatNo}, ` : '';

                      return (
                        <TouchableOpacity
                          key={addrId}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 14,
                            backgroundColor: isSelected ? '#F0F6F0' : '#FFF',
                            borderColor: isSelected ? '#2B783E' : '#E4E1D8',
                            borderWidth: 1,
                            borderRadius: 12,
                            marginBottom: 8,
                            gap: 12
                          }}
                          activeOpacity={0.8}
                          onPress={() => {
                            setShowDeliverToModal(false);
                            dispatch(setSelectedSavedAddressId(addrId));
                            const addrLat = addr.lat !== undefined ? addr.lat : addr.latitude;
                            const addrLng = addr.lng !== undefined ? addr.lng : addr.longitude;
                            if (addrLat !== undefined && addrLng !== undefined && addrLat !== null && addrLng !== null && !isNaN(Number(addrLat))) {
                              dispatch(checkLocationAndCalculateDistances({
                                restaurantsList: restaurants,
                                customCoords: { latitude: Number(addrLat), longitude: Number(addrLng) }
                              }));
                            } else {
                              // Backup: use Kurnool center default coordinates
                              dispatch(checkLocationAndCalculateDistances({
                                restaurantsList: restaurants,
                                customCoords: { latitude: 15.8281, longitude: 78.0373 }
                              }));
                            }
                          }}
                        >
                          <Feather name={tagLabel === 'Home' ? 'home' : tagLabel === 'Office' ? 'briefcase' : 'map-pin'} size={20} color={isSelected ? '#2B783E' : '#1E3545'} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: isSelected ? '#2B783E' : '#1E3545' }}>
                              {tagLabel}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#808C94' }} numberOfLines={1}>
                              {addrFlat}{addrStreet}
                            </Text>
                          </View>
                          {isSelected && <Feather name="check" size={18} color="#2B783E" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })()}
            </ScrollView>

            {/* Option C: Skip & Browse */}
            <TouchableOpacity
              style={[styles.secondaryButton, { width: '100%', backgroundColor: 'transparent', borderWidth: 0, marginTop: 0 }]}
              onPress={() => {
                setShowDeliverToModal(false);
                dispatch(setSelectedSavedAddressId(null));
                dispatch(skipLocation());
              }}
            >
              <Text style={[styles.secondaryButtonText, { color: '#000000', textDecorationLine: 'underline' }]}>
                Skip & Browse
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Out of Zone warning Modal */}
      <Modal transparent visible={showOutOfZoneModal} animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: 'transparent' }]}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconContainer, { backgroundColor: '#FDF0ED' }]}>
              <FontAwesome name="exclamation-triangle" size={30} color="#E05A47" />
            </View>
            <Text style={styles.modalTitle}>Service Unavailable</Text>
            <Text style={styles.modalSub}>
              Sorry, we are currently only operational in Kurnool. You appear to be outside our service area.
            </Text>

            <TouchableOpacity style={styles.primaryButton} onPress={() => dispatch(checkLocationAndCalculateDistances(restaurants))}>
              <Text style={styles.primaryButtonText}>Retry Check</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
