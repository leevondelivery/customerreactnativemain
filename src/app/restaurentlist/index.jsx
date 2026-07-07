import { Feather, FontAwesome, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import LoadingView from '../../components/LoadingView';
import { API_URL } from '../../config';
import { fetchRestaurants, updateRestaurantStatuses } from '../../store/restaurantsSlice';
import { useTabBar } from '../_layout';
import { styles } from './restaurentlist.styles';


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

export default function RestaurantListScreen() {
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
        address: item.address || ''
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
    if (!initialLoaded) {
      console.log('[RestaurantList] initialLoaded is false, dispatching fetchRestaurants.');
      dispatch(fetchRestaurants());
    }
  }, [dispatch, initialLoaded]);

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

              // Filter by Veg/Non-Veg
              const restType = item.vegOrNonVeg || 'Both';
              if (activeType === 'Veg') {
                if (restType !== 'Veg') return false;
              }
              if (activeType === 'Non-Veg') {
                if (restType !== 'Non-Veg') return false;
              }

              // Filter by selected category (case-insensitive checks)
              if (selectedCategory) {
                const normalSelected = selectedCategory.toLowerCase().trim();
                const hasCategory = item.categories && item.categories.some(
                  c => {
                    const normalC = c.toLowerCase().trim();
                    return normalC.includes(normalSelected) || normalSelected.includes(normalC);
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

                  {/* Address Location */}
                  {item.address ? (
                    <View style={styles.locationContainer}>
                      <FontAwesome name="map-marker" size={14} color={isActive ? "#E05A47" : "#707070"} />
                      <Text style={[styles.locationText, !isActive && { color: '#7E8A81' }]}>{item.address}</Text>
                    </View>
                  ) : null}
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
    </View>
  );
}
