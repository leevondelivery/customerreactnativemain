import { Feather, FontAwesome, FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTabBar } from '../_layout';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  LayoutAnimation,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import LoadingView from '../../components/LoadingView';
import BogoCelebration from '../../components/BogoCelebration';
import { API_URL } from '../../config';
import { skipLocation } from '../../store/locationSlice';
import { fetchRestaurantMenu, pollRestaurantMenu } from '../../store/restaurantsSlice';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
    // Singular variant if query word ends with 's' and length > 3 (e.g. 'fries' -> 'frie')
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

const EMPTY_ARRAY = [];
const memoryOffersCache = new Map();

const isItemAvailable = (item) => {
  if (!item) return false;
  if (item.itemStatus === false || item.itemStatus === 'false' || item.itemStatus === 0) return false;
  if (item.itemtodisplayintherestuarentapp === false || item.itemtodisplayintherestuarentapp === 'false' || item.itemtodisplayintherestuarentapp === 0) return false;
  if (item.status === false || item.status === 'false' || item.status === 'unavailable' || item.status === 'OUT_OF_STOCK' || item.status === 'inactive' || item.status === 0) return false;
  if (item.available === false || item.available === 'false' || item.available === 0) return false;
  if (item.isAvailable === false || item.isAvailable === 'false' || item.isAvailable === 0) return false;
  return true;
};

function AnimatedCardWrapper({ children, style }) {
  return (
    <View style={style}>
      {children}
    </View>
  );
}

// High-performance memoized item card for instant 60fps filter switching & smooth rendering
const ItemCard = React.memo(function ItemCard({ item, quantity, onUpdateQuantity, onTriggerToast, isBogo, bogoOffer, categoryDiscountPercent }) {
  const available = isItemAvailable(item);
  const isVeg = (item.vegOrNonVeg || 'veg').toLowerCase() === 'veg';
  const fallbackImage = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';

  let rawItemName = (item.itemName || item.name || 'Food Item').trim();
  let displayItemName = rawItemName.replace(/\s*\((?:veg|non-veg|non veg)\)/gi, '').trim();
  displayItemName = displayItemName ? displayItemName.charAt(0).toUpperCase() + displayItemName.slice(1) : 'Food Item';

  const directOffer = item.offerpercentage ? parseFloat(item.offerpercentage) : 0;
  const catOffer = categoryDiscountPercent ? parseFloat(categoryDiscountPercent) : 0;
  const offerPercent = Math.max(directOffer, catOffer);
  const hasOffer = offerPercent > 0 && offerPercent <= 100;
  const offerPrice = hasOffer ? (item.price - (item.price * (offerPercent / 100))) : item.price;

  return (
    <View style={[
      styles.itemCard,
      !available && {
        opacity: 0.7,
        backgroundColor: '#F2F2F7',
        borderColor: '#D1D1D6',
      }
    ]}>
      {/* Out of Stock Top Overlay Badge */}
      {!available && (
        <View style={{
          position: 'absolute',
          top: 8,
          left: 8,
          backgroundColor: 'rgba(50, 50, 50, 0.85)',
          paddingHorizontal: 7,
          paddingVertical: 3,
          borderRadius: 4,
          zIndex: 10,
        }}>
          <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700', letterSpacing: 0.4 }}>
            OUT OF STOCK
          </Text>
        </View>
      )}

      {/* 1+1 BOGO Top Right Badge */}
      {isBogo && available && (() => {
        const isCrossItem = bogoOffer?.type === 'item' && bogoOffer?.targetItemName && bogoOffer.targetItemName.toLowerCase() !== (item.name || item.itemName || '').toLowerCase();
        const badgeLabel = isCrossItem ? `+1 FREE ${bogoOffer.targetItemName}` : '1+1 FREE';
        return (
          <View style={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: '#008000',
            paddingHorizontal: 7,
            paddingVertical: 3,
            borderRadius: 6,
            zIndex: 10,
            maxWidth: '65%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2,
            shadowRadius: 2,
            elevation: 2,
          }}>
            <Text style={{ color: '#FFFFFF', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3 }} numberOfLines={1}>
              {badgeLabel}
            </Text>
          </View>
        );
      })()}

      <Image
        source={{ uri: item.photoUrl || fallbackImage }}
        style={[
          styles.itemImage,
          !available && {
            opacity: 0.45,
            ...(Platform.OS === 'web' ? { filter: 'grayscale(100%)' } : {})
          }
        ]}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={100}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginVertical: 4, paddingHorizontal: 4, minHeight: 38 }}>
        <Text style={[styles.itemNameText, { marginVertical: 0, minHeight: 0, flexShrink: 1 }, !available && { color: '#8E8E93' }]} numberOfLines={2}>
          {displayItemName}
        </Text>

        {/* Official Veg (Green) / Non-Veg (Red) Symbol placed after the name */}
        <View style={{
          width: 13,
          height: 13,
          borderWidth: 1.5,
          borderColor: isVeg ? '#0F8A65' : '#D32F2F',
          borderRadius: 3,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          flexShrink: 0,
        }}>
          <View style={{
            width: 5.5,
            height: 5.5,
            borderRadius: 2.75,
            backgroundColor: isVeg ? '#0F8A65' : '#D32F2F',
          }} />
        </View>
      </View>

      <View style={styles.ratingAndOfferContainer}>
        <View style={[styles.itemRatingContainer, !available && { backgroundColor: '#E5E5EA' }]}>
          <FontAwesome name="star" size={10} color={available ? "#FFD200" : "#8E8E93"} />
          <Text style={[styles.itemRatingText, !available && { color: '#8E8E93' }]}>
            {item.rating ? Number(item.rating).toFixed(1) : '4.2'}
          </Text>
        </View>
        {hasOffer && (
          <View style={[styles.offerBadge, !available && { backgroundColor: '#8E8E93' }]}>
            <Ionicons name="pricetag" size={9} color="#FFFFFF" />
            <Text style={styles.offerBadgeText}>{offerPercent}% OFF</Text>
          </View>
        )}
      </View>

      {hasOffer ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Text style={[styles.priceText, { marginBottom: 0 }, !available && { color: '#8E8E93' }]}>RS:{Math.round(offerPrice)}</Text>
          <Text style={[styles.priceText, { textDecorationLine: 'line-through', textDecorationColor: available ? '#FF5E00' : '#8E8E93', color: available ? '#FF5E00' : '#8E8E93', fontSize: 12, marginBottom: 0 }]}>RS:{item.price || 0}</Text>
        </View>
      ) : (
        <Text style={[styles.priceText, !available && { color: '#8E8E93' }]}>RS:{item.price || 0}</Text>
      )}

      {!available ? (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: '#E5E5EA', borderColor: '#D1D1D6' }]}
          activeOpacity={0.8}
          onPress={() => onTriggerToast('THIS ITEM IS CURRENTLY OUT OF STOCK AND CANNOT BE ADDED TO CART', 'warning')}
        >
          <Text style={[styles.addButtonText, { color: '#8E8E93', fontSize: 11 }]}>OUT OF STOCK</Text>
        </TouchableOpacity>
      ) : quantity > 0 ? (
        <View style={styles.quantityContainer}>
          <TouchableOpacity style={styles.quantityBtn} activeOpacity={0.7} onPress={() => onUpdateQuantity(item, -1, isBogo, bogoOffer)}>
            <Feather name="minus" size={17} color="#1E3545" />
          </TouchableOpacity>
          <Text style={styles.quantityText}>
            {(() => {
              const isCrossItem = bogoOffer?.type === 'item' && bogoOffer?.targetItemName && bogoOffer.targetItemName.toLowerCase() !== (item.name || item.itemName || '').toLowerCase();
              return isCrossItem ? quantity : (isBogo ? (quantity * 2) : quantity);
            })()}
          </Text>
          <TouchableOpacity style={styles.quantityBtn} activeOpacity={0.7} onPress={() => onUpdateQuantity(item, 1, isBogo, bogoOffer)}>
            <Feather name="plus" size={17} color="#1E3545" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.addButton} activeOpacity={0.8} onPress={() => onUpdateQuantity(item, 1, isBogo, bogoOffer)}>
          <Text style={styles.addButtonText}>ADD</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

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

