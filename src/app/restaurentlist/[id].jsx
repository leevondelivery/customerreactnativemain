import { Feather, FontAwesome, FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import LoadingView from '../../components/LoadingView';
import { API_URL } from '../../config';
import { fetchRestaurantMenu, pollRestaurantMenu } from '../../store/restaurantsSlice';

const EMPTY_ARRAY = [];

export default function RestaurantMenuScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useDispatch();

  // Route parameters
  const { restId, name: passedName, logoUrl: passedLogoUrl, address: passedAddress } = useLocalSearchParams();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All'); // 'All', 'Veg', 'Non-Veg'
  const [sortBy, setSortBy] = useState('All'); // 'All', 'Low to High', 'High to Low'
  const [cart, setCart] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

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
        setHasActiveOrder(true);
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

  if (menuLoading && menuItems.length === 0) {
    return <LoadingView />;
  }

  // Extract all unique categories from database items
  const categories = [
    'All',
    ...new Set(
      menuItems
        .map((item) => {
          if (!item.category) return null;
          return item.category.trim().charAt(0).toUpperCase() + item.category.trim().slice(1);
        })
        .filter(Boolean)
    ),
  ];

  // Filter and sort items
  const sortedItems = menuItems
    .filter((item) => {
      // Only display items marked for the customer app
      const matchesDisplay = item.itemStatus !== false && item.itemtodisplayintherestuarentapp !== false;
      if (!matchesDisplay) return false;

      // Filter by search query
      const name = item.itemName ? item.itemName.toLowerCase() : '';
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = name.includes(query);

      // Filter by type
      const itemVegType = item.vegOrNonVeg || 'Veg'; // default fallback
      const matchesType =
        filterType === 'All' ||
        (filterType === 'Veg' && itemVegType.toLowerCase() === 'veg') ||
        (filterType === 'Non-Veg' && itemVegType.toLowerCase() === 'non-veg');

      // Filter by category (case-insensitive)
      const matchesCategory =
        selectedCategory === 'All' ||
        (item.category && item.category.toLowerCase() === selectedCategory.toLowerCase());

      return matchesSearch && matchesType && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'Low to High') {
        return (a.price || 0) - (b.price || 0);
      }
      if (sortBy === 'High to Low') {
        return (b.price || 0) - (a.price || 0);
      }
      return 0;
    });

  const handleUpdateQuantity = async (item, change) => {
    if (change > 0 && hasActiveOrder) {
      triggerToast('PLEASE WAIT UNTIL THE ACTIVE ORDER IS DELIVERED', 'warning');
      return;
    }
    try {
      const cartData = await AsyncStorage.getItem('cart');
      let currentCart = cartData ? JSON.parse(cartData) : [];

      const existingItemIndex = currentCart.findIndex(
        (cartItem) => (cartItem.itemId && cartItem.itemId === item.itemId) || (cartItem._id && cartItem._id === item._id)
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
  };

  const renderItemCard = ({ item }) => {
    const isVeg = (item.vegOrNonVeg || 'veg').toLowerCase() === 'veg';
    const suffix = isVeg ? ' (Veg)' : ' (Non-Veg)';
    const fallbackImage = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';

    let displayItemName = item.itemName ? item.itemName.charAt(0).toUpperCase() + item.itemName.slice(1) : 'Food Item';
    if (!displayItemName.toLowerCase().includes('(veg') && !displayItemName.toLowerCase().includes('(non-veg')) {
      displayItemName += suffix;
    }

    const cartItem = cart.find((c) => (c.itemId && c.itemId === item.itemId) || (c._id && c._id === item._id));
    const quantity = cartItem ? cartItem.quantity : 0;

    return (
      <View style={styles.itemCard}>
        <Image
          source={{ uri: item.photoUrl || fallbackImage }}
          style={styles.itemImage}
          resizeMode="cover"
        />

        <Text style={styles.itemNameText} numberOfLines={2}>
          {displayItemName}
        </Text>

        <View style={styles.itemRatingContainer}>
          <FontAwesome name="star" size={10} color="#FFD200" />
          <Text style={styles.itemRatingText}>
            {item.rating ? Number(item.rating).toFixed(1) : '4.2'}
          </Text>
        </View>

        <Text style={styles.priceText}>RS:{item.price || 0}</Text>

        {quantity > 0 ? (
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
  };

  const isWarningToast = toastConfig.type === 'warning';
  const toastBgColor = isWarningToast ? '#D32F2F' : '#008000';
  const toastIconColor = isWarningToast ? '#D32F2F' : '#008000';
  const toastIconName = isWarningToast ? 'alert' : 'checkmark';

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
      {/* Main Content */}
      <FlatList
        data={sortedItems}
        keyExtractor={(item) => item._id || item.itemId}
        renderItem={renderItemCard}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
                />
              </View>

              {/* Filtering Pills */}
              <View style={styles.filterPillContainer}>
                <TouchableOpacity
                  style={filterType === 'All' ? styles.allButtonActive : styles.filterIconWrapper}
                  activeOpacity={0.7}
                  onPress={() => setFilterType('All')}
                >
                  <Text style={[
                    styles.allButtonText,
                    filterType !== 'All' && { color: '#808C94' }
                  ]}>All</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={filterType === 'Veg' ? styles.allButtonActive : styles.filterIconWrapper}
                  activeOpacity={0.7}
                  onPress={() => setFilterType('Veg')}
                >
                  <FontAwesome5 name="leaf" size={14} color="#5EC48D" solid={filterType === 'Veg'} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={filterType === 'Non-Veg' ? styles.allButtonActive : styles.filterIconWrapper}
                  activeOpacity={0.7}
                  onPress={() => setFilterType('Non-Veg')}
                >
                  <FontAwesome5 name="drumstick-bite" size={13} color="#FA4D56" />
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

        {/* Categories floating handle tab (attached to the right edge of sidebar) */}
        <TouchableOpacity
          style={styles.categoriesTabHandle}
          onPress={() => setIsSidebarOpen(!isSidebarOpen)}
          activeOpacity={0.9}
        >
          <Feather
            name={isSidebarOpen ? "chevron-left" : "chevron-right"}
            size={16}
            color="#FFFFFF"
            style={{ marginBottom: 4 }}
          />
          <Text style={styles.categoriesTabHandleText}>
            {"C\nA\nT\nE\nG\nO\nR\nI\nE\nS"}
          </Text>
        </TouchableOpacity>
      </View>

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
    backgroundColor: 'rgb(224, 214, 188)', // Matching restaurentlist card background
    borderRadius: 24,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: 16,
    justifyContent: 'space-between',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  searchPlaceholderText: {
    fontSize: 15,
    color: '#1E3545',
    flex: 1,
    marginLeft: 4,
    outlineStyle: 'none',
  },
  filterPillContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    gap: 16,
    paddingHorizontal: 12,
  },
  filterIconWrapper: {
    paddingHorizontal: 2,
  },
  allButtonActive: {
    backgroundColor: '#FFFFFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  allButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
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
    paddingBottom: 31, // Increased bottom padding to 31 for taller card height
    alignItems: 'center',
    position: 'relative',
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
    marginBottom: 6,
  },
  itemRatingText: {
    fontSize: 11,
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
    shadowOffset: { width: 3, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderRightWidth: 1,
    borderRightColor: '#E8E2D4',
  },
  drawerOpen: {
    left: 0,
  },
  drawerClosed: {
    left: -220,
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
    right: 16,
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
    right: -36,
    top: '30%',
    width: 36,
    backgroundColor: '#333333',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    paddingVertical: 10, // Shrunken vertical padding for shorter tab height
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
  },
  categoriesTabHandleText: {
    fontSize: 9, // Shrunken font size for more compact height
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 11, // Shrunken line height
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
});
