import { Feather, FontAwesome, FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTabBar } from '../_layout';
import {
  Alert,
  Animated,
  FlatList,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import { skipLocation } from '../../store/locationSlice';

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
import LoadingView from '../../components/LoadingView';
import { API_URL } from '../../config';
import { fetchRestaurantMenu, pollRestaurantMenu } from '../../store/restaurantsSlice';

const EMPTY_ARRAY = [];

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
  const lastOffsetY = useRef(0);
  const bannerAnimY = useRef(new Animated.Value(0)).current;

  const handleScroll = (event) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    const direction = currentOffset > lastOffsetY.current ? 'down' : 'up';

    if (Math.abs(currentOffset - lastOffsetY.current) > 8) {
      if (direction === 'down' && currentOffset > 40) {
        hideTabBar();
        Animated.spring(bannerAnimY, {
          toValue: 72,
          tension: 160,
          friction: 14,
          useNativeDriver: true,
        }).start();
      } else if (direction === 'up') {
        showTabBar();
        Animated.spring(bannerAnimY, {
          toValue: 0,
          tension: 160,
          friction: 14,
          useNativeDriver: true,
        }).start();
      }
      lastOffsetY.current = currentOffset;
    }
  };

  useFocusEffect(
    useCallback(() => {
      showTabBar();
      Animated.spring(bannerAnimY, {
        toValue: 0,
        tension: 160,
        friction: 14,
        useNativeDriver: true,
      }).start();
    }, [showTabBar, bannerAnimY])
  );

  const [nowTime, setNowTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useDispatch();

  // Route parameters
  const { id: urlId, restId: paramRestId, name: passedName, logoUrl: passedLogoUrl, address: passedAddress, openTime: passedOpenTime, closeTime: passedCloseTime, offerTitle: passedOfferTitle } = useLocalSearchParams();
  const restId = paramRestId || urlId;

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All'); // 'All', 'Veg', 'Non-Veg'
  const [sortBy, setSortBy] = useState('All'); // 'All', 'Low to High', 'High to Low'
  const [cart, setCart] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Custom Replace Cart Modal States
  const [showReplaceCartModal, setShowReplaceCartModal] = useState(false);
  const [pendingItemToAdd, setPendingItemToAdd] = useState(null);
  const [previousRestaurantName, setPreviousRestaurantName] = useState('');

  // Toast state and animated values
  const [toastConfig, setToastConfig] = useState({ visible: false, message: '', type: 'success' });
  const [toastOpacity] = useState(() => new Animated.Value(0));
  const [toastTranslateY] = useState(() => new Animated.Value(30));
  const toastTimeoutRef = useRef(null);

  const triggerToast = (message = 'ADDED TO CART SUCCESSFULLY!', type = 'success') => {
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
    const interval = setInterval(checkActiveOrderStatus, 5000);
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
  const menuItems = useSelector((state) => state.restaurants.menus[restId] || EMPTY_ARRAY);
  const menuLoading = useSelector((state) => state.restaurants.menuLoading[restId] || false);
  const restaurants = useSelector((state) => state.restaurants.list);
  const restaurantDetail = restaurants.find(r => r.restId === restId || r._id === restId);
  const roadDistances = useSelector((state) => state.location.roadDistances);
  const distanceText = roadDistances[restaurantDetail?._id || restaurantDetail?.restId || restId];
  const openTime = restaurantDetail?.openTime || passedOpenTime;
  const closeTime = restaurantDetail?.closeTime || passedCloseTime;
  const offerTitle = restaurantDetail?.offerTitle || passedOfferTitle;
  const isActive = restaurantDetail ? (restaurantDetail.isActive !== false && restaurantDetail.isActive !== 'false' && restaurantDetail.isactive !== false && restaurantDetail.isactive !== 'false' && restaurantDetail.isActive !== 0 && restaurantDetail.isactive !== 0 && restaurantDetail.status !== 'closed' && restaurantDetail.status !== 'INACTIVE') : true;

  // Fetch restaurant menu on mount
  useEffect(() => {
    if (restId) {
      dispatch(fetchRestaurantMenu(restId));
    }
  }, [dispatch, restId]);

  // Background polling for menu items status (every 10 minutes)
  useEffect(() => {
    if (!restId) return;

    const interval = setInterval(() => {
      dispatch(pollRestaurantMenu(restId));
    }, 600000);

    return () => clearInterval(interval);
  }, [dispatch, restId]);

  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  if (initialLoading && menuLoading && menuItems.length === 0) {
    return <LoadingView />;
  }

const isItemAvailable = (item) => {
  if (!item) return false;
  if (item.itemStatus === false || item.itemStatus === 'false' || item.itemStatus === 0) return false;
  if (item.itemtodisplayintherestuarentapp === false || item.itemtodisplayintherestuarentapp === 'false' || item.itemtodisplayintherestuarentapp === 0) return false;
  if (item.status === false || item.status === 'false' || item.status === 'unavailable' || item.status === 'OUT_OF_STOCK' || item.status === 'inactive' || item.status === 0) return false;
  if (item.available === false || item.available === 'false' || item.available === 0) return false;
  if (item.isAvailable === false || item.isAvailable === 'false' || item.isAvailable === 0) return false;
  return true;
};

  // Extract all unique categories from database items
  const categories = useMemo(() => [
    'All',
    ...new Set(
      menuItems
        .map((item) => {
          if (!item.category) return null;
          return item.category.trim().charAt(0).toUpperCase() + item.category.trim().slice(1);
        })
        .filter(Boolean)
    ),
  ], [menuItems]);

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
    return cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, [cart]);

  const cartSubtotal = useMemo(() => {
    if (!cart || cart.length === 0) return 0;
    return cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0);
  }, [cart]);

  const bannerBottom = useMemo(() => {
    return insets.bottom > 0 ? insets.bottom + 94 : (Platform.OS === 'ios' ? 120 : 114);
  }, [insets.bottom]);

  // Memoized filter and sort items for ultra-fast instant filter toggling
  const sortedItems = useMemo(() => {
    if (!menuItems || menuItems.length === 0) return EMPTY_ARRAY;

    const query = searchQuery.trim();
    const hasQuery = Boolean(query);
    const filterAll = filterType === 'All';
    const catAll = selectedCategory === 'All';
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
        // Step 1: Filter by Veg/Non-Veg type first
        if (!filterAll) {
          const itemVegType = (item.vegOrNonVeg || 'Veg').toLowerCase();
          if (filterType === 'Veg' && itemVegType !== 'veg') return false;
          if (filterType === 'Non-Veg' && itemVegType !== 'non-veg') return false;
        }

        // Step 2: Filter by category
        if (!catAll) {
          const itemCat = (item.category || '').toLowerCase();
          if (itemCat !== selectedCatLower) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Priority 1: Available items before out-of-stock items
        const availA = isItemAvailable(a);
        const availB = isItemAvailable(b);

        if (availA && !availB) return -1;
        if (!availA && availB) return 1;

        // Priority 2: Search query matching items at top
        if (hasQuery) {
          const matchA = checkMatch(a);
          const matchB = checkMatch(b);
          if (matchA && !matchB) return -1;
          if (!matchA && matchB) return 1;
        }

        // Priority 3: Price sorting
        if (sortBy === 'Low to High') {
          return (a.price || 0) - (b.price || 0);
        }
        if (sortBy === 'High to Low') {
          return (b.price || 0) - (a.price || 0);
        }
        return 0;
      });
  }, [menuItems, searchQuery, filterType, selectedCategory, sortBy]);

  const handleUpdateQuantity = useCallback(async (item, change) => {
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
        setPendingItemToAdd(item);
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

      if (existingItemIndex > -1) {
        currentCart[existingItemIndex].quantity += change;
        if (currentCart[existingItemIndex].quantity <= 0) {
          currentCart.splice(existingItemIndex, 1);
        }
      } else if (change > 0) {
        currentCart.push({
          ...item,
          quantity: 1,
          restId: restId, // keep track of the restaurant ID
          restaurantName: passedName, // save restaurant name
        });
      }

      setCart(currentCart);
      await AsyncStorage.setItem('cart', JSON.stringify(currentCart));
      if (change > 0) {
        triggerToast();
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
      Alert.alert('Error', 'Failed to update item quantity.');
    }
  }, [hasActiveOrder, restId, passedName, triggerToast]);

  const renderItemCard = useCallback(({ item }) => {
    const available = isItemAvailable(item);
    const isVeg = (item.vegOrNonVeg || 'veg').toLowerCase() === 'veg';
    const suffix = isVeg ? ' (Veg)' : ' (Non-Veg)';
    const fallbackImage = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';

    let displayItemName = item.itemName ? item.itemName.charAt(0).toUpperCase() + item.itemName.slice(1) : 'Food Item';
    if (!displayItemName.toLowerCase().includes('(veg') && !displayItemName.toLowerCase().includes('(non-veg')) {
      displayItemName += suffix;
    }

    const quantity = (
      (item._id && cartMap[String(item._id)]) ||
      (item.itemId && cartMap[String(item.itemId)]) ||
      (item.id && cartMap[String(item.id)]) ||
      0
    );

    const offerPercent = item.offerpercentage ? parseFloat(item.offerpercentage) : 0;
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

        <Image
          source={{ uri: item.photoUrl || fallbackImage }}
          style={[
            styles.itemImage,
            !available && {
              opacity: 0.45,
              ...(Platform.OS === 'web' ? { filter: 'grayscale(100%)' } : {})
            }
          ]}
          resizeMode="cover"
        />

        <Text style={[styles.itemNameText, !available && { color: '#8E8E93' }]} numberOfLines={2}>
          {displayItemName}
        </Text>

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
            onPress={() => triggerToast('THIS ITEM IS CURRENTLY OUT OF STOCK AND CANNOT BE ADDED TO CART', 'warning')}
          >
            <Text style={[styles.addButtonText, { color: '#8E8E93', fontSize: 11 }]}>OUT OF STOCK</Text>
          </TouchableOpacity>
        ) : quantity > 0 ? (
          <View style={styles.quantityContainer}>
            <TouchableOpacity style={styles.quantityBtn} onPress={() => handleUpdateQuantity(item, -1)}>
              <Feather name="minus" size={12} color="#1E3545" />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity style={styles.quantityBtn} onPress={() => handleUpdateQuantity(item, 1)}>
              <Feather name="plus" size={12} color="#1E3545" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addButton} activeOpacity={0.8} onPress={() => handleUpdateQuantity(item, 1)}>
            <Text style={styles.addButtonText}>ADD</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [cartMap, handleUpdateQuantity, triggerToast]);

  // Group sorted items by category for section headings
  const groupedCategories = useMemo(() => {
    if (!sortedItems || sortedItems.length === 0) return EMPTY_ARRAY;

    const groups = [];
    const groupMap = {};

    for (let i = 0; i < sortedItems.length; i++) {
      const item = sortedItems[i];
      const rawCat = item.category ? item.category.trim() : 'Menu';
      const catTitle = rawCat ? (rawCat.charAt(0).toUpperCase() + rawCat.slice(1)) : 'Menu';

      if (!groupMap[catTitle]) {
        groupMap[catTitle] = [];
        groups.push({ title: catTitle, items: groupMap[catTitle] });
      }
      groupMap[catTitle].push(item);
    }

    return groups;
  }, [sortedItems]);

  const renderCategoryGroup = useCallback(({ item: group }) => {
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
            backgroundColor: '#1E3545',
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 16,
            gap: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 3,
          }}>
            <View style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#0F8A65',
            }} />
            <Text style={{
              fontSize: 13,
              fontWeight: '800',
              color: '#FFFFFF',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}>
              {group.title}
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

        {/* 2-Column Cards Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {group.items.map((foodItem) => (
            <React.Fragment key={foodItem._id || foodItem.itemId}>
              {renderItemCard({ item: foodItem })}
            </React.Fragment>
          ))}
          {group.items.length % 2 !== 0 && <View style={{ width: '48%' }} />}
        </View>
      </View>
    );
  }, [renderItemCard]);

  const isWarningToast = toastConfig.type === 'warning';
  const toastBgColor = isWarningToast ? '#D32F2F' : '#008000';
  const toastIconColor = isWarningToast ? '#D32F2F' : '#008000';
  const toastIconName = isWarningToast ? 'alert' : 'checkmark';

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
      {/* Main Content */}
      <FlatList
        data={groupedCategories}
        keyExtractor={(group) => group.title}
        renderItem={renderCategoryGroup}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: cartItemCount > 0 ? bannerBottom + 85 : 110 }]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS !== 'web'}
        ListHeaderComponent={
          <>
            {/* Restaurant Hero Card (redesigned) */}
            <View style={styles.heroCard}>
              <View style={styles.heroInfoCard}>
                <Text style={styles.heroNameText}>{passedName || 'Restaurant'}</Text>
                {passedAddress ? (
                  <Text style={styles.heroAddressText}>{passedAddress}</Text>
                ) : null}
                <View style={styles.heroSpecsRow}>
                  <View style={styles.heroSpecRating}>
                    <FontAwesome name="star" size={11} color="#FFD200" />
                    <Text style={styles.heroSpecText}>
                      {((parseInt(restId || '1') % 5) * 0.1 + 4.1).toFixed(1)}
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
                resizeMode="cover"
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
                />
              </View>

              {/* Filtering Pills */}
              <View style={styles.filterPillContainer}>
                {/* All segment */}
                <TouchableOpacity
                  style={[styles.filterButton, filterType === 'All' && styles.filterButtonActive]}
                  activeOpacity={0.7}
                  onPress={() => setFilterType('All')}
                >
                  <Text style={[
                    styles.allButtonText,
                    filterType !== 'All' && { color: '#666666' }
                  ]}>All</Text>
                </TouchableOpacity>

                {/* Veg green square dot segment */}
                <TouchableOpacity
                  style={[styles.filterButton, filterType === 'Veg' && styles.filterButtonActive]}
                  activeOpacity={0.7}
                  onPress={() => setFilterType('Veg')}
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

                {/* Non-veg red square dot segment */}
                <TouchableOpacity
                  style={[styles.filterButton, filterType === 'Non-Veg' && styles.filterButtonActive]}
                  activeOpacity={0.7}
                  onPress={() => setFilterType('Non-Veg')}
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
                onPress={() => setSortBy('All')}
                activeOpacity={0.7}
              >
                <Text style={sortBy === 'All' ? styles.sortButtonTextActive : styles.sortButtonText}>All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={sortBy === 'Low to High' ? styles.sortButtonActive : styles.sortButton}
                onPress={() => setSortBy('Low to High')}
                activeOpacity={0.7}
              >
                <Text style={sortBy === 'Low to High' ? styles.sortButtonTextActive : styles.sortButtonText}>Low Price to High Price</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={sortBy === 'High to Low' ? styles.sortButtonActive : styles.sortButton}
                onPress={() => setSortBy('High to Low')}
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

      {/* Category Drawer Sidebar */}
      <View style={[styles.drawerContainer, isSidebarOpen ? styles.drawerOpen : styles.drawerClosed]}>
        {/* Header: FIND OUT */}
        <View style={styles.drawerHeaderContainer}>
          <Text style={styles.drawerHeaderTitle}>FIND OUT</Text>
          <View style={styles.drawerHeaderUnderline} />

          <TouchableOpacity
            style={styles.drawerCloseButton}
            onPress={() => setIsSidebarOpen(false)}
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
                onPress={() => {
                  setSelectedCategory(cat);
                  setIsSidebarOpen(false); // Close sidebar after selecting category
                }}
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
        <TouchableOpacity
          style={styles.categoriesTabHandle}
          onPress={() => setIsSidebarOpen(!isSidebarOpen)}
          activeOpacity={0.85}
        >
          <View style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 6,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.25,
            shadowRadius: 2,
            elevation: 3,
          }}>
            <Ionicons
              name={isSidebarOpen ? "close" : "restaurant-outline"}
              size={14}
              color="#1E3545"
            />
          </View>
          <Text style={styles.categoriesTabHandleText}>
            {"C\nA\nT\nE\nG\nO\nR\nI\nE\nS"}
          </Text>
          <Feather
            name={isSidebarOpen ? "chevron-right" : "chevron-left"}
            size={14}
            color="#FFFFFF"
            style={{ marginTop: 6 }}
          />
        </TouchableOpacity>
      </View>

      {/* Toast Notification Banner */}
      {toastConfig.visible && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              bottom: cartItemCount > 0 ? bannerBottom + 65 : 100,
              opacity: toastOpacity,
              transform: [{ translateY: Animated.add(toastTranslateY, bannerAnimY) }],
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

      {/* Fixed Green Cart Banner */}
      {cartItemCount > 0 && (
        <Animated.View
          style={[
            styles.fixedCartBanner,
            {
              bottom: bannerBottom,
              transform: [{ translateY: bannerAnimY }],
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
                <Feather name="shopping-bag" size={18} color="#27AE60" />
              </View>
              <View>
                <Text style={styles.cartBannerTitle}>
                  {cartItemCount} {cartItemCount === 1 ? 'ITEM' : 'ITEMS'} ADDED
                </Text>
              </View>
            </View>

            <View style={styles.cartBannerRight}>
              <Text style={styles.cartBannerBtnText}>View Cart</Text>
              <Feather name="arrow-right" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
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
                      const newCart = [{
                        ...pendingItemToAdd,
                        quantity: 1,
                        restId: restId,
                        restaurantName: passedName,
                      }];
                      setCart(newCart);
                      await AsyncStorage.setItem('cart', JSON.stringify(newCart));
                      triggerToast();
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E3545',
    marginBottom: 6,
  },
  heroAddressText: {
    fontSize: 14,
    color: '#6C7A84',
    marginBottom: 12,
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
  },
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#FFFFFF',
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
    borderRadius: 20,
    width: '48%',
    marginTop: 45, // space for the absolute positioned circular image
    paddingTop: 50, // push texts below the overlaying image
    paddingHorizontal: 12,
    paddingBottom: 18, // Move button closer to bottom edge
    alignItems: 'center',
    position: 'relative',
    minHeight: 195, // Maintain stable taller height
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgb(247, 247, 235)', // white circle frame to pop from page background
    position: 'absolute',
    top: -40,
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
    height: 36, // Exact same fixed height as addButton
    paddingHorizontal: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginTop: 10, // Push button down from price
  },
  quantityBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3545',
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 220,
    backgroundColor: 'rgb(247, 247, 235)',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: -3, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#E8E2D4',
  },
  drawerOpen: {
    right: 0,
  },
  drawerClosed: {
    right: -220,
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
  categoriesTabHandle: {
    position: 'absolute',
    left: -42,
    top: '30%',
    width: 42,
    backgroundColor: '#1E3545',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E3545',
    shadowOffset: { width: -4, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRightWidth: 0,
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
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastContent: {
    backgroundColor: '#008000',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    width: '100%',
  },
  toastIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
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
  fixedCartBanner: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 105 : 100,
    left: 16,
    right: 16,
    backgroundColor: '#27AE60',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 9998,
  },
  cartBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartBannerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cartBannerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E8F5E9',
    marginTop: 1,
  },
  cartBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  cartBannerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