export default function RestaurantMenuScreen() {

  const { showTabBar, hideTabBar } = useTabBar();
  const flatListRef = useRef(null);
  const lastOffsetY = useRef(0);
  const isBannerHidden = useRef(false);
  const [bannerAnimY] = useState(() => new Animated.Value(0));

  const handleScroll = (event) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    const diff = currentOffset - lastOffsetY.current;

    if (Math.abs(diff) > 8) {
      if (diff > 0 && currentOffset > 30) {
        if (!isBannerHidden.current) {
          isBannerHidden.current = true;
          hideTabBar();
          Animated.timing(bannerAnimY, {
            toValue: 80,
            duration: 130,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
      } else if (diff < 0) {
        if (isBannerHidden.current) {
          isBannerHidden.current = false;
          showTabBar();
          Animated.timing(bannerAnimY, {
            toValue: 0,
            duration: 130,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
      }
      lastOffsetY.current = currentOffset;
    }
  };

  useFocusEffect(
    useCallback(() => {
      isBannerHidden.current = false;
      showTabBar();
      Animated.timing(bannerAnimY, {
        toValue: 0,
        duration: 130,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, [showTabBar, bannerAnimY])
  );

  const [nowTime, setNowTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useDispatch();

  // Route parameters
  const { id: urlId, restId: paramRestId, name: passedName, logoUrl: passedLogoUrl, address: passedAddress, openTime: passedOpenTime, closeTime: passedCloseTime, offerTitle: passedOfferTitle, rating: passedRating } = useLocalSearchParams();
  const restId = paramRestId || urlId;

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All'); // 'All', 'Veg', 'Non-Veg'
  const [sortBy, setSortBy] = useState('All'); // 'All', 'Low to High', 'High to Low'
  const [cart, setCart] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Animated values for filter pills (sliding indicator + button scale micro-animations)
  const [filterTranslateX] = useState(() => new Animated.Value(0));
  const [allScale] = useState(() => new Animated.Value(1));
  const [vegScale] = useState(() => new Animated.Value(1));
  const [nonVegScale] = useState(() => new Animated.Value(1));

  // Animated values for smooth Category Drawer & Tab Handle
  const [sidebarAnim] = useState(() => new Animated.Value(0)); // 0: closed, 1: open
  const [tabHandleScale] = useState(() => new Animated.Value(1));

  const chevronRotate = sidebarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const animateSidebar = (open) => {
    setIsSidebarOpen(open);
    Animated.spring(sidebarAnim, {
      toValue: open ? 1 : 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  };

  const handleSelectCategoryFromDrawer = (cat) => {
    setSelectedCategory(cat);
    animateSidebar(false);

    if (isBannerHidden.current) {
      isBannerHidden.current = false;
      showTabBar();
      Animated.timing(bannerAnimY, {
        toValue: 0,
        duration: 130,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  };

  const animateButtonPress = (scaleAnim) => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.93,
        duration: 70,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 260,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleFilterTypeChange = useCallback((type) => {
    if (filterType === type) return;

    let targetX = 0;
    if (type === 'Veg') targetX = 42;
    else if (type === 'Non-Veg') targetX = 84;

    Animated.spring(filterTranslateX, {
      toValue: targetX,
      tension: 260,
      friction: 22,
      useNativeDriver: true,
    }).start();

    setFilterType(type);
  }, [filterType, filterTranslateX]);

  const handleSortByChange = useCallback((sortOption) => {
    if (sortBy === sortOption) return;
    setSortBy(sortOption);
  }, [sortBy]);

  // Custom Replace Cart Modal States
  const [showReplaceCartModal, setShowReplaceCartModal] = useState(false);
  const [pendingItemToAdd, setPendingItemToAdd] = useState(null);
  const [previousRestaurantName, setPreviousRestaurantName] = useState('');

  // 1+1 BOGO Celebration Animation State
  const [celebrationState, setCelebrationState] = useState({ visible: false, offerDetails: null });

  // Toast state and animated values (smooth spring entrance & pulse on repeat clicks)
  const [toastConfig, setToastConfig] = useState({ message: 'ADDED TO CART SUCCESSFULLY!', type: 'success' });
  const [toastOpacity] = useState(() => new Animated.Value(0));
  const [toastTranslateY] = useState(() => new Animated.Value(18));
  const [toastScale] = useState(() => new Animated.Value(0.96));
  const toastTimeoutRef = useRef(null);
  const isToastActiveRef = useRef(false);

  // Smooth entrance and exit animation for fixed cart banner
  const [cartBannerAnim] = useState(() => new Animated.Value(0));

  const triggerToast = useCallback((message = 'ADDED TO CART SUCCESSFULLY!', type = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToastConfig({ message, type });

    if (isToastActiveRef.current) {
      // Gentle micro-lift if toast is already active on screen
      Animated.sequence([
        Animated.timing(toastTranslateY, {
          toValue: -6,
          duration: 100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(toastTranslateY, {
          toValue: 0,
          friction: 8,
          tension: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      isToastActiveRef.current = true;
      toastOpacity.setValue(0);
      toastTranslateY.setValue(18);
      toastScale.setValue(0.96);

      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: 0,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(toastScale, {
          toValue: 1,
          friction: 8,
          tension: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }

    toastTimeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: 12,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(toastScale, {
          toValue: 0.96,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        isToastActiveRef.current = false;
      });
    }, type === 'warning' ? 2800 : 2000);
  }, [toastOpacity, toastTranslateY, toastScale]);

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

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Active order state and checker
  const [hasActiveOrder, setHasActiveOrder] = useState(false);

  const checkActiveOrderStatus = async () => {
    try {
      const userid = await AsyncStorage.getItem('userid');
      if (!userid) {
        setHasActiveOrder(false);
        return;
      }
      const response = await fetch(`${API_URL}/orderstatus/user/${userid}`);
      const data = await response.json();
      if (response.ok && data.success && data.orderStatus) {
        const sStr = (data.orderStatus.status || data.orderStatus.orderStatus || '').toLowerCase().trim();
        const isRej = sStr.includes('reject') || sStr.includes('cancel') || sStr.includes('declin') || sStr.includes('failed');
        setHasActiveOrder(!isRej);
      } else {
        setHasActiveOrder(false);
      }
    } catch (error) {
      console.warn('[RestaurantMenu] Error checking active order status:', error);
      setHasActiveOrder(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(checkActiveOrderStatus, 20000);
    return () => clearInterval(interval);
  }, []);

  // Load cart from AsyncStorage on focus/mount
  const loadCart = async () => {
    try {
      const cartData = await AsyncStorage.getItem('cart');
      if (cartData) {
        setCart(JSON.parse(cartData));
      } else {
        setCart([]);
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCart();
      checkActiveOrderStatus();
    }, [])
  );

  // Redux store
  const restaurants = useSelector((state) => state.restaurants.list || EMPTY_ARRAY);
  const restaurantDetail = restaurants.find(r => 
    (restId && (r.restId === restId || r._id === restId)) ||
    (paramRestId && (r.restId === paramRestId || r._id === paramRestId)) ||
    (urlId && (r.restId === urlId || r._id === urlId))
  );

  const menuItems = useSelector((state) => {
    const menus = state.restaurants?.menus || {};
    return (
      (restId && menus[restId]?.length ? menus[restId] : null) ||
      (paramRestId && menus[paramRestId]?.length ? menus[paramRestId] : null) ||
      (urlId && menus[urlId]?.length ? menus[urlId] : null) ||
      (restaurantDetail?.restId && menus[restaurantDetail.restId]?.length ? menus[restaurantDetail.restId] : null) ||
      (restaurantDetail?._id && menus[restaurantDetail._id]?.length ? menus[restaurantDetail._id] : null) ||
      EMPTY_ARRAY
    );
  });

  const menuLoading = useSelector((state) => {
    const ml = state.restaurants?.menuLoading || {};
    return Boolean(
      (restId && ml[restId]) ||
      (paramRestId && ml[paramRestId]) ||
      (urlId && ml[urlId]) ||
      (restaurantDetail?.restId && ml[restaurantDetail.restId]) ||
      (restaurantDetail?._id && ml[restaurantDetail._id])
    );
  });

  const roadDistances = useSelector((state) => state.location.roadDistances);
  const distanceText = roadDistances[restaurantDetail?._id || restaurantDetail?.restId || restId];
  const displayAddress = passedAddress || restaurantDetail?.address || '';
  const openTime = restaurantDetail?.openTime || passedOpenTime;
  const closeTime = restaurantDetail?.closeTime || passedCloseTime;
  const offerTitle = restaurantDetail?.offerTitle || passedOfferTitle;
  const isActive = restaurantDetail ? (restaurantDetail.isActive !== false && restaurantDetail.isActive !== 'false' && restaurantDetail.isactive !== false && restaurantDetail.isactive !== 'false' && restaurantDetail.isActive !== 0 && restaurantDetail.isactive !== 0 && restaurantDetail.status !== 'closed' && restaurantDetail.status !== 'INACTIVE') : true;

  const targetId = restId || paramRestId || urlId || restaurantDetail?.restId || restaurantDetail?._id;

  const reduxOffers = useSelector((state) => {
    const offersMap = state.restaurants?.offers || {};
    return (
      (restId && offersMap[String(restId)]) ||
      (paramRestId && offersMap[String(paramRestId)]) ||
      (urlId && offersMap[String(urlId)]) ||
      (restaurantDetail?.restId && offersMap[String(restaurantDetail.restId)]) ||
      (restaurantDetail?._id && offersMap[String(restaurantDetail._id)]) ||
      null
    );
  });

  const [localOffers, setLocalOffers] = useState(() => {
    return (
      (targetId && memoryOffersCache.get(String(targetId))) ||
      (restId && memoryOffersCache.get(String(restId))) ||
      (restaurantDetail?.restId && memoryOffersCache.get(String(restaurantDetail.restId))) ||
      (restaurantDetail?._id && memoryOffersCache.get(String(restaurantDetail._id))) ||
      null
    );
  });

  const restaurantOffers = localOffers || reduxOffers || (targetId ? memoryOffersCache.get(String(targetId)) : null) || null;

  const [hasMenuFetched, setHasMenuFetched] = useState(false);
  const [hasOffersFetched, setHasOffersFetched] = useState(() => {
    return Boolean(
      (targetId && memoryOffersCache.has(String(targetId))) ||
      (restId && memoryOffersCache.has(String(restId))) ||
      (restaurantDetail?.restId && memoryOffersCache.has(String(restaurantDetail.restId))) ||
      (restaurantDetail?._id && memoryOffersCache.has(String(restaurantDetail._id))) ||
      reduxOffers
    );
  });
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (targetId) {
      if (!hasFetchedRef.current || menuItems.length === 0) {
        hasFetchedRef.current = true;
        dispatch(fetchRestaurantMenu(targetId)).finally(() => {
          setHasMenuFetched(true);
        });
      }
    }
  }, [dispatch, targetId, restaurantDetail, menuItems.length]);

  useFocusEffect(
    useCallback(() => {
      loadCart();
      checkActiveOrderStatus();
      if (targetId && menuItems.length === 0) {
        dispatch(fetchRestaurantMenu(targetId)).finally(() => {
          setHasMenuFetched(true);
        });
      }
    }, [dispatch, targetId, menuItems.length])
  );

  // Restaurant Offers (1+1 BOGO deals, Category % Discounts, Tiered Bill Discounts)
  useEffect(() => {
    let isSubscribed = true;
    const fetchOffers = async () => {
      const candidateIds = [
        restId,
        paramRestId,
        urlId,
        restaurantDetail?.restId,
        restaurantDetail?._id
      ].filter(Boolean).map(String).filter((id, idx, arr) => arr.indexOf(id) === idx);

      if (candidateIds.length === 0) {
        if (isSubscribed) setHasOffersFetched(true);
        return;
      }

      for (const id of candidateIds) {
        try {
          const res = await fetch(`${API_URL}/api/offers/restaurant/${id}?t=${Date.now()}`, {
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
          });
          const data = await res.json();
          if (data && data.success && data.data && isSubscribed) {
            candidateIds.forEach((cId) => memoryOffersCache.set(cId, data.data));
            const currentStr = JSON.stringify(localOffers || reduxOffers || null);
            const newStr = JSON.stringify(data.data);
            if (currentStr !== newStr) {
              setLocalOffers(data.data);
            }
            break;
          }
        } catch (err) {}
      }
      if (isSubscribed) {
        setHasOffersFetched(true);
      }
    };

    fetchOffers();
    return () => {
      isSubscribed = false;
    };
  }, [restId, paramRestId, urlId, restaurantDetail?._id, restaurantDetail?.restId]);

  // Zero-flicker loading gate:
  // Requires both menu items and offers to be resolved before mounting the UI
  // This guarantees the menu never mounts without 1+1 offers and then shifts after fetching
  const isMenuReady = (menuItems.length > 0 && !menuLoading) || hasMenuFetched;
  const isOffersReady = Boolean(restaurantOffers) || hasOffersFetched;
  const loading = !isMenuReady || !isOffersReady;

  // Background polling for menu items status (every 10 minutes)
  useEffect(() => {
    if (!restId) return;

    const interval = setInterval(() => {
      dispatch(pollRestaurantMenu(restId));
    }, 600000);

    return () => clearInterval(interval);
  }, [dispatch, restId]);

  const getBogoOffer = useCallback((foodItem, categoryTitle) => {
    if (!restaurantOffers?.bogoOffers || !restaurantOffers.bogoOffers.length) return null;
    const itemId = String(foodItem?._id || foodItem?.itemId || foodItem?.id || '').trim();
    const itemName = String(foodItem?.itemName || foodItem?.name || '').trim().toLowerCase();
    const itemCat = String(foodItem?.category || categoryTitle || '').trim().toLowerCase();

    // 1. Check for item-wise 1+1 rule first
    const itemMatch = restaurantOffers.bogoOffers.find((b) => {
      if (b.isActive === false) return false;
      if (b.type === 'item') {
        const srcId = String(b.sourceItemId || '').trim();
        const srcName = String(b.sourceItemName || '').trim().toLowerCase();
        const matchId = Boolean(srcId && itemId && srcId === itemId);
        const matchName = Boolean(
          srcName && itemName &&
          (srcName === itemName || (itemName.length > 2 && itemName.includes(srcName)) || (srcName.length > 2 && srcName.includes(itemName)))
        );
        return matchId || matchName;
      }
      return false;
    });
    if (itemMatch) return itemMatch;

    // 2. Check for category-wise 1+1 rule
    const catMatch = restaurantOffers.bogoOffers.find((b) => {
      if (b.isActive === false) return false;
      if (!b.type || b.type === 'category') {
        const srcCat = String(b.sourceCategory || '').trim().toLowerCase();
        return Boolean(
          srcCat && itemCat &&
          (srcCat === itemCat || (itemCat.length > 2 && itemCat.includes(srcCat)) || (srcCat.length > 2 && srcCat.includes(itemCat)))
        );
      }
      return false;
    });
    return catMatch || null;
  }, [restaurantOffers]);

  const checkIsBogo = useCallback((foodItem, categoryTitle) => {
    return Boolean(getBogoOffer(foodItem, categoryTitle));
  }, [getBogoOffer]);

  const getCategoryDiscountPercent = useCallback((foodItem, categoryTitle) => {
    if (!restaurantOffers?.categoryDiscounts || !restaurantOffers.categoryDiscounts.length) return 0;
    const itemCat = String(foodItem?.category || categoryTitle || '').trim().toLowerCase();
    const match = restaurantOffers.categoryDiscounts.find((d) => {
      if (d.isActive === false) return false;
      const targetCat = String(d.category || '').trim().toLowerCase();
      return targetCat && (targetCat === itemCat || itemCat.includes(targetCat) || targetCat.includes(itemCat));
    });
    return match ? Number(match.discountPercentage || 0) : 0;
  }, [restaurantOffers]);

  const getItemDiscountPercent = useCallback((foodItem, categoryTitle) => {
    if (!foodItem) return 0;
    const directOffer = foodItem.offerpercentage ? parseFloat(foodItem.offerpercentage) : (foodItem.offerPercentage ? parseFloat(foodItem.offerPercentage) : 0);
    const catOffer = getCategoryDiscountPercent(foodItem, categoryTitle || foodItem.category);
    return Math.max(isNaN(directOffer) ? 0 : directOffer, isNaN(catOffer) ? 0 : catOffer);
  }, [getCategoryDiscountPercent]);

  // Extract all unique categories from database items, with 1+1 and Discount Offers at the top
  const categories = useMemo(() => {
    const hasBogo = Boolean(
      restaurantOffers?.bogoOffers?.length > 0 &&
      menuItems.some((item) => checkIsBogo(item, item.category))
    );

    const hasDiscounts = Boolean(
      menuItems.some((item) => getItemDiscountPercent(item, item.category) > 0)
    );

    const baseCategories = [
      ...new Set(
        menuItems
          .map((item) => {
            if (!item.category) return null;
            return item.category.trim().charAt(0).toUpperCase() + item.category.trim().slice(1);
          })
          .filter(Boolean)
      ),
    ];

    const result = ['All'];
    if (hasBogo) {
      result.push('1+1 Free');
    }
    if (hasDiscounts) {
      result.push('Discount Offers');
    }
    result.push(...baseCategories);
    return result;
  }, [menuItems, restaurantOffers, checkIsBogo, getItemDiscountPercent]);

  // Fast O(1) cart quantity lookup map
  const cartMap = useMemo(() => {
    const map = {};
    if (!cart || cart.length === 0) return map;
    for (let i = 0; i < cart.length; i++) {
      const c = cart[i];
      if (String(c.restId || '') === String(restId || '')) {
        const qty = c.quantity || 0;
        if (c.itemId) map[String(c.itemId)] = qty;
        if (c._id) map[String(c._id)] = qty;
        if (c.id) map[String(c.id)] = qty;
      }
    }
    return map;
  }, [cart, restId]);

  // Total cart item count and subtotal
  const cartItemCount = useMemo(() => {
    if (!cart || cart.length === 0) return 0;
    return cart.reduce((sum, item) => {
      const isBogo = checkIsBogo(item, item.category);
      const units = isBogo ? (Number(item.quantity) || 0) * 2 : (Number(item.quantity) || 0);
      return sum + units;
    }, 0);
  }, [cart, checkIsBogo]);

  const cartSubtotal = useMemo(() => {
    if (!cart || cart.length === 0) return 0;
    return cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0);
  }, [cart]);

  const bannerBottom = useMemo(() => {
    return insets.bottom > 0 ? insets.bottom + 94 : (Platform.OS === 'ios' ? 120 : 114);
  }, [insets.bottom]);

  useEffect(() => {
    if (cartItemCount > 0) {
      Animated.spring(cartBannerAnim, {
        toValue: 1,
        tension: 180,
        friction: 14,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(cartBannerAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [cartItemCount, cartBannerAnim]);

  // Memoized filter and sort items for ultra-fast instant filter toggling
  const sortedItems = useMemo(() => {
    if (!menuItems || menuItems.length === 0) return EMPTY_ARRAY;

    const query = searchQuery.trim();
    const hasQuery = Boolean(query);
    const filterAll = filterType === 'All';
    const catAll = !selectedCategory || selectedCategory === 'All';
    const selectedCatLower = catAll ? '' : selectedCategory.toLowerCase();

    const checkMatch = (item) => {
      if (!item || !hasQuery) return false;
      const name = item.itemName || item.name || '';
      const cat = item.category || '';
      const desc = item.description || '';
      return (
        isTextMatchingQuery(name, query) ||
        isTextMatchingQuery(cat, query) ||
        (query.length >= 3 && desc.toLowerCase().includes(query.toLowerCase()))
      );
    };

    return menuItems
      .filter((item) => {
        // Step 1: Filter by Veg/Non-Veg type
        if (!filterAll) {
          const itemVegType = (item.vegOrNonVeg || 'Veg').toLowerCase();
          if (filterType === 'Veg' && itemVegType !== 'veg') return false;
          if (filterType === 'Non-Veg' && itemVegType !== 'non-veg') return false;
        }

        // Keep all items so all other categories are shown below
        return true;
      })
      .sort((a, b) => {
        // Priority 1: If a category is selected from drawer, items belonging to it are placed at the top
        if (!catAll) {
          const isBogoCat = selectedCatLower.includes('1+1');
          if (isBogoCat) {
            const bogoA = checkIsBogo(a, a.category);
            const bogoB = checkIsBogo(b, b.category);
            if (bogoA && !bogoB) return -1;
            if (!bogoA && bogoB) return 1;
          } else {
            const catA = (a.category || '').toLowerCase() === selectedCatLower;
            const catB = (b.category || '').toLowerCase() === selectedCatLower;
            if (catA && !catB) return -1;
            if (!catA && catB) return 1;
          }
        }

        // Priority 2: 1+1 BOGO items at the very top
        const bogoA = checkIsBogo(a, a.category);
        const bogoB = checkIsBogo(b, b.category);
        if (bogoA && !bogoB) return -1;
        if (!bogoA && bogoB) return 1;

        // Priority 3: Items with direct or category discount (highest % discount first)
        const discA = getItemDiscountPercent(a, a.category);
        const discB = getItemDiscountPercent(b, b.category);
        if (discA > 0 && discB <= 0) return -1;
        if (discA <= 0 && discB > 0) return 1;
        if (discA > 0 && discB > 0 && discA !== discB) return discB - discA;

        // Priority 4: Available items before out-of-stock items
        const availA = isItemAvailable(a);
        const availB = isItemAvailable(b);
        if (availA && !availB) return -1;
        if (!availA && availB) return 1;

        // Priority 5: Search query matching items at top
        if (hasQuery) {
          const matchA = checkMatch(a);
          const matchB = checkMatch(b);
          if (matchA && !matchB) return -1;
          if (!matchA && matchB) return 1;
        }

        // Priority 6: Price sorting
        if (sortBy === 'Low to High') {
          return (a.price || 0) - (b.price || 0);
        }
        if (sortBy === 'High to Low') {
          return (b.price || 0) - (a.price || 0);
        }
        return 0;
      });
  }, [menuItems, searchQuery, filterType, selectedCategory, sortBy, checkIsBogo, getItemDiscountPercent]);

  const handleUpdateQuantity = useCallback(async (item, change, passedIsBogo, passedBogoOffer) => {
    if (!isItemAvailable(item)) {
      triggerToast('THIS ITEM IS CURRENTLY OUT OF STOCK AND CANNOT BE ADDED TO CART', 'warning');
      return;
    }
    if (change > 0 && hasActiveOrder) {
      triggerToast('PLEASE WAIT UNTIL THE ACTIVE ORDER IS DELIVERED', 'warning');
      return;
    }
    try {
      const cartData = await AsyncStorage.getItem('cart');
      let currentCart = cartData ? JSON.parse(cartData) : [];

      // Check if cart has items from a different restaurant
      const differentRestaurantItem = currentCart.find(
        (cartItem) => cartItem.restId && String(cartItem.restId) !== String(restId)
      );
      if (change > 0 && differentRestaurantItem) {
        setPreviousRestaurantName(differentRestaurantItem.restaurantName || 'another restaurant');
        setPendingItemToAdd({ ...item, isBogo: passedIsBogo, bogoOffer: passedBogoOffer });
        setShowReplaceCartModal(true);
        return;
      }

      const existingItemIndex = currentCart.findIndex(
        (cartItem) => 
          String(cartItem.restId || '') === String(restId || '') &&
          (
            (cartItem.itemId && item.itemId && String(cartItem.itemId) === String(item.itemId)) ||
            (cartItem._id && item._id && String(cartItem._id) === String(item._id)) ||
            (cartItem.id && item.id && String(cartItem.id) === String(item.id))
          )
      );

      const bogoMatch = getBogoOffer(item, item.category);
      const isBogoMatch = Boolean(bogoMatch);

      if (existingItemIndex > -1) {
        currentCart[existingItemIndex].quantity += change;
        if (currentCart[existingItemIndex].quantity <= 0) {
          currentCart.splice(existingItemIndex, 1);
        }
      } else if (change > 0) {
        const catDiscountPercent = getCategoryDiscountPercent(item, item.category);
        currentCart.push({
          ...item,
          quantity: 1,
          isBogo: isBogoMatch,
          bogoOffer: bogoMatch || null,
          categoryDiscountPercent: catDiscountPercent,
          restId: restId, // keep track of the restaurant ID
          restaurantName: passedName, // save restaurant name
        });

        if (isBogoMatch) {
          // Trigger celebration confetti & popup banner ONLY once when item is first added
          setCelebrationState({
            visible: true,
            offerDetails: {
              itemName: item.itemName || item.name || 'Food Item',
              bogoOffer: bogoMatch,
              triggerId: Date.now(),
            },
          });
        }
      }

      setCart(currentCart);
      if (change > 0) {
        triggerToast();
      }
      AsyncStorage.setItem('cart', JSON.stringify(currentCart)).catch((err) => {
        console.error('Error saving cart to storage:', err);
      });
    } catch (error) {
      console.error('Error updating quantity:', error);
      Alert.alert('Error', 'Failed to update item quantity.');
    }
  }, [hasActiveOrder, restId, passedName, triggerToast, getBogoOffer, getCategoryDiscountPercent]);

  // Group sorted items by category with 1+1 BOGO first, then Special Discount Offers next, then regular categories
  const groupedCategories = useMemo(() => {
    if (!sortedItems || sortedItems.length === 0) return EMPTY_ARRAY;

    const groups = [];
    const groupMap = {};

    // 1. Gather all items that have active 1+1 (BOGO) offer
    const bogoItems = [];
    const hasBogoOffers = Boolean(restaurantOffers?.bogoOffers && restaurantOffers.bogoOffers.length > 0);

    if (hasBogoOffers) {
      for (let i = 0; i < sortedItems.length; i++) {
        const item = sortedItems[i];
        if (checkIsBogo(item, item.category)) {
          bogoItems.push(item);
        }
      }
    }

    // If 1+1 offers exist, show dedicated "1+1 Free Offers" section at the TOP
    if (bogoItems.length > 0 && (!selectedCategory || selectedCategory === 'All' || selectedCategory.toLowerCase().includes('1+1'))) {
      groups.push({
        title: '1+1 Free Offers',
        isSpecialOffer: true,
        offerType: 'bogo',
        items: bogoItems,
      });
    }

    // 2. Gather all items that have any direct or category discount
    const discountItems = [];
    for (let i = 0; i < sortedItems.length; i++) {
      const item = sortedItems[i];
      const disc = getItemDiscountPercent(item, item.category);
      if (disc > 0) {
        discountItems.push(item);
      }
    }
    discountItems.sort((a, b) => {
      const discA = getItemDiscountPercent(a, a.category);
      const discB = getItemDiscountPercent(b, b.category);
      if (discA !== discB) return discB - discA;
      const availA = isItemAvailable(a);
      const availB = isItemAvailable(b);
      if (availA && !availB) return -1;
      if (!availA && availB) return 1;
      return 0;
    });

    // If discount items exist, show dedicated "Special Discount Offers" section right after 1+1 (or at top if no 1+1)
    if (discountItems.length > 0 && (!selectedCategory || selectedCategory === 'All' || selectedCategory.toLowerCase().includes('discount') || selectedCategory.toLowerCase().includes('offer'))) {
      groups.push({
        title: 'Special Discount Offers',
        isSpecialOffer: true,
        offerType: 'discount',
        items: discountItems,
      });
    }

    // 3. Populate regular category groups
    for (let i = 0; i < sortedItems.length; i++) {
      const item = sortedItems[i];
      const rawCat = item.category ? item.category.trim() : 'Menu';
      const catTitle = rawCat ? (rawCat.charAt(0).toUpperCase() + rawCat.slice(1)) : 'Menu';

      if (!groupMap[catTitle]) {
        groupMap[catTitle] = [];
        groups.push({ title: catTitle, isSpecialOffer: false, offerType: null, items: groupMap[catTitle] });
      }
      groupMap[catTitle].push(item);
    }

    // Within each regular category group:
    // Rank 1: 1+1 BOGO items
    // Rank 2: Discounted items (highest discount % first)
    // Rank 3: Available items before out-of-stock items
    groups.forEach((g) => {
      if (!g.isSpecialOffer) {
        g.items.sort((a, b) => {
          const bogoA = checkIsBogo(a, a.category);
          const bogoB = checkIsBogo(b, b.category);
          if (bogoA && !bogoB) return -1;
          if (!bogoA && bogoB) return 1;

          const discA = getItemDiscountPercent(a, g.title || a.category);
          const discB = getItemDiscountPercent(b, g.title || b.category);
          if (discA > 0 && discB <= 0) return -1;
          if (discA <= 0 && discB > 0) return 1;
          if (discA > 0 && discB > 0 && discA !== discB) return discB - discA;

          const availA = isItemAvailable(a);
          const availB = isItemAvailable(b);
          if (availA && !availB) return -1;
          if (!availA && availB) return 1;

          return 0;
        });
      }
    });

    // Handle user selected category filter from drawer
    if (selectedCategory && selectedCategory !== 'All') {
      const selCatLower = selectedCategory.toLowerCase().trim();
      groups.sort((a, b) => {
        const isASel = a.title.toLowerCase().trim() === selCatLower ||
          (selCatLower.includes('1+1') && a.offerType === 'bogo') ||
          (selCatLower.includes('discount') && a.offerType === 'discount');
        const isBSel = b.title.toLowerCase().trim() === selCatLower ||
          (selCatLower.includes('1+1') && b.offerType === 'bogo') ||
          (selCatLower.includes('discount') && b.offerType === 'discount');
        if (isASel && !isBSel) return -1;
        if (!isASel && isBSel) return 1;
        return 0;
      });
    }

    return groups;
  }, [sortedItems, selectedCategory, restaurantOffers, checkIsBogo, getItemDiscountPercent]);

  const renderCategoryGroup = useCallback(({ item: group }) => {
    const isBogoGroup = group.offerType === 'bogo';
    const isDiscountGroup = group.offerType === 'discount';
    const bannerBgColor = isBogoGroup ? '#065F46' : (isDiscountGroup ? '#EA580C' : '#1E3545');
    const dividerColor = isBogoGroup ? 'rgba(6, 95, 70, 0.25)' : (isDiscountGroup ? 'rgba(234, 88, 12, 0.25)' : 'rgba(30, 53, 69, 0.15)');
    const bannerTitle = isBogoGroup ? `🎉 ${group.title}` : group.title;

    return (
      <View key={group.title} style={{ marginBottom: 16 }}>
        {/* Premium Category Heading Banner */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 22,
          marginBottom: 14,
          paddingHorizontal: 2,
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: bannerBgColor,
            paddingHorizontal: 12,
            paddingVertical: 4.5,
            borderRadius: 10,
            shadowColor: bannerBgColor,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.12,
            shadowRadius: 3,
            elevation: 2,
          }}>
            <Text style={{
              fontSize: 12,
              fontWeight: '800',
              color: '#FFFFFF',
              letterSpacing: 0.7,
              textTransform: 'uppercase',
            }}>
              {bannerTitle}
            </Text>
          </View>
          <View style={{
            flex: 1,
            height: 1.5,
            backgroundColor: dividerColor,
            marginLeft: 12,
            borderRadius: 1,
          }} />
        </View>

        {/* 2-Column Cards Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {group.items.map((foodItem, idx) => {
            const quantity = (
              (foodItem._id && cartMap[String(foodItem._id)]) ||
              (foodItem.itemId && cartMap[String(foodItem.itemId)]) ||
              (foodItem.id && cartMap[String(foodItem.id)]) ||
              0
            );
            const bogoOffer = getBogoOffer(foodItem, group.title);
            const isBogo = Boolean(bogoOffer);
            const catDiscountPercent = getCategoryDiscountPercent(foodItem, group.title);
            return (
              <AnimatedCardWrapper
                key={`${group.title}_${foodItem._id || foodItem.itemId || foodItem.id || idx}`}
                style={{ width: '48%' }}
              >
                <ItemCard
                  item={foodItem}
                  quantity={quantity}
                  onUpdateQuantity={handleUpdateQuantity}
                  onTriggerToast={triggerToast}
                  isBogo={isBogo}
                  bogoOffer={bogoOffer}
                  categoryDiscountPercent={catDiscountPercent}
                />
              </AnimatedCardWrapper>
            );
          })}
          {group.items.length % 2 !== 0 && <View style={{ width: '48%' }} />}
        </View>
      </View>
    );
  }, [cartMap, handleUpdateQuantity, triggerToast, filterType, selectedCategory, sortBy, searchQuery, getBogoOffer, getCategoryDiscountPercent, restaurantOffers]);

  const isWarningToast = toastConfig.type === 'warning';
  const toastBgColor = isWarningToast ? '#D32F2F' : '#2B783E';
  const toastIconColor = isWarningToast ? '#D32F2F' : '#2B783E';
  const toastIconName = isWarningToast ? 'alert' : 'checkmark';

  if (loading) {
    return <LoadingView />;
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
      {/* Main Content */}
      <FlatList
        ref={flatListRef}
        data={groupedCategories}
        extraData={`${filterType}_${selectedCategory || ''}_${sortBy}_${searchQuery}_${restaurantOffers ? 'offers_loaded' : 'no_offers'}`}
        keyExtractor={(group) => group.title}
        renderItem={renderCategoryGroup}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: cartItemCount > 0 ? bannerBottom + 85 : 110 }]}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={11}
        removeClippedSubviews={false}
        ListHeaderComponent={
          <>
            {/* Restaurant Hero Card (redesigned) */}
            <View style={styles.heroCard}>
              <View style={styles.heroInfoCard}>
                <Text style={styles.heroNameText}>{passedName || restaurantDetail?.name || 'Restaurant'}</Text>
                {displayAddress ? (
                  <View style={styles.heroAddressContainer}>
                    <Ionicons name="location-sharp" size={13} color="#E05A47" style={{ marginTop: 1 }} />
                    <Text style={styles.heroAddressText} numberOfLines={2}>
                      {displayAddress}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.heroSpecsRow}>
                  <View style={styles.heroSpecRating}>
                    <FontAwesome name="star" size={11} color="#FFD200" />
                    <Text style={styles.heroSpecText}>
                      {restaurantDetail?.rating !== undefined && restaurantDetail?.rating !== null && restaurantDetail?.rating !== ''
                        ? Number(restaurantDetail.rating).toFixed(1)
                        : (passedRating && passedRating !== ''
                          ? Number(passedRating).toFixed(1)
                          : ((parseInt(restId || '1') % 5) * 0.1 + 4.1).toFixed(1))}
                    </Text>
                  </View>
                  {distanceText ? (
                    <View style={[styles.heroSpecDistance, { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2B783E' }]}>
                      <FontAwesome5 name="motorcycle" size={11} color="#FFFFFF" />
                      <Text style={styles.heroSpecTextWhite}>{distanceText}</Text>
                    </View>
                  ) : null}
                  {offerTitle && offerTitle !== '0' && offerTitle !== 0 && String(offerTitle).trim() !== '' ? (
                    <View style={{
                      backgroundColor: '#FF6F00',
                      borderRadius: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <Feather name="tag" size={11} color="#FFFFFF" />
                      <Text style={styles.heroSpecTextWhite}>{offerTitle}</Text>
                    </View>
                  ) : null}
                  {/* Closing soon / Opening time highlight badge */}
                  {(() => {
                    if (!isActive) {
                      return (
                        <View style={{
                          backgroundColor: '#DC2626',
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 5,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <Feather name="clock" size={13} color="#FFF" />
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#FFF' }}>
                            {openTime ? `Opens at ${formatTimeAMPM(openTime)}` : 'Currently Closed'}
                          </Text>
                        </View>
                      );
                    }
                    const closingSoonText = getClosingSoonStatus(closeTime, nowTime);
                    if (!closingSoonText) return null;
                    return (
                      <View style={{
                        backgroundColor: '#D9534F',
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <Feather name="alert-circle" size={13} color="#FFF" />
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#FFF' }}>
                          {closingSoonText}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </View>
              <Image
                source={{ uri: passedLogoUrl || 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=500' }}
                style={styles.heroLogo}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={100}
              />
            </View>

            {/* Menu Search and Categories inside search bar */}
            <View style={styles.searchBarContainer}>
              <View style={styles.searchInputContainer}>
                <Feather name="search" size={20} color="#1E3545" />
                <TextInput
                  style={styles.searchPlaceholderText}
                  placeholder="Search by name"
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

              {/* Filtering Pills */}
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
                      handleFilterTypeChange('All');
                    }}
                  >
                    <Text style={[
                      styles.allButtonText,
                      filterType !== 'All' && { color: '#666666' }
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
                      handleFilterTypeChange('Veg');
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
                      backgroundColor: filterType === 'Veg' ? '#E8F5E9' : '#FFF'
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
                      handleFilterTypeChange('Non-Veg');
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
                      backgroundColor: filterType === 'Non-Veg' ? '#FFEBEE' : '#FFF'
                    }}>
                      <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#E53935' }} />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>

            {/* Sorting Scrollbar */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.sortContainer}
              contentContainerStyle={styles.sortContent}
            >
              <TouchableOpacity
                style={sortBy === 'All' ? styles.sortButtonActive : styles.sortButton}
                onPress={() => handleSortByChange('All')}
                activeOpacity={0.7}
              >
                <Text style={sortBy === 'All' ? styles.sortButtonTextActive : styles.sortButtonText}>All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={sortBy === 'Low to High' ? styles.sortButtonActive : styles.sortButton}
                onPress={() => handleSortByChange('Low to High')}
                activeOpacity={0.7}
              >
                <Text style={sortBy === 'Low to High' ? styles.sortButtonTextActive : styles.sortButtonText}>Low Price to High Price</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={sortBy === 'High to Low' ? styles.sortButtonActive : styles.sortButton}
                onPress={() => handleSortByChange('High to Low')}
                activeOpacity={0.7}
              >
                <Text style={sortBy === 'High to Low' ? styles.sortButtonTextActive : styles.sortButtonText}>High Price to Low Price</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Empty Menu State */}
            {!menuLoading && sortedItems.length === 0 && (
              <View style={styles.emptyContainer}>
                <Feather name="coffee" size={48} color="#808C94" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitleText}>No menu items found</Text>
                <Text style={styles.emptySubtitleText}>Try adjusting your search query or filters.</Text>
              </View>
            )}
          </>
        }
      />

      {/* Dimmed Backdrop overlay behind drawer */}
      <Animated.View
        pointerEvents={isSidebarOpen ? 'auto' : 'none'}
        style={[
          styles.drawerBackdrop,
          {
            opacity: sidebarAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.45],
            }),
          },
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => animateSidebar(false)}
        />
      </Animated.View>

      {/* Category Drawer Sidebar */}
      <Animated.View
        style={[
          styles.drawerContainer,
          {
            transform: [
              {
                translateX: sidebarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [240, 0],
                }),
              },
            ],
          },
        ]}
      >
        {/* Header: FIND OUT */}
        <View style={styles.drawerHeaderContainer}>
          <Text style={styles.drawerHeaderTitle}>FIND OUT</Text>
          <View style={styles.drawerHeaderUnderline} />

          <TouchableOpacity
            style={styles.drawerCloseButton}
            onPress={() => animateSidebar(false)}
            activeOpacity={0.7}
          >
            <Feather name="x" size={20} color="#1E3545" />
          </TouchableOpacity>
        </View>

        {/* Categories navigation list */}
        <ScrollView contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryNavItem, isActive && styles.categoryNavItemActive]}
                onPress={() => handleSelectCategoryFromDrawer(cat)}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryNavText, isActive && styles.categoryNavTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Categories floating handle tab (attached to the left edge of right sidebar) */}
        <Animated.View style={[styles.categoriesTabHandleWrapper, { transform: [{ scale: tabHandleScale }] }]}>
          <TouchableOpacity
            style={styles.categoriesTabHandle}
            onPress={() => {
              animateButtonPress(tabHandleScale);
              animateSidebar(!isSidebarOpen);
            }}
            activeOpacity={0.85}
          >
            <View style={styles.categoriesTabHandleIconWrap}>
              <Ionicons
                name={isSidebarOpen ? "close" : "restaurant-outline"}
                size={14}
                color="#1E3545"
              />
            </View>
            <Text style={styles.categoriesTabHandleText}>
              {"C\nA\nT\nE\nG\nO\nR\nI\nE\nS"}
            </Text>
            <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
              <Feather
                name="chevron-left"
                size={14}
                color="#FFFFFF"
                style={{ marginTop: 6 }}
              />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* Toast Notification Banner (Persistent Pre-allocated Native Surface) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toastContainer,
          {
            bottom: bannerBottom + 58,
            opacity: toastOpacity,
            transform: [
              { translateY: bannerAnimY },
              { translateY: toastTranslateY },
              { scale: toastScale },
            ],
          },
        ]}
      >
        <View style={[styles.toastContent, { backgroundColor: toastBgColor }]}>
          <View style={styles.toastIconContainer}>
            <Ionicons name={toastIconName} size={13} color={toastIconColor} />
          </View>
          <Text style={styles.toastText}>{toastConfig.message || 'ADDED TO CART SUCCESSFULLY!'}</Text>
        </View>
      </Animated.View>

      {/* Fixed Green Cart Banner */}
      <Animated.View
        pointerEvents={cartItemCount > 0 && !isSidebarOpen ? 'auto' : 'none'}
        style={[
          styles.fixedCartBannerWrapper,
          {
            bottom: bannerBottom,
            opacity: sidebarAnim.interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [1, 0, 0],
            }),
            transform: [{ translateY: bannerAnimY }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.fixedCartBanner,
            {
              opacity: cartBannerAnim,
              transform: [
                {
                  translateY: cartBannerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
                {
                  scale: cartBannerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
            activeOpacity={0.9}
            onPress={() => router.push('/cart')}
          >
            <View style={styles.cartBannerLeft}>
              <View style={styles.cartBannerIconBadge}>
                <Feather name="shopping-bag" size={14} color="#2B783E" />
              </View>
              <View>
                <Text style={styles.cartBannerTitle}>
                  {cartItemCount} {cartItemCount === 1 ? 'ITEM' : 'ITEMS'} ADDED
                </Text>
              </View>
            </View>

            <View style={styles.cartBannerRight}>
              <Text style={styles.cartBannerBtnText}>View Cart</Text>
              <Feather name="arrow-right" size={13} color="#FFFFFF" style={{ marginLeft: 3 }} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
      {/* Custom Replace Cart Confirmation Modal */}
      <Modal transparent visible={showReplaceCartModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: 'rgb(224, 214, 188)' }]}>
            <View style={[styles.modalIconContainer, { backgroundColor: '#FDF0ED' }]}>
              <Feather name="shopping-cart" size={30} color="#FA4D56" />
            </View>
            <Text style={styles.modalTitle}>Replace Cart Items?</Text>
            <Text style={[styles.modalSub, { color: '#1E3545', fontWeight: '500', marginBottom: 24 }]}>
              Your cart contains items from &quot;{previousRestaurantName}&quot;. Do you want to discard your cart and add items from &quot;{passedName || 'this restaurant'}&quot; instead?
            </Text>
            
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  elevation: 2,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                }}
                activeOpacity={0.8}
                onPress={() => {
                  setShowReplaceCartModal(false);
                  setPendingItemToAdd(null);
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1E3545' }}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: '#1E3545',
                  alignItems: 'center',
                  elevation: 2,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                }}
                activeOpacity={0.85}
                onPress={async () => {
                  if (pendingItemToAdd) {
                    try {
                      const bogoMatch = getBogoOffer(pendingItemToAdd, pendingItemToAdd.category);
                      const isBogoMatch = Boolean(bogoMatch);
                      const catDiscountPercent = getCategoryDiscountPercent(pendingItemToAdd, pendingItemToAdd.category);
                      const newCart = [{
                        ...pendingItemToAdd,
                        quantity: 1,
                        isBogo: isBogoMatch,
                        bogoOffer: bogoMatch || null,
                        categoryDiscountPercent: catDiscountPercent,
                        restId: restId,
                        restaurantName: passedName,
                      }];
                      setCart(newCart);
                      triggerToast();
                      if (isBogoMatch) {
                        setCelebrationState({
                          visible: true,
                          offerDetails: {
                            itemName: pendingItemToAdd.itemName || pendingItemToAdd.name || 'Food Item',
                            bogoOffer: bogoMatch,
                          },
                        });
                      }
                      AsyncStorage.setItem('cart', JSON.stringify(newCart)).catch(err => {
                        console.error('Error saving replaced cart:', err);
                      });
                    } catch (err) {
                      console.error('Error replacing cart:', err);
                    }
                  }
                  setShowReplaceCartModal(false);
                  setPendingItemToAdd(null);
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#FFFFFF' }}>Replace</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 1+1 Free Celebration Confetti & Banner Overlay */}
      <BogoCelebration
        visible={celebrationState.visible}
        offerDetails={celebrationState.offerDetails}
        onDismiss={() => setCelebrationState({ visible: false, offerDetails: null })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgb(247, 247, 235)', // Matching restaurentlist background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D4',
    backgroundColor: 'rgb(247, 247, 235)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8E2D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E3545',
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110, // extra padding so grid scrolls clear of floating tabs
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  heroCard: {
    backgroundColor: 'rgb(224, 214, 188)', // Matching restaurentlist card background
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLogo: {
    width: 90,
    height: 90,
    borderRadius: 20,
    backgroundColor: '#C8BEA7',
  },
  heroInfoCard: {
    backgroundColor: 'rgb(247, 247, 235)',
    borderRadius: 20,
    padding: 16,
    flex: 1,
    marginRight: 16,
  },
  heroNameText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E3545',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  heroAddressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 10,
    marginTop: 1,
    paddingRight: 4,
  },
  heroAddressText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#5A6B78',
    lineHeight: 16,
    flexShrink: 1,
  },
  heroSpecsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroSpecRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2B783E',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  heroSpecDistance: {
    backgroundColor: '#2C3E50',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroSpecText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  heroSpecTextWhite: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  searchBarContainer: {
    backgroundColor: 'rgb(224, 214, 188)',
    borderRadius: 28,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginVertical: 18,
    justifyContent: 'space-between',
    width: '100%',
    alignSelf: 'center',
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    gap: 6,
    height: 40,
    overflow: 'hidden',
  },
  searchPlaceholderText: {
    fontSize: 13,
    color: '#000000',
    flex: 1,
    marginLeft: 2,
    outlineStyle: 'none',
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
    height: 40,
    maxHeight: 40,
    textAlignVertical: 'center',
    includeFontPadding: false,
    alignSelf: 'center',
  },
  filterPillContainer: {
    backgroundColor: 'transparent',
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    gap: 4,
    paddingHorizontal: 4,
    flexShrink: 0,
    position: 'relative',
  },
  filterPillActiveBg: {
    position: 'absolute',
    top: 3,
    left: 4,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
  },
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  filterButtonActive: {
    backgroundColor: 'transparent',
  },
  allButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E3545',
  },
  sortContainer: {
    marginBottom: 16,
  },
  sortContent: {
    gap: 10,
    paddingRight: 16,
  },
  sortButton: {
    backgroundColor: 'rgb(224, 214, 188)', // Matching restaurentlist card background
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgb(204, 194, 168)',
  },
  sortButtonActive: {
    backgroundColor: '#1E3545',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E3545',
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3545',
  },
  sortButtonTextActive: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 65,
  },
  emptyTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3545',
    marginBottom: 4,
  },
  emptySubtitleText: {
    fontSize: 13,
    color: '#808C94',
    textAlign: 'center',
  },
  itemCard: {
    backgroundColor: 'rgb(224, 214, 188)', // Matching restaurentlist card background
    borderRadius: 22,
    width: '100%',
    marginTop: 56, // space for the larger floating circular image
    paddingTop: 58, // push texts below the overlaying image
    paddingHorizontal: 12,
    paddingBottom: 18,
    alignItems: 'center',
    position: 'relative',
    minHeight: 208, // Stable height for larger cards
  },
  itemImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: 'rgb(247, 247, 235)', // white circle frame to pop from page background
    position: 'absolute',
    top: -52,
  },
  itemNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3545',
    textAlign: 'center',
    marginVertical: 4,
    minHeight: 38,
  },
  itemRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2B783E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  itemRatingText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  ratingAndOfferContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  offerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5E00', // Bright orange like the Special Offer sticker
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  offerBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  priceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E3545',
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: 'rgb(247, 247, 235)', // Matching page background
    width: '100%',
    height: 36, // Fixed height to match quantityContainer
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginTop: 10, // Push button down from price
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E3545',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgb(247, 247, 235)', // Matching page background
    width: '100%',
    height: 38, // Exact same fixed height as addButton
    paddingHorizontal: 8,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginTop: 10, // Push button down from price
  },
  quantityBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0EBE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E3545',
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 99990,
    elevation: 20,
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 240,
    backgroundColor: '#F9F9F6',
    zIndex: 100000,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 25,
    borderLeftWidth: 1,
    borderLeftColor: '#E8E2D4',
  },
  drawerHeaderContainer: {
    paddingTop: 50,
    paddingBottom: 15,
    alignItems: 'center',
    position: 'relative',
  },
  drawerHeaderTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A1A',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  drawerHeaderUnderline: {
    height: 3,
    backgroundColor: '#1A1A1A',
    width: 140,
    marginTop: 8,
    alignSelf: 'center',
  },
  drawerCloseButton: {
    position: 'absolute',
    top: 20,
    left: 16,
    padding: 6,
  },
  drawerScrollContent: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  categoryNavItem: {
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryNavItemActive: {
    backgroundColor: '#333333',
    marginVertical: 4,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '85%',
    alignSelf: 'center',
  },
  categoryNavText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  categoryNavTextActive: {
    color: '#FFFFFF',
  },
  categoriesTabHandleWrapper: {
    position: 'absolute',
    left: -44,
    top: '28%',
  },
  categoriesTabHandle: {
    width: 44,
    backgroundColor: '#1E3545',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E3545',
    shadowOffset: { width: -4, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRightWidth: 0,
  },
  categoriesTabHandleIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  categoriesTabHandleText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 12,
    letterSpacing: 0.5,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 110,
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastContent: {
    backgroundColor: '#2B783E',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: '92%',
  },
  toastIconContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E3545',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 14,
    color: '#1E3545',
    textAlign: 'center',
    lineHeight: 20,
  },
  fixedCartBannerWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 900,
  },
  fixedCartBanner: {
    backgroundColor: '#2B783E',
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
    width: '100%',
  },
  cartBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  cartBannerIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cartBannerSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#E8F5E9',
    marginTop: 1,
  },
  cartBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  cartBannerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
