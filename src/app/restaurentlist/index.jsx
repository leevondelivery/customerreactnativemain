import { Feather, FontAwesome, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  ActivityIndicator,
  Linking,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import LoadingView from '../../components/LoadingView';
import { API_URL } from '../../config';
import { fetchRestaurants, updateRestaurantStatuses } from '../../store/restaurantsSlice';
import { checkLocationAndCalculateDistances, skipLocation, setSelectedSavedAddressId } from '../../store/locationSlice';
import { useTabBar } from '../_layout';
import { styles } from '../../styles/restaurentlist.styles';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';


const { width: screenWidth } = Dimensions.get('window');
const CAROUSEL_WIDTH = Math.min(screenWidth, 500) - 32;

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

export default function RestaurantListScreen() {
  const [nowTime, setNowTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showTabBar, hideTabBar } = useTabBar();
  const lastOffsetY = useRef(0);
  const flatListRef = useRef(null);

  const dispatch = useDispatch();
  const restaurants = useSelector((state) => state.restaurants.list);
  const carouselItems = useSelector((state) => state.restaurants.carousel || []);
  const categories = useSelector((state) => state.restaurants.categories || []);
  const initialLoaded = useSelector((state) => state.restaurants.initialLoaded);
  const reduxLoading = useSelector((state) => state.restaurants.loading);

  // Redux Selectors for Global Location State
  const {
    userLocation,
    roadDistances,
    locationStatus,
    showLocationModal,
    showFetchingModal,
    showOutOfZoneModal,
    locationError,
    selectedSavedAddressId,
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
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [showDeliverToModal, setShowDeliverToModal] = useState(false);

  useEffect(() => {
    const initLocationFlow = async () => {
      if (restaurants.length === 0) return;
      
      const uid = await AsyncStorage.getItem('userid');
      setUserid(uid);
      
      // If user has an active order, skip location prompts entirely
      if (uid) {
        try {
          const response = await fetch(`${API_URL}/orderstatus/user/${uid}`);
          const data = await response.json();
          if (response.ok && data.success && data.orderStatus) {
            console.log('[RestaurantList] Active order exists, skipping location checking.');
            dispatch(skipLocation());
            return;
          }
        } catch (err) {
          console.warn('[RestaurantList] Error checking active order status:', err);
        }
      }
      
      if (locationStatus === 'idle') {
        if (uid) {
          try {
            // Load cached addresses first
            const cached = await AsyncStorage.getItem(`saved_addresses_${uid}`);
            if (cached) {
              const addresses = JSON.parse(cached);
              if (addresses.length > 0) {
                setSavedAddresses(addresses);
                setShowDeliverToModal(true);
                // Refresh background cache
                fetch(`${API_URL}/user/${uid}/addresses`)
                  .then(res => res.json())
                  .then(async (data) => {
                    if (data.success && data.addresses) {
                      setSavedAddresses(data.addresses);
                      await AsyncStorage.setItem(`saved_addresses_${uid}`, JSON.stringify(data.addresses));
                    }
                  })
                  .catch(e => console.warn(e));
                return;
              }
            }

            const response = await fetch(`${API_URL}/user/${uid}/addresses`);
            const data = await response.json();
            if (data.success && data.addresses) {
              setSavedAddresses(data.addresses);
              await AsyncStorage.setItem(`saved_addresses_${uid}`, JSON.stringify(data.addresses));
              if (data.addresses.length > 0) {
                setShowDeliverToModal(true);
                return;
              }
            }
          } catch (err) {
            console.warn('[RestaurantList] Error loading addresses on startup:', err);
          }
        }
        // Guest user or user with no saved addresses: default to live GPS check
        dispatch(checkLocationAndCalculateDistances(restaurants));
      } else if (uid) {
        // Try cached first, then background update
        try {
          const cached = await AsyncStorage.getItem(`saved_addresses_${uid}`);
          if (cached) {
            setSavedAddresses(JSON.parse(cached));
          }
          fetch(`${API_URL}/user/${uid}/addresses`)
            .then(res => res.json())
            .then(async (data) => {
              if (data.success && data.addresses) {
                setSavedAddresses(data.addresses);
                await AsyncStorage.setItem(`saved_addresses_${uid}`, JSON.stringify(data.addresses));
              }
            })
            .catch(e => console.warn(e));
        } catch (err) {
          console.warn('[RestaurantList] Error loading cached addresses:', err);
        }
      }
    };
    
    initLocationFlow();
  }, [restaurants, locationStatus, dispatch]);

  useFocusEffect(
    useCallback(() => {
      const loadAddresses = async () => {
        const uid = await AsyncStorage.getItem('userid');
        if (uid) {
          try {
            // Load cached addresses first
            const cached = await AsyncStorage.getItem(`saved_addresses_${uid}`);
            if (cached) {
              setSavedAddresses(JSON.parse(cached));
            }

            const response = await fetch(`${API_URL}/user/${uid}/addresses`);
            const data = await response.json();
            if (data.success && data.addresses) {
              setSavedAddresses(data.addresses);
              await AsyncStorage.setItem(`saved_addresses_${uid}`, JSON.stringify(data.addresses));
            }
          } catch (err) {
            console.warn('[RestaurantList] Error loading addresses on focus:', err);
          }
        }
      };
      loadAddresses();
    }, [])
  );

  const handlePressRestaurant = (item, displayName) => {
    const isActive = item.isActive !== false && item.isactive !== false;
    if (!isActive) {
      triggerToast('THIS RESTAURANT IS CURRENTLY CLOSED!', 'warning');
      return;
    }
    router.push({
      pathname: `/restaurentlist/${item._id || item.restId}`,
      params: {
        restId: item.restId,
        name: displayName,
        logoUrl: item.logoUrl || '',
        address: item.address || '',
        openTime: item.openTime || '',
        closeTime: item.closeTime || ''
      }
    });
  };

  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeType, setActiveType] = useState('All'); // 'All', 'Veg', 'Non-Veg'
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Toast state and animated values
  const [toastConfig, setToastConfig] = useState({ visible: false, message: '', type: 'success' });
  const [toastOpacity] = useState(() => new Animated.Value(0));
  const [toastTranslateY] = useState(() => new Animated.Value(30));
  const toastTimeoutRef = useRef(null);

  const triggerToast = (message, type = 'success') => {
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
  };

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
    const direction = currentOffset > lastOffsetY.current ? 'down' : 'up';

    if (Math.abs(currentOffset - lastOffsetY.current) > 15) {
      if (direction === 'down' && currentOffset > 60) {
        hideTabBar();
      } else if (direction === 'up') {
        showTabBar();
      }
      lastOffsetY.current = currentOffset;
    }
  };

  // Fetch initial data on mount
  useEffect(() => {
    console.log(`[RestaurantList] Screen focused/mounted. initialLoaded: ${initialLoaded}, reduxLoading: ${reduxLoading}`);
    if (!initialLoaded && !reduxLoading) {
      console.log('[RestaurantList] initialLoaded is false and not loading, dispatching fetchRestaurants.');
      dispatch(fetchRestaurants());
    }
  }, [dispatch, initialLoaded, reduxLoading]);

  // Background Polling for Restaurant active status updates (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const restRes = await fetch(`${API_URL}/restaurants`);
        const restData = await restRes.json();
        if (restRes.ok && restData.success) {
          dispatch(updateRestaurantStatuses(restData.restaurants || []));
        }
      } catch (error) {
        console.error('[RestaurantList] Background polling error:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
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

  // Carousel Auto-Scroll Logic
  useEffect(() => {
    if (carouselItems.length === 0) return;

    const interval = setInterval(() => {
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

  if (loading) {
    return <LoadingView />;
  }

  const isWarningToast = toastConfig.type === 'warning';
  const toastBgColor = isWarningToast ? '#D32F2F' : '#008000';
  const toastIconColor = isWarningToast ? '#D32F2F' : '#008000';
  const toastIconName = isWarningToast ? 'alert' : 'checkmark';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#E05A47" />
        }
      >
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
            gap: 10
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
                  const selectedAddr = savedAddresses.find(
                    (a) => (a.id || a._id) === selectedSavedAddressId
                  );
                  if (selectedAddr) {
                    return `${selectedAddr.tag || selectedAddr.label || 'Saved Address'} - ${selectedAddr.flatNo || ''}, ${selectedAddr.street || ''}`;
                  }
                }
                if (locationStatus === 'inside') {
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
              renderItem={({ item }) => (
                <View style={[styles.carouselSlide, { width: CAROUSEL_WIDTH }]}>
                  <CarouselImage
                    uri={item.imageUrl}
                    style={styles.carouselImage}
                  />
                  {/* Render text overlay ONLY if title or tag exists in MongoDB item */}
                  {(item.tag || item.title) && (
                    <View style={styles.carouselOverlay}>
                      {item.tag ? <Text style={styles.carouselTag}>{item.tag}</Text> : null}
                      {item.title ? <Text style={styles.carouselTitle}>{item.title}</Text> : null}
                    </View>
                  )}
                </View>
              )}
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
              placeholder="Search for restaur"
              placeholderTextColor="#808C94"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
            />

          </View>

          <View style={styles.filterPillContainer}>
            {/* All segment */}
            <TouchableOpacity
              style={activeType === 'All' ? styles.allButtonActive : styles.filterIconWrapper}
              activeOpacity={0.7}
              onPress={() => setActiveType('All')}
            >
              <Text style={[
                styles.allButtonText,
                activeType !== 'All' && { color: '#808C94' }
              ]}>All</Text>
            </TouchableOpacity>

            {/* Veg leaf segment */}
            <TouchableOpacity
              style={activeType === 'Veg' ? styles.allButtonActive : styles.filterIconWrapper}
              activeOpacity={0.7}
              onPress={() => setActiveType('Veg')}
            >
              <FontAwesome5 name="leaf" size={16} color="#5EC48D" solid />
            </TouchableOpacity>

            {/* Non-veg segment */}
            <TouchableOpacity
              style={activeType === 'Non-Veg' ? styles.allButtonActive : styles.filterIconWrapper}
              activeOpacity={0.7}
              onPress={() => setActiveType('Non-Veg')}
            >
              <FontAwesome5 name="drumstick-bite" size={15} color="#FA4D56" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Horizontal Category Filter List */}
        {categories.length > 0 && (
          <View style={styles.categoriesContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesScroll}
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
                      setSelectedCategory(isSelected ? null : cat.name);
                    }}
                  >
                    <Image
                      source={{ uri: cat.imageUrl }}
                      style={[styles.categoryImage, isSelected && styles.categoryImageActive]}
                      contentFit="cover"
                      onError={(e) => console.log(`[Category Image Error] Failed to load "${cat.name}" from ${cat.imageUrl}:`, e.nativeEvent.error)}
                    />
                    <View style={[styles.categoryOverlay, isSelected && styles.categoryOverlayActive]}>
                      <Text style={styles.categoryText}>{cat.name}</Text>
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
          </View>
        )}

        {/* Restaurant Cards */}
        {(() => {
          const filteredList = (Array.isArray(restaurants) ? restaurants : [])
            .filter((item) => {
              // Filter by search query
              const nameField = (item.name || item.email || '').toLowerCase();
              const query = searchQuery.trim().toLowerCase();
              const matchesSearch = nameField.startsWith(query);
              if (!matchesSearch) return false;

              // Filter by Veg/Non-Veg (Veg shows only Veg, Non-Veg shows Non-Veg and Both)
              const restType = item.vegOrNonVeg || 'Both';
              if (activeType === 'Veg') {
                if (restType !== 'Veg') return false;
              }
              if (activeType === 'Non-Veg') {
                if (restType !== 'Non-Veg' && restType !== 'Both') return false;
              }

              // Filter by selected category (case-insensitive and plural/singular tolerant checks)
              if (selectedCategory) {
                const normalSelected = selectedCategory.toLowerCase().trim();
                const singularSelected = normalSelected.endsWith('s') ? normalSelected.slice(0, -1) : normalSelected;

                const hasCategory = item.categories && item.categories.some(
                  c => {
                    if (!c || typeof c !== 'string') return false;
                    const normalC = c.toLowerCase().trim();
                    const singularC = normalC.endsWith('s') ? normalC.slice(0, -1) : normalC;

                    return (
                      normalC.includes(normalSelected) ||
                      normalSelected.includes(normalC) ||
                      normalC.includes(singularSelected) ||
                      normalSelected.includes(singularC) ||
                      singularC.includes(singularSelected) ||
                      singularSelected.includes(singularC)
                    );
                  }
                );
                if (!hasCategory) return false;
              }

              return true;
            })
            .sort((a, b) => {
              const aActive = a.isActive !== false && a.isactive !== false;
              const bActive = b.isActive !== false && b.isactive !== false;
              if (aActive && !bActive) return -1;
              if (!aActive && bActive) return 1;
              return 0;
            });

          console.log(`[RestaurantList Filter] selectedCategory: "${selectedCategory}", activeType: "${activeType}", total restaurants: ${restaurants?.length}, filtered: ${filteredList.length}`);

          return filteredList.map((item) => {
            // Retrieve isactive/isActive from DB (default to true if not specified)
            const isActive = item.isActive !== false && item.isactive !== false;

            // Default fallback image if logoUrl is not present
            const baseUri = item.logoUrl || 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=500';

            // Apply true CDN-level grayscale desaturation for native Android/iOS bundles if inactive
            const imageUri = isActive
              ? baseUri
              : `https://wsrv.nl/?url=${encodeURIComponent(baseUri)}&filt=greyscale`;

            // Display name if available, otherwise fallback to capitalized email
            const rawName = item.name || item.email || 'Restaurant';
            const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

            return (
              <TouchableOpacity
                key={item._id || item.restId}
                style={[
                  styles.restaurantCard,
                  !isActive && { backgroundColor: '#E4E1D8' } // slightly grayer background to look desaturated
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

                  {/* Rating badge overlay */}
                  <View style={[styles.ratingBadge, { backgroundColor: isActive ? '#2B783E' : '#707070' }]}>
                    <FontAwesome name="star" size={10} color="#FFD200" />
                    <Text style={styles.ratingText}>
                      {((parseInt(item.restId || '1') % 5) * 0.1 + 4.1).toFixed(1)}
                    </Text>
                  </View>
                </View>

                <View style={styles.restaurantInfo}>
                  {/* Restaurant Name / Email & Offer Badge (aligned to right side) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={[styles.restaurantName, !isActive && { color: '#606060' }, { marginBottom: 0, flex: 1, marginRight: 8 }]} numberOfLines={1}>{displayName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {(() => {
                        const closingSoonText = isActive ? getClosingSoonStatus(item.closeTime, nowTime) : null;
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

                  {/* Address Location & Distance */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    {item.address ? (
                      <View style={[styles.locationContainer, { flex: 1, marginRight: 8, marginBottom: 0 }]}>
                        <FontAwesome name="map-marker" size={14} color={isActive ? "#E05A47" : "#707070"} />
                        <Text style={[styles.locationText, !isActive && { color: '#7E8A81' }, { flexShrink: 1 }]} numberOfLines={1}>{item.address}</Text>
                      </View>
                    ) : null}
                    
                    {roadDistances[item._id || item.restId] ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <FontAwesome5 name="motorcycle" size={12} color={isActive ? "#2B783E" : "#707070"} />
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: isActive ? '#1E3545' : '#707070' }}>
                          {roadDistances[item._id || item.restId]}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        })()}
      </ScrollView>

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
        <View style={[styles.modalOverlay, { backgroundColor: 'transparent' }]}>
          <View style={styles.modalContent}>
            <ActivityIndicator size="large" color="#1a1a1a" style={{ marginBottom: 16 }} />
            <Text style={styles.modalTitle}>Fetching Location</Text>
            <Text style={styles.modalSub}>
              Retrieving your coordinates and calculating delivery distances...
            </Text>
          </View>
        </View>
      </Modal>

      {/* GPS Off / Permission Denied Modal */}
      <Modal transparent visible={showLocationModal} animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: 'transparent' }]}>
          <View style={[styles.modalContent, { maxHeight: '80%', backgroundColor: 'rgb(224, 214, 188)' }]}>
            <View style={[styles.modalIconContainer, { backgroundColor: '#FDF0ED' }]}>
              <FontAwesome name="map-marker" size={30} color="#E05A47" />
            </View>
            <Text style={styles.modalTitle}>Location Access Required</Text>
            <Text style={styles.modalSub}>
              {locationError || "Please turn on your device's location/GPS and allow permission to calculate delivery distance."}
            </Text>
            
            <TouchableOpacity style={styles.primaryButton} onPress={handleEnableLocation}>
              <Text style={styles.primaryButtonText}>Enable Location</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleOpenSettings}>
              <Text style={styles.secondaryButtonText}>Open Settings</Text>
            </TouchableOpacity>



            <TouchableOpacity 
              style={[styles.secondaryButton, { marginTop: 10, backgroundColor: 'transparent', borderWidth: 0 }]} 
              onPress={() => dispatch(skipLocation())}
            >
              <Text style={[styles.secondaryButtonText, { color: '#000000', textDecorationLine: 'underline' }]}>Skip & Browse</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Deliver To Selector Modal */}
      <Modal transparent visible={showDeliverToModal} animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: 'transparent' }]}>
          <View style={[styles.modalContent, { maxHeight: '80%', backgroundColor: 'rgb(224, 214, 188)' }]}>
            <View style={[styles.modalIconContainer, { backgroundColor: '#F0F6F0' }]}>
              <Feather name="map-pin" size={30} color="#2B783E" />
            </View>
            <Text style={styles.modalTitle}>Select Delivery Location</Text>
            <Text style={[styles.modalSub, { marginBottom: 20 }]}>
              Please choose where you would like your food delivered:
            </Text>

            <ScrollView style={{ width: '100%', maxHeight: 310, marginBottom: 15 }} showsVerticalScrollIndicator={false}>
              {/* Option A: Current Location */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  backgroundColor: '#FFF',
                  borderColor: '#E4E1D8',
                  borderWidth: 1,
                  borderRadius: 12,
                  marginBottom: 12,
                  gap: 12
                }}
                activeOpacity={0.8}
                onPress={() => {
                  setShowDeliverToModal(false);
                  dispatch(setSelectedSavedAddressId(null));
                  dispatch(checkLocationAndCalculateDistances(restaurants));
                }}
              >
                <Feather name="navigation" size={20} color="#2B783E" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1E3545' }}>Use Current Location</Text>
                  <Text style={{ fontSize: 11, color: '#808C94' }}>{"Locate me using my device's GPS"}</Text>
                </View>
              </TouchableOpacity>

              {/* Option B: Saved Addresses list */}
              {savedAddresses.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: '#000000', fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Saved Addresses
                  </Text>
                  {savedAddresses.map((addr) => {
                    const isSelected = selectedSavedAddressId === (addr.id || addr._id);
                    return (
                      <TouchableOpacity
                        key={addr._id || addr.id}
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
                          const addrId = addr.id || addr._id;
                          dispatch(setSelectedSavedAddressId(addrId));
                          const addrLat = addr.lat !== undefined ? addr.lat : addr.latitude;
                          const addrLng = addr.lng !== undefined ? addr.lng : addr.longitude;
                          if (addrLat !== undefined && addrLng !== undefined && addrLat !== null && addrLng !== null) {
                            dispatch(checkLocationAndCalculateDistances({
                              restaurantsList: restaurants,
                              customCoords: { latitude: Number(addrLat), longitude: Number(addrLng) }
                            }));
                          } else {
                            // Backup: if saved address has no coordinates, query GPS
                            dispatch(checkLocationAndCalculateDistances(restaurants));
                          }
                        }}
                      >
                        <Feather name={addr.tag === 'Home' ? 'home' : addr.tag === 'Office' ? 'briefcase' : 'map-pin'} size={20} color={isSelected ? '#2B783E' : '#1E3545'} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: isSelected ? '#2B783E' : '#1E3545' }}>
                            {addr.tag || addr.label || 'Address'}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#808C94' }} numberOfLines={1}>
                            {addr.flatNo ? `${addr.flatNo}, ` : ''}{addr.street || ''}
                          </Text>
                        </View>
                        {isSelected && <Feather name="check" size={18} color="#2B783E" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
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
