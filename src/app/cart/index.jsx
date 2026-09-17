import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  BackHandler
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import LoadingView from '../../components/LoadingView';
import { API_URL } from '../../config';
import { checkLocationAndCalculateDistances } from '../../store/locationSlice';
// Lazily require Firebase Auth & Firestore to avoid crash when native module is not linked
let auth = null;
let firestore = null;
if (Platform.OS !== 'web') {
  try {
    auth = require('@react-native-firebase/auth').default;
    firestore = require('@react-native-firebase/firestore').default;
  } catch (e) {
    console.warn('[Cart] Firebase Auth/Firestore native module not available:', e.message);
  }
}

// Helper to parse confirmPayButton status from various DB/API response structures
const parseConfirmPayStatus = (data) => {
  if (!data) return null;
  let controlsArr = null;
  if (Array.isArray(data)) controlsArr = data;
  else if (Array.isArray(data.controls)) controlsArr = data.controls;
  else if (Array.isArray(data.data)) controlsArr = data.data;

  if (controlsArr) {
    const item = controlsArr.find(
      (c) =>
        String(c.key || '').toLowerCase() === 'confirmpaybutton' ||
        String(c.name || '').toLowerCase() === 'confirm pay button'
    );
    if (item) {
      if (typeof item.status === 'boolean') return item.status;
      if (typeof item.status === 'string') return item.status !== 'false' && item.status !== '0';
      if (typeof item.status === 'number') return item.status === 1;
      if (typeof item.value === 'boolean') return item.value;
    }
  }

  if (typeof data.confirmPayButton === 'boolean') return data.confirmPayButton;
  if (typeof data.controls === 'object' && typeof data.controls.confirmPayButton === 'boolean') {
    return data.controls.confirmPayButton;
  }
  if (typeof data.status === 'boolean' && (data.key === 'confirmPayButton' || data.name === 'Confirm Pay Button')) {
    return data.status;
  }

  return null;
};

// Razorpay standard script dynamic loader for Web
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }
    if (typeof document === 'undefined') {
      resolve(false);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function CartScreen() {

  // Restaurant Offers (1+1 BOGO, Category % Discounts, Tiered Bill Discounts)
  const [restaurantOffers, setRestaurantOffers] = useState(null);

  useEffect(() => {
    const fetchOffers = async () => {
      const rId = cartItems[0]?.restId || cartItems[0]?.restaurantId || cartItems[0]?.id || '';
      if (!rId) return;
      try {
        const res = await fetch(`${API_URL}/api/offers/restaurant/${rId}`);
        const data = await res.json();
        if (data && data.success && data.data) {
          setRestaurantOffers(data.data);
        }
      } catch (err) {
        console.warn('Error fetching restaurant offers in cart:', err);
      }
    };
    fetchOffers();
  }, [cartItems]);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const userLocation = useSelector((state) => state.location.userLocation);
  const roadDistances = useSelector((state) => state.location.roadDistances);
  const locationStatus = useSelector((state) => state.location.locationStatus);
  const showFetchingModal = useSelector((state) => state.location.showFetchingModal);
  const selectedSavedAddressIdRedux = useSelector((state) => state.location.selectedSavedAddressId);
  const restaurants = useSelector((state) => state.restaurants.list);
  const confirmPayEnabled = useSelector((state) => state.controls.confirmPayEnabled);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (router.canGoBack()) {
          router.back();
        } else if (cartItems && cartItems.length > 0 && (cartItems[0]?.restId || cartItems[0]?.restaurantId)) {
          const rId = cartItems[0].restId || cartItems[0].restaurantId;
          router.replace({
            pathname: `/restaurentlist/${rId}`,
            params: {
              id: rId,
              restId: rId,
              name: cartItems[0].restaurantName || '',
            },
          });
        } else {
          router.replace('/restaurentlist');
        }
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [router, cartItems])
  );
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isGstExpanded, setIsGstExpanded] = useState(false);

  // Address flow states
  const [userid, setUserid] = useState(null);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [flatNo, setFlatNo] = useState('');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [selectedTag, setSelectedTag] = useState('Home'); // Home, Office, Apartment, Other
  const [customTag, setCustomTag] = useState(''); // Custom place name when 'Other' is selected
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState(null);
  const [isSavedAddressesExpanded, setIsSavedAddressesExpanded] = useState(false);
  const [isAddNewAddressExpanded, setIsAddNewAddressExpanded] = useState(false);
  const [customAlert, setCustomAlert] = useState({ visible: false, title: '', message: '', onOk: null });
  const [hasActiveOrder, setHasActiveOrder] = useState(false);
  const [showLocationChoiceModal, setShowLocationChoiceModal] = useState(false);
  const [showPaymentChoiceModal, setShowPaymentChoiceModal] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  // confirmPayEnabled comes from Redux (polled every 5s in _layout.jsx)

  const targetRestId = cartItems[0]?.restId || '';
  const distanceStr = roadDistances[targetRestId] || '';
  const isDistanceCalculated = Boolean(distanceStr) && distanceStr.trim() !== '' && !isNaN(parseFloat(distanceStr));

  // Location & Delivery Charge check: Delivery charge MUST be 100% calculated, flat/street filled, and location verified
  const isLocationVerified = isDistanceCalculated && Boolean(flatNo.trim()) && Boolean(street.trim()) && (selectedSavedAddressId ? true : (locationStatus === 'inside' && Boolean(userLocation)));
  const [feesConfig, setFeesConfig] = useState({
    deliveryFeeBase: 20,
    baseKmThreshold: 3,
    deliveryFeePerKm: 10,
    surgeFee: 0,
    isSurgeActive: false
  });

  // Coupon states
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { couponCode, influencerName, discountType, discountValue, discountAmount }
  const [couponError, setCouponError] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    setIsValidatingCoupon(true);
    setCouponError('');
    try {
      const activeUid = userid || (await AsyncStorage.getItem('userid')) || (await AsyncStorage.getItem('user_id'));
      const activePhone = await AsyncStorage.getItem('phone');
      const response = await fetch(`${API_URL}/api/coupon/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          couponCode: couponInput.trim(),
          cartTotal: calculateTotal(),
          userId: activeUid,
          userPhone: activePhone,
        }),
      });
      const data = await response.json();
      if (data.success) {
        const minOrderRaw =
          data.minOrderAmount ??
          data.minOrderValue ??
          data.minOrder ??
          data.min_order_amount ??
          data.min_order_value ??
          data.minimumOrderValue ??
          data.minimumOrderAmount ??
          data.minPurchase ??
          data.minAmount ??
          data.coupon?.minOrderAmount ??
          data.coupon?.minOrderValue ??
          data.coupon?.minOrder ??
          data.coupon?.min_order_amount ??
          data.coupon?.min_order_value ??
          data.couponDetails?.minOrderValue ??
          data.couponDetails?.minOrderAmount ??
          data.data?.minOrderValue ??
          data.data?.minOrderAmount ??
          0;
        const minOrder = Number(minOrderRaw || 0);

        const currentSub = calculateTotal();
        if (minOrder > 0 && currentSub < minOrder) {
          setCouponError(`Minimum order value of ₹${minOrder} required to apply this coupon.`);
          setAppliedCoupon(null);
          await AsyncStorage.removeItem('applied_coupon');
          return;
        }

        const couponObj = {
          couponCode: data.couponCode || data.coupon?.couponCode || data.code || couponInput.trim(),
          influencerName: data.influencerName || data.coupon?.influencerName || '',
          discountType: data.discountType || data.coupon?.discountType || 'flat',
          discountValue: Number(data.discountValue ?? data.coupon?.discountValue ?? 0),
          discountAmount: Number(data.discountAmount ?? data.coupon?.discountAmount ?? 0),
          minOrderAmount: minOrder,
          minOrderValue: minOrder,
        };
        setAppliedCoupon(couponObj);
        await AsyncStorage.setItem('applied_coupon', JSON.stringify(couponObj));
        triggerToast('COUPON APPLIED SUCCESSFULLY!', 'success');
      } else {
        setCouponError(data.message || 'Invalid coupon code.');
        setAppliedCoupon(null);
        await AsyncStorage.removeItem('applied_coupon');
      }
    } catch (error) {
      console.error('Error validating coupon:', error);
      setCouponError('Failed to validate coupon. Please try again.');
      setAppliedCoupon(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  // Automatically remove coupon and discount if cart total drops below minimum order requirement
  useEffect(() => {
    if (appliedCoupon && cartItems.length > 0) {
      const minOrder = Number(appliedCoupon.minOrderAmount ?? appliedCoupon.minOrderValue ?? appliedCoupon.minOrder ?? 0);
      if (minOrder > 0) {
        const currentSub = calculateTotal();
        if (currentSub < minOrder) {
          setAppliedCoupon(null);
          setCouponError(`Coupon removed: Minimum order value of ₹${minOrder} required.`);
          AsyncStorage.removeItem('applied_coupon');
        }
      }
    }
  }, [cartItems, appliedCoupon]);

  const handleRemoveCoupon = async () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError('');
    await AsyncStorage.removeItem('applied_coupon');
    triggerToast('Coupon removed.', 'warning');
  };

  // Phone OTP Verification States
  const [showPhoneOTPModal, setShowPhoneOTPModal] = useState(false);
  const [verificationPhone, setVerificationPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmResult, setConfirmResult] = useState(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  const showAlert = (title, message, onOk = null) => {
    setCustomAlert({
      visible: true,
      title,
      message,
      onOk,
    });
  };

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

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Floating animation for empty cart icon
  const [floatAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -14,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  const loadCart = useCallback(async () => {
    try {
      const cartData = await AsyncStorage.getItem('cart');
      let currentItems = [];
      if (cartData) {
        currentItems = JSON.parse(cartData);
        setCartItems(currentItems);
      } else {
        setCartItems([]);
      }
      const storedCoupon = await AsyncStorage.getItem('applied_coupon');
      if (storedCoupon) {
        try {
          const parsedCoupon = JSON.parse(storedCoupon);
          const minOrder = Number(parsedCoupon.minOrderAmount ?? parsedCoupon.minOrderValue ?? parsedCoupon.minOrder ?? 0);
          const currentSub = currentItems.reduce((sum, item) => {
            const offerPercent = item.offerpercentage ? parseFloat(item.offerpercentage) : 0;
            const price = (offerPercent > 0 && offerPercent <= 100)
              ? (item.price - (item.price * (offerPercent / 100)))
              : (item.price || 0);
            return sum + price * (item.quantity || 0);
          }, 0);

          if (minOrder > 0 && currentSub < minOrder) {
            await AsyncStorage.removeItem('applied_coupon');
            setAppliedCoupon(null);
          } else {
            setAppliedCoupon(parsedCoupon);
          }
        } catch (e) {
          setAppliedCoupon(null);
        }
      }

      // Load Restaurant Offers
      if (Array.isArray(currentItems) && currentItems.length > 0) {
        const rId = currentItems[0]?.restId || currentItems[0]?.restaurantId || currentItems[0]?.id || '';
        if (rId) {
          fetch(`${API_URL}/api/offers/restaurant/${rId}`)
            .then(res => res.json())
            .then(data => {
              if (data && data.success && data.data) {
                setRestaurantOffers(data.data);
              }
            })
            .catch(err => console.warn('[Cart] Error loading offers in loadCart:', err));
        }
      }

      // Background live check: auto-remove turned-off items when viewing the cart
      if (Array.isArray(currentItems) && currentItems.length > 0) {
        const restId = currentItems[0]?.restId || currentItems[0]?.restaurantId || '';
        if (restId) {
          const fetchTime = Date.now();
          fetch(`${API_URL}/restaurants/${restId}/menu?t=${fetchTime}`)
            .then(res => res.ok ? res.json() : null)
            .then(async (menuData) => {
              if (!menuData) return;
              const liveItems = menuData.items || menuData.menu || menuData || [];
              if (!Array.isArray(liveItems) || liveItems.length === 0) return;

              const unavailableItems = [];
              for (const cartItem of currentItems) {
                const matched = liveItems.find(live =>
                  (cartItem._id && (String(live._id || '') === String(cartItem._id) || String(live.itemId || '') === String(cartItem._id))) ||
                  (cartItem.itemId && (String(live._id || '') === String(cartItem.itemId) || String(live.itemId || '') === String(cartItem.itemId))) ||
                  (cartItem.itemName && live.itemName && live.itemName.trim().toLowerCase() === cartItem.itemName.trim().toLowerCase())
                );
                if (matched) {
                  const isOff =
                    matched.isAvailable === false || matched.isAvailable === 'false' || matched.isAvailable === 0 || matched.isAvailable === '0' ||
                    matched.itemStatus === false || matched.itemStatus === 'false' || matched.itemStatus === 0 || matched.itemStatus === '0' ||
                    matched.available === false || matched.available === 'false' || matched.available === 0 || matched.available === '0' ||
                    matched.itemtodisplayintherestuarentapp === false || matched.itemtodisplayintherestuarentapp === 'false' || matched.itemtodisplayintherestuarentapp === 0 || matched.itemtodisplayintherestuarentapp === '0' ||
                    String(matched.status || '').toLowerCase() === 'unavailable' ||
                    String(matched.status || '').toLowerCase() === 'inactive' ||
                    String(matched.status || '').toLowerCase() === 'off' ||
                    String(matched.status || '').toLowerCase() === 'out_of_stock';
                  if (isOff) unavailableItems.push(cartItem);
                }
              }

              if (unavailableItems.length > 0) {
                const unavailIds = unavailableItems.map(i => String(i._id || i.itemId || ''));
                const unavailNames = unavailableItems.map(i => (i.itemName || '').trim().toLowerCase());
                const cleanItems = currentItems.filter(item => {
                  const id = String(item._id || item.itemId || '');
                  const name = (item.itemName || '').trim().toLowerCase();
                  return !unavailIds.includes(id) && !unavailNames.includes(name);
                });

                if (cleanItems.length > 0) {
                  await AsyncStorage.setItem('cart', JSON.stringify(cleanItems));
                  setCartItems(cleanItems);
                } else {
                  await AsyncStorage.removeItem('cart');
                  setCartItems([]);
                }
                const removedNames = unavailableItems.map(i => `"${i.itemName || 'Item'}"`).join(', ');
                triggerToast(`${removedNames} out of stock & removed from cart`, 'warning');
              }
            })
            .catch(e => console.warn('[Cart] Background menu availability check error:', e));
        }
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSavedAddresses = useCallback(async (uid) => {
    const targetUid = uid || userid;
    if (!targetUid) return;
    try {
      // Load cached addresses from AsyncStorage first to eliminate latency
      const cached = await AsyncStorage.getItem(`saved_addresses_${targetUid}`);
      if (cached) {
        setSavedAddresses(JSON.parse(cached));
      }

      // Fetch fresh addresses from database in background
      const response = await fetch(`${API_URL}/user/${targetUid}/addresses`);
      const data = await response.json();
      if (data.success) {
        setSavedAddresses(data.addresses || []);
        await AsyncStorage.setItem(`saved_addresses_${targetUid}`, JSON.stringify(data.addresses || []));
      }
    } catch (error) {
      console.error("Error fetching saved addresses:", error);
    }
  }, [userid]);

  const fetchFeesConfig = useCallback(async () => {
    try {
      // 1. Read cached fees_config first for instant zero-latency loading
      const cached = await AsyncStorage.getItem('fees_config');
      if (cached) {
        setFeesConfig(JSON.parse(cached));
      }
      // 2. Fetch fresh config from backend
      const response = await fetch(`${API_URL}/fees-config`);
      const data = await response.json();
      if (data.success && data.config) {
        setFeesConfig(data.config);
        await AsyncStorage.setItem('fees_config', JSON.stringify(data.config));
      }
    } catch (error) {
      console.error("Error fetching fees config:", error);
    }
  }, []);



  useFocusEffect(
    useCallback(() => {
      loadCart();
      fetchFeesConfig();
      const loadUserAndAddresses = async () => {
        const uid = await AsyncStorage.getItem('userid');
        setUserid(uid);

        if (uid) {
          fetchSavedAddresses(uid);

          // Sync profile details (including phone) live from backend database
          try {
            const userRes = await fetch(`${API_URL}/user/${uid}`);
            const userData = await userRes.json();
            if (userRes.ok && userData.success && userData.user) {
              const liveUser = userData.user;
              if (liveUser.phone && liveUser.phone !== 'N/A') {
                await AsyncStorage.setItem('phone', liveUser.phone);
              }
              if (liveUser.name && liveUser.name !== 'N/A') {
                await AsyncStorage.setItem('name', liveUser.name);
              }
              if (liveUser.email && liveUser.email !== 'N/A') {
                await AsyncStorage.setItem('email', liveUser.email);
              }
            }
          } catch (profileErr) {
            console.warn('[Cart] Error syncing user profile from backend:', profileErr);
          }

          try {
            const activeRes = await fetch(`${API_URL}/orderstatus/user/${uid}`);
            const activeData = await activeRes.json();
            if (activeRes.ok && activeData.success && activeData.orderStatus) {
              const sStr = (activeData.orderStatus.status || activeData.orderStatus.orderStatus || '').toLowerCase().trim();
              const isRej = sStr.includes('reject') || sStr.includes('cancel') || sStr.includes('declin') || sStr.includes('failed');
              setHasActiveOrder(!isRej);
            } else {
              setHasActiveOrder(false);
            }
          } catch (activeErr) {
            console.warn('[Cart] Error checking active order status:', activeErr);
            setHasActiveOrder(false);
          }
        }
      };
      loadUserAndAddresses();
    }, [loadCart, fetchFeesConfig, fetchSavedAddresses])
  );

  // Pre-fill selected address from Redux if set globally on startup
  useEffect(() => {
    if (selectedSavedAddressIdRedux && savedAddresses.length > 0) {
      const found = savedAddresses.find(
        (addr) => (addr.id || addr._id) === selectedSavedAddressIdRedux
      );
      if (found) {
        setTimeout(() => {
          setFlatNo(found.flatNo || '');
          setStreet(found.street || '');
          setLandmark(found.landmark || '');
          setSelectedTag(found.tag || found.label || 'Home');
          setSelectedSavedAddressId(selectedSavedAddressIdRedux);
        }, 0);
      }
    }
  }, [selectedSavedAddressIdRedux, savedAddresses]);

  const updateQuantity = async (itemId, change) => {
    try {
      const updated = cartItems
        .map((item) => {
          if (item._id === itemId || item.itemId === itemId) {
            return { ...item, quantity: item.quantity + change };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);

      setCartItems(updated);
      await AsyncStorage.setItem('cart', JSON.stringify(updated));
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const clearCart = async () => {
    try {
      await AsyncStorage.removeItem('cart');
      setCartItems([]);
    } catch (error) {
      console.error('Error clearing cart:', error);
    }
  };

  const handlePlaceOrder = async () => {
    // Instant 0ms check from Redux (polled every 5s in background)
    if (!confirmPayEnabled) {
      showAlert('App Under Maintenance', 'Sorry for the inconvenience this app is under maintenance');
      return;
    }

    if (hasActiveOrder) {
      showAlert('Active Order In Progress', 'You already have an active order. Please wait for it to complete.');
      return;
    }

    const userChoice = await AsyncStorage.getItem('user_location_choice');
    const hasLocation = !!(userLocation || selectedSavedAddressId || userChoice === 'inside' || userChoice === 'saved');

    if (!hasLocation) {
      console.log('[Cart] Location missing when clicking Place Order. Requesting location...');
      const success = await handleEnableLocation();
      if (!success) {
        setShowLocationChoiceModal(true);
        return;
      }
    }

    setShowDeliveryForm(true);
  };

  const handleSaveAddress = async () => {
    if (!flatNo || !street) {
      showAlert('Validation Error', 'Please enter Flat/House No and Street.');
      return;
    }
    if (!userid) {
      showAlert('Authentication Error', 'User not logged in.');
      return;
    }

    const isDuplicate = savedAddresses.some(addr => {
      const existingFlat = (addr.flatNo || '').toLowerCase().trim();
      const existingStreet = (addr.street || '').toLowerCase().trim();
      const newFlat = flatNo.toLowerCase().trim();
      const newStreet = street.toLowerCase().trim();
      return existingFlat === newFlat && existingStreet === newStreet;
    });

    if (isDuplicate) {
      showAlert('Already Saved', 'This address is already saved in your address book.');
      return;
    }

    // --- OPTIMISTIC UPDATE FOR NO LATENCY ---
    const effectiveTag = selectedTag === 'Other' ? (customTag.trim() || 'Other') : selectedTag;
    const tempId = `temp_${Date.now()}`;
    const newAddressObj = {
      _id: tempId,
      id: tempId,
      flatNo,
      street,
      landmark,
      tag: effectiveTag,
      lat: userLocation ? userLocation.latitude : null,
      lng: userLocation ? userLocation.longitude : null,
    };

    const updatedAddresses = [...savedAddresses, newAddressObj];

    // 1. Instantly update state & cache
    setSavedAddresses(updatedAddresses);
    await AsyncStorage.setItem(`saved_addresses_${userid}`, JSON.stringify(updatedAddresses));

    // 2. Instantly show toast
    triggerToast('ADDRESS SAVED SUCCESSFULLY!', 'success');

    // 3. Keep inputs populated & auto-select the newly saved address
    const savedFlatNo = flatNo;
    const savedStreet = street;
    const savedLandmark = landmark;
    const savedTag = effectiveTag;

    setSelectedSavedAddressId(tempId);

    // 4. Send POST to DB in the background
    fetch(`${API_URL}/user/${userid}/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        flatNo: savedFlatNo,
        street: savedStreet,
        landmark: savedLandmark,
        tag: savedTag,
        lat: newAddressObj.lat,
        lng: newAddressObj.lng,
      }),
    })
      .then(res => res.json())
      .then(async (data) => {
        if (data.success) {
          // Sync state and cache with actual DB response (receives actual database ID)
          const freshAddrs = data.addresses || [];
          setSavedAddresses(freshAddrs);
          await AsyncStorage.setItem(`saved_addresses_${userid}`, JSON.stringify(freshAddrs));
          if (freshAddrs.length > 0) {
            const matched = freshAddrs.find(a => 
              (a.flatNo || '').trim().toLowerCase() === (savedFlatNo || '').trim().toLowerCase() &&
              (a.street || '').trim().toLowerCase() === (savedStreet || '').trim().toLowerCase()
            );
            if (matched) {
              setSelectedSavedAddressId(matched.id || matched._id);
            }
          }
        } else {
          // Revert and fetch actual db addresses
          fetchSavedAddresses(userid);
          showAlert('Error', data.message || 'Failed to save address to database.');
        }
      })
      .catch(error => {
        console.error('Error saving address to backend:', error);
      });
  };

  const handleDeleteAddress = async (addressId) => {
    if (!userid || !addressId) return;

    // --- OPTIMISTIC UPDATE FOR NO LATENCY ---
    const updatedAddresses = savedAddresses.filter(addr => (addr.id || addr._id) !== addressId);

    // 1. Instantly update state & cache
    setSavedAddresses(updatedAddresses);
    await AsyncStorage.setItem(`saved_addresses_${userid}`, JSON.stringify(updatedAddresses));

    // 2. Reset selection and manual fields if the selected address was deleted
    if (selectedSavedAddressId === addressId) {
      setSelectedSavedAddressId(null);
      setFlatNo('');
      setStreet('');
      setLandmark('');
      setSelectedTag('Home');
    }

    // 3. Instantly show toast
    triggerToast('ADDRESS DELETED SUCCESSFULLY!', 'warning');

    // 4. Send DELETE to DB in the background
    fetch(`${API_URL}/user/${userid}/addresses/${addressId}`, {
      method: 'DELETE',
    })
      .then(res => res.json())
      .then(async (data) => {
        if (data.success) {
          // Sync state and cache with actual DB response
          setSavedAddresses(data.addresses || []);
          await AsyncStorage.setItem(`saved_addresses_${userid}`, JSON.stringify(data.addresses || []));
        } else {
          // Revert on error
          fetchSavedAddresses(userid);
          showAlert('Error', data.message || 'Failed to delete address from database.');
        }
      })
      .catch(error => {
        console.error('Error deleting address from backend:', error);
        fetchSavedAddresses(userid);
      });
  };

  const handlePrefillAddress = (addr) => {
    const addrId = addr.id || addr._id;
    if (selectedSavedAddressId === addrId) {
      setFlatNo('');
      setStreet('');
      setLandmark('');
      setSelectedTag('Home');
      setSelectedSavedAddressId(null);
      // Restore calculations to current live device GPS location
      console.log('[Cart] Address deselected, restoring current device coordinates...');
      dispatch(checkLocationAndCalculateDistances(restaurants));
    } else {
      setFlatNo(addr.flatNo || '');
      setStreet(addr.street || '');
      setLandmark(addr.landmark || '');
      setSelectedTag(addr.tag || addr.label || 'Home');
      setSelectedSavedAddressId(addrId);
      setIsSavedAddressesExpanded(false); // Collapse expanded list after selecting
      // Recalculate routing based on saved address coordinates
      const addrLat = addr.lat !== undefined ? addr.lat : addr.latitude;
      const addrLng = addr.lng !== undefined ? addr.lng : addr.longitude;
      if (addrLat !== undefined && addrLng !== undefined && addrLat !== null && addrLng !== null) {
        console.log('[Cart] Saved address selected. Recalculating distance using stored coordinates:', addrLat, addrLng);
        dispatch(checkLocationAndCalculateDistances({
          restaurantsList: restaurants,
          customCoords: { latitude: Number(addrLat), longitude: Number(addrLng) }
        }));
      }
    }
  };

  const openGoogleMapsForSelectedLocation = () => {
    let lat, lng, addressQuery;

    if (selectedSavedAddressId) {
      const selectedSavedAddressObj = savedAddresses.find(
        (addr) => (addr.id || addr._id) === selectedSavedAddressId
      );
      if (selectedSavedAddressObj) {
        lat = selectedSavedAddressObj.lat !== undefined ? selectedSavedAddressObj.lat : selectedSavedAddressObj.latitude;
        lng = selectedSavedAddressObj.lng !== undefined ? selectedSavedAddressObj.lng : selectedSavedAddressObj.longitude;
        addressQuery = `${selectedSavedAddressObj.flatNo || ''} ${selectedSavedAddressObj.street || ''} Kurnool`;
      }
    }

    if (!lat || !lng) {
      lat = userLocation?.latitude || 15.8281;
      lng = userLocation?.longitude || 78.0373;
    }

    const mapsUrl = (lat && lng)
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery || 'Kurnool')}`;

    Linking.openURL(mapsUrl).catch((err) => {
      console.error('Failed to open Google Maps URL:', err);
      showAlert('Maps Error', 'Could not open Google Maps on your device.');
    });
  };

  const handleUseCurrentLocation = async () => {
    setSelectedSavedAddressId(null);
    setFlatNo('');
    setStreet('');
    setLandmark('');
    setSelectedTag('Home');
    setIsSavedAddressesExpanded(false);
    setShowLocationChoiceModal(false);
    setIsFetchingLocation(true);
    try {
      const success = await handleEnableLocation();
      if (success) {
        setShowDeliveryForm(true);
      }
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const saveVerifiedPhoneToBackend = async (cleanPhone, isVerified) => {
    const activeUserId = await AsyncStorage.getItem('userid');
    if (!activeUserId) throw new Error('User ID not found');

    const response = await fetch(`${API_URL}/user/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userid: activeUserId,
        phone: cleanPhone,
        isPhoneVerified: isVerified
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to update phone number.');
    }

    await AsyncStorage.setItem('phone', cleanPhone);
    await AsyncStorage.setItem('isPhoneVerified', String(isVerified));

    setShowPhoneOTPModal(false);
    triggerToast(isVerified ? 'Phone verified successfully!' : 'Phone confirmed (verbal verification required).', 'success');

    setTimeout(() => {
      handleConfirmOrder();
    }, 500);
  };

  const handleSendOTP = async (isResend = false) => {
    if (!verificationPhone || verificationPhone.trim().length < 10) {
      showAlert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setOtpLoading(true);
    try {
      const cleanFirstPhone = verificationPhone.trim().slice(-10);
      const activeUserId = await AsyncStorage.getItem('userid');

      // 1. Check if phone number already exists in database
      console.log('[Phone Auth] Checking phone uniqueness for:', cleanFirstPhone);
      const checkRes = await fetch(`${API_URL}/check-phone/${cleanFirstPhone}?excludeUserId=${activeUserId || ''}`);
      const checkData = await checkRes.json();
      if (checkRes.ok && checkData.success && checkData.exists) {
        showAlert('Phone Number Linked', 'Phone number already linked to another account.');
        setOtpLoading(false);
        return;
      }

      const formattedPhone = `+91${cleanFirstPhone}`;
      console.log('[Phone Auth] Requesting OTP for:', formattedPhone);

      try {
        if (auth && typeof auth === 'function' && auth().signInWithPhoneNumber) {
          const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
          setConfirmResult(confirmation);
          triggerToast(isResend ? 'OTP Resent Successfully!' : 'OTP Sent Successfully!', 'success');
          setResendTimer(30);
        } else {
          throw new Error('Firebase Phone Auth service unavailable');
        }
      } catch (smsError) {
        console.error('[Phone Auth] Firebase SMS failed:', smsError);
        setConfirmResult(null);
        showAlert('OTP Send Failed', smsError.message || 'SMS service failed to send verification code. Please check your phone number and try again.');
      }
    } catch (error) {
      console.error('[Phone Auth] Send OTP Error:', error);
      showAlert('Verification Error', 'Could not verify phone number. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.trim().length < 6) {
      showAlert('Invalid OTP', 'Please enter the 6-digit verification code.');
      return;
    }

    if (!confirmResult) {
      showAlert('Session Expired', 'Verification session expired. Please click Resend OTP.');
      return;
    }

    setOtpLoading(true);
    let verified = false;

    try {
      console.log('[Phone Auth] Confirming OTP code:', otpCode);
      await confirmResult.confirm(otpCode.trim());
      console.log('[Phone Auth] Verification successful!');
      verified = true;
    } catch (otpError) {
      console.error('[Phone Auth] OTP verification error:', otpError);
      showAlert('Verification Failed', 'The code you entered is invalid or expired. Please enter the exact 6-digit OTP received via SMS.');
      setOtpLoading(false);
      return;
    }

    if (verified) {
      try {
        const cleanPhone = verificationPhone.trim().slice(-10);
        await saveVerifiedPhoneToBackend(cleanPhone, true);
      } catch (dbError) {
        console.error('[Phone Auth] Backend database update error:', dbError);
        showAlert('Phone Number Linked', 'Phone number already linked to another account.');
        setOtpLoading(false);
      }
    }
  };

  const handleEnableLocation = async () => {
    try {
      console.log('[Cart] User clicked Enable Location. Dispatching location verification...');
      if (Platform.OS === 'android') {
        try {
          await Location.enableNetworkProviderAsync();
        } catch (e) {
          console.warn('Network provider enable failed:', e);
        }
      }
      const resultAction = await dispatch(checkLocationAndCalculateDistances(restaurants));
      if (checkLocationAndCalculateDistances.rejected.match(resultAction)) {
        const type = resultAction.payload?.type;
        const errMsg = resultAction.payload?.message || 'Failed to verify location. Please make sure location is enabled on your device.';
        if (type === 'OUT_OF_ZONE') {
          showAlert('Service Unavailable', 'You are currently outside our service area (Kurnool). Orders can only be placed within Kurnool.');
        } else {
          showAlert('Location Error', errMsg);
        }
        return false;
      } else {
        triggerToast('Location enabled and distance calculated!', 'success');
        return true;
      }
    } catch (err) {
      console.error('[Cart] Error enabling location:', err);
      showAlert('Location Error', 'An unexpected error occurred while fetching location.');
      return false;
    }
  };

  const resetPlacingOrderState = () => {
    setIsProcessingPayment(false);
  };

  const handleConfirmOrder = async () => {
    if (isProcessingPayment) return;

    // 1. INSTANTLY SHOW FULL-SCREEN LOADING SPINNER (0ms DELAY)
    setIsProcessingPayment(true);

    // Instant 0ms check from Redux (polled every 5s in background)
    if (!confirmPayEnabled) {
      resetPlacingOrderState();
      showAlert('App Under Maintenance', 'Sorry for the inconvenience this app is under maintenance');
      return;
    }

    // 0. Live Active Order Check
    const activeUserIdCheck = await AsyncStorage.getItem('userid');
    if (activeUserIdCheck) {
      try {
        const activeRes = await fetch(`${API_URL}/orderstatus/user/${activeUserIdCheck}`);
        const activeData = await activeRes.json();
        if (activeRes.ok && activeData.success && activeData.orderStatus) {
          const sStr = (activeData.orderStatus.status || activeData.orderStatus.orderStatus || '').toLowerCase().trim();
          const isRej = sStr.includes('reject') || sStr.includes('cancel') || sStr.includes('declin') || sStr.includes('failed');
          if (!isRej) {
            setHasActiveOrder(true);
            await AsyncStorage.setItem(`has_active_order_${activeUserIdCheck}`, 'true');
            resetPlacingOrderState();
            showAlert(
              'Active Order Exists',
              'You already have an active order in progress. Please wait until your current order is completed before placing a new one.'
            );
            return;
          }
        }
      } catch (activeErr) {
        console.warn('[Cart] Error checking active order during checkout:', activeErr);
      }
    }

    const targetRestId = cartItems[0]?.restId || cartItems[0]?.restaurantId || cartItems[0]?.id || '';
    const targetRestName = cartItems[0]?.restaurantName || '';

    try {
      console.log('[Cart] Parallel live DB fetch for restaurant & menu status...');

      // Execute both HTTP requests simultaneously in parallel for sub-second speed
      const cacheBustTime = Date.now();
      const [restResResult, menuResResult] = await Promise.allSettled([
        fetch(`${API_URL}/restaurants?t=${cacheBustTime}`, { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }),
        targetRestId ? fetch(`${API_URL}/restaurants/${targetRestId}/menu?t=${cacheBustTime}`, { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }) : Promise.resolve(null)
      ]);

      // A. Verify Restaurant active status
      let currentRest = null;
      if (restResResult.status === 'fulfilled' && restResResult.value && restResResult.value.ok) {
        const data = await restResResult.value.json();
        const allRest = data.restaurants || [];
        currentRest = allRest.find(r =>
          (targetRestId && (String(r._id || '') === String(targetRestId) || String(r.restId || '') === String(targetRestId) || String(r.id || '') === String(targetRestId))) ||
          (targetRestName && r.restaurantName && r.restaurantName.trim().toLowerCase() === targetRestName.trim().toLowerCase())
        );
      }

      if (!currentRest && restaurants && restaurants.length > 0) {
        currentRest = restaurants.find(r =>
          (targetRestId && (String(r._id || '') === String(targetRestId) || String(r.restId || '') === String(targetRestId) || String(r.id || '') === String(targetRestId))) ||
          (targetRestName && r.restaurantName && r.restaurantName.trim().toLowerCase() === targetRestName.trim().toLowerCase())
        );
      }

      if (currentRest) {
        const isRestClosed =
          currentRest.isActive === false || currentRest.isActive === 'false' || currentRest.isActive === 0 || currentRest.isActive === '0' ||
          currentRest.isactive === false || currentRest.isactive === 'false' || currentRest.isactive === 0 || currentRest.isactive === '0' ||
          currentRest.isOpen === false || currentRest.isOpen === 'false' || currentRest.isOpen === 0 || currentRest.isOpen === '0' ||
          currentRest.isopen === false || currentRest.isopen === 'false' || currentRest.isopen === 0 || currentRest.isopen === '0' ||
          String(currentRest.status || '').toLowerCase() === 'closed' ||
          String(currentRest.status || '').toLowerCase() === 'inactive' ||
          String(currentRest.status || '').toLowerCase() === 'off';

        if (isRestClosed) {
          resetPlacingOrderState();
          showAlert('Restaurant Closed', 'Sorry, restaurant is closed.', clearCart);
          return;
        }
      }

      // B. Verify Menu Item Availability status
      if (menuResResult.status === 'fulfilled' && menuResResult.value && menuResResult.value.ok) {
        const menuData = await menuResResult.value.json();
        const liveItems = menuData.items || menuData.menu || menuData || [];

        const unavailableItems = [];
        for (const cartItem of cartItems) {
          const matchedLiveItem = liveItems.find(live =>
            (cartItem._id && (String(live._id || '') === String(cartItem._id) || String(live.itemId || '') === String(cartItem._id))) ||
            (cartItem.itemId && (String(live._id || '') === String(cartItem.itemId) || String(live.itemId || '') === String(cartItem.itemId))) ||
            (cartItem.itemName && live.itemName && live.itemName.trim().toLowerCase() === cartItem.itemName.trim().toLowerCase())
          );

          if (matchedLiveItem) {
            const isItemUnavailable =
              matchedLiveItem.isAvailable === false || matchedLiveItem.isAvailable === 'false' || matchedLiveItem.isAvailable === 0 || matchedLiveItem.isAvailable === '0' ||
              matchedLiveItem.itemStatus === false || matchedLiveItem.itemStatus === 'false' || matchedLiveItem.itemStatus === 0 || matchedLiveItem.itemStatus === '0' ||
              matchedLiveItem.available === false || matchedLiveItem.available === 'false' || matchedLiveItem.available === 0 || matchedLiveItem.available === '0' ||
              matchedLiveItem.itemtodisplayintherestuarentapp === false || matchedLiveItem.itemtodisplayintherestuarentapp === 'false' || matchedLiveItem.itemtodisplayintherestuarentapp === 0 || matchedLiveItem.itemtodisplayintherestuarentapp === '0' ||
              String(matchedLiveItem.status || '').toLowerCase() === 'unavailable' ||
              String(matchedLiveItem.status || '').toLowerCase() === 'inactive' ||
              String(matchedLiveItem.status || '').toLowerCase() === 'off' ||
              String(matchedLiveItem.status || '').toLowerCase() === 'out_of_stock';

            if (isItemUnavailable) {
              unavailableItems.push(cartItem);
            }
          }
        }

        if (unavailableItems.length > 0) {
          resetPlacingOrderState();
          const unavailableNames = unavailableItems.map(i => `"${i.itemName || 'Item'}"`).join(', ');
          const unavailableIds = unavailableItems.map(i => String(i._id || i.itemId || ''));
          const unavailableNameList = unavailableItems.map(i => (i.itemName || '').trim().toLowerCase());

          const remainingCartItems = cartItems.filter(item => {
            const itemId = String(item._id || item.itemId || '');
            const itemName = (item.itemName || '').trim().toLowerCase();
            return !unavailableIds.includes(itemId) && !unavailableNameList.includes(itemName);
          });

          const onDismissAlert = async () => {
            if (remainingCartItems.length > 0) {
              await AsyncStorage.setItem('cart', JSON.stringify(remainingCartItems));
              setCartItems(remainingCartItems);
            } else {
              await AsyncStorage.removeItem('cart');
              setCartItems([]);
            }
          };

          const alertMsg = unavailableItems.length === 1
            ? `Sorry, ${unavailableNames} is currently out of stock and has been removed from your cart.`
            : `Sorry, ${unavailableNames} are currently out of stock and have been removed from your cart.`;

          showAlert('Item Unavailable', alertMsg, onDismissAlert);
          return;
        }
      }
    } catch (err) {
      console.warn('[Cart] Live DB status check warning:', err);
    }

    resetPlacingOrderState();

    const userChoice = await AsyncStorage.getItem('user_location_choice');
    const hasValidLocation = !!(userLocation || selectedSavedAddressId || userChoice === 'inside' || userChoice === 'saved');

    if (!hasValidLocation) {
      console.log('[Cart] Location is missing in handleConfirmOrder. Requesting location...');
      const success = await handleEnableLocation();
      if (!success) {
        showAlert('Location Required', 'Location verification is required to place your order. Please enable your location.');
        return;
      }
    }



    if (!flatNo.trim() || !street.trim()) {
      showAlert('Delivery Address Required', 'Please enter Flat/House No and Street to proceed.');
      return;
    }

    // Gated Phone Verification Check
    const rawActivePhone = await AsyncStorage.getItem('phone');
    const activePhone = rawActivePhone !== null ? String(rawActivePhone) : '';
    const isPhoneVerified = await AsyncStorage.getItem('isPhoneVerified');
    const isTempPhone = activePhone && (activePhone.startsWith('google_temp_') || activePhone.startsWith('temp_google_'));
    if (!activePhone || activePhone === 'N/A' || activePhone.trim() === '' || isTempPhone || isPhoneVerified !== 'true') {
      setVerificationPhone(activePhone && activePhone !== 'N/A' && !isTempPhone ? activePhone : '');
      setOtpCode('');
      setConfirmResult(null);
      setResendTimer(0);
      setShowPhoneOTPModal(true);
      return;
    }

    setShowPaymentChoiceModal(true);
  };

  const processCodPayment = async () => {
    if (isProcessingPayment) return;
    setShowPaymentChoiceModal(false);
    setIsProcessingPayment(true);

    try {
      const subTotal = calculateTotal();
      let discountValAmount = 0;
      if (appliedCoupon) {
        const minOrder = Number(appliedCoupon.minOrderAmount ?? appliedCoupon.minOrderValue ?? appliedCoupon.minOrder ?? 0);
        if (minOrder === 0 || subTotal >= minOrder) {
          if (appliedCoupon.discountType === 'flat') {
            discountValAmount = Math.min(appliedCoupon.discountValue, subTotal);
          } else if (appliedCoupon.discountType === 'percentage') {
            discountValAmount = subTotal * (appliedCoupon.discountValue / 100);
          }
          discountValAmount = Math.round(discountValAmount * 100) / 100;
        } else {
          discountValAmount = 0;
        }
      }

      const restId = cartItems[0]?.restId || '';
      const distanceStr = roadDistances[restId] || '';
      const distanceVal = parseFloat(distanceStr) || 0;
      const baseKmThreshold = Number(feesConfig?.baseKmThreshold ?? 3);
      const extraDistance = Math.max(0, distanceVal - baseKmThreshold);
      const baseDeliveryFee = Number(feesConfig?.deliveryFeeBase || 0) + (extraDistance * Number(feesConfig?.deliveryFeePerKm || 0));
      const isSurgeOn = (feesConfig?.isSurgeActive === true || feesConfig?.isSurgeActive === 'true' || feesConfig?.isSurgeActive === 1 || feesConfig?.isSurgeActive === '1') && Number(feesConfig?.surgeFee || 0) > 0;
      const surgeFee = isSurgeOn ? Number(feesConfig.surgeFee) : 0;
      const deliveryFee = Math.round((baseDeliveryFee + surgeFee) * 100) / 100;
      const foodGstAmount = Math.round((subTotal * 0.05) * 100) / 100;
      const deliveryGstAmount = Math.round((deliveryFee * 0.18) * 100) / 100;
      const gstAmount = Math.round((foodGstAmount + deliveryGstAmount) * 100) / 100;
      const gTotal = Math.round(Math.max(0, subTotal - discountValAmount + gstAmount + deliveryFee) * 100) / 100;

      const activeUserId = await AsyncStorage.getItem('userid');
      const activeName = await AsyncStorage.getItem('name');
      const activeEmail = await AsyncStorage.getItem('email');
      const activePhone = await AsyncStorage.getItem('phone');
      const activePhoneVerified = (await AsyncStorage.getItem('isPhoneVerified')) === 'true';
      const restName = cartItems[0]?.restaurantName || 'Restaurant';

      if (activeUserId) {
        try {
          const activeRes = await fetch(`${API_URL}/orderstatus/user/${activeUserId}`);
          const activeData = await activeRes.json();
          if (activeRes.ok && activeData.success && activeData.orderStatus) {
            const sStr = (activeData.orderStatus.status || activeData.orderStatus.orderStatus || '').toLowerCase().trim();
            const isRej = sStr.includes('reject') || sStr.includes('cancel') || sStr.includes('declin') || sStr.includes('failed');
            if (!isRej) {
              setHasActiveOrder(true);
              await AsyncStorage.setItem(`has_active_order_${activeUserId}`, 'true');
              resetPlacingOrderState();
              showAlert(
                'Active Order Exists',
                'You already have an active order in progress. Please wait until your current order is completed before placing a new one.'
              );
              return;
            }
          }
        } catch (activeErr) {
          console.warn('[Cart] Live active order check warning in COD:', activeErr);
        }
      }

      // Dynamic Coins Calculation
      const coinsMin = Number(feesConfig?.coinMinOrderAmount ?? 200);
      const coinsBase = Number(feesConfig?.coinBaseAmount ?? 10);
      const coinsStep = Number(feesConfig?.coinStepAmount ?? 100);
      const coinsStepVal = Number(feesConfig?.coinStepValue ?? 5);
      const coinsMax = Number(feesConfig?.coinMaxLimit ?? 100);
      const coinsMaxOrder = Number(feesConfig?.coinMaxThreshold ?? 1000);

      let coins = 0;
      if (feesConfig?.isCoinsActive !== false) {
        if (subTotal >= coinsMaxOrder) {
          coins = coinsMax;
        } else if (subTotal >= coinsMin) {
          coins = coinsBase + Math.floor((subTotal - coinsMin) / coinsStep) * coinsStepVal;
          coins = Math.min(coins, coinsMax);
        }
      }

      const codPayload = {
        userId: activeUserId,
        cartItems: cartItems,
        restaurantId: restId,
        restaurantName: restName,
        totalPrice: subTotal,
        gst: gstAmount,
        foodGst: foodGstAmount,
        deliveryGst: deliveryGstAmount,
        platformFee: 0.00,
        grandTotal: gTotal,
        coinsEarned: coins,
        userName: activeName,
        userEmail: activeEmail,
        userPhone: activePhone,
        isPhoneVerified: activePhoneVerified,
        deliveryAddressInfo: {
          flatNo,
          street,
          landmark,
          tag: selectedTag === 'Other' ? (customTag.trim() || 'Other') : selectedTag,
        },
        userCoordinates: userLocation ? {
          lat: userLocation.latitude,
          lng: userLocation.longitude
        } : null,
        deliveryDistance: roadDistances[restId] || null,
        deliveryFee: deliveryFee,
        surgeFee: surgeFee,
        couponCode: appliedCoupon ? appliedCoupon.couponCode : null,
        influencerName: appliedCoupon ? appliedCoupon.influencerName : null,
        discountAmount: discountValAmount,
        paymentMethod: 'UPI On Delivery',
        paymentStatus: 'Pending',
      };

      const response = await fetch(`${API_URL}/orders/cod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(codPayload),
      });

      const data = await response.json();
      if (data.success) {
        if (activeUserId) {
          await AsyncStorage.setItem(`has_active_order_${activeUserId}`, 'true');
          await AsyncStorage.removeItem(`recent_rejected_order_${activeUserId}`).catch(() => {});
          await AsyncStorage.removeItem(`active_order_data_${activeUserId}`).catch(() => {});
        }
        setHasActiveOrder(true);
        await AsyncStorage.removeItem('cart');
        await AsyncStorage.removeItem('applied_coupon');
        resetPlacingOrderState();
        setShowSuccessModal(true);
      } else {
        resetPlacingOrderState();
        if (response.status === 403 || data.isBlocked) {
          await AsyncStorage.clear();
          showAlert('Account Blocked', data.message || 'Your account has been blocked by admin.');
          router.replace('/login');
          return;
        }
        showAlert('Order Error', data.message || 'Failed to place order.');
      }
    } catch (err) {
      resetPlacingOrderState();
      console.error('UPI On Delivery Order Error:', err);
      showAlert('Order Error', 'Failed to connect to backend server.');
    }
  };

  const processOnlinePayment = async () => {
    if (isProcessingPayment) return;
    setShowPaymentChoiceModal(false);
    setIsProcessingPayment(true);
    const subTotal = calculateTotal();

    // Coupon Discount Calculation
    let discountValAmount = 0;
    if (appliedCoupon) {
      const minOrder = Number(appliedCoupon.minOrderAmount ?? appliedCoupon.minOrderValue ?? appliedCoupon.minOrder ?? 0);
      if (minOrder === 0 || subTotal >= minOrder) {
        if (appliedCoupon.discountType === 'flat') {
          discountValAmount = Math.min(appliedCoupon.discountValue, subTotal);
        } else if (appliedCoupon.discountType === 'percentage') {
          discountValAmount = subTotal * (appliedCoupon.discountValue / 100);
        }
        discountValAmount = Math.round(discountValAmount * 100) / 100;
      } else {
        discountValAmount = 0;
      }
    }

    const pFee = 0.00;
    const restId = cartItems[0]?.restId || '';
    const distanceStr = roadDistances[restId] || '';
    const distanceVal = parseFloat(distanceStr) || 0;
    const baseKmThreshold = Number(feesConfig?.baseKmThreshold ?? 3);
    const extraDistance = Math.max(0, distanceVal - baseKmThreshold);
    const baseDeliveryFee = Number(feesConfig?.deliveryFeeBase || 0) + (extraDistance * Number(feesConfig?.deliveryFeePerKm || 0));
    const isSurgeOn = (feesConfig?.isSurgeActive === true || feesConfig?.isSurgeActive === 'true' || feesConfig?.isSurgeActive === 1 || feesConfig?.isSurgeActive === '1') && Number(feesConfig?.surgeFee || 0) > 0;
    const surgeFee = isSurgeOn ? Number(feesConfig.surgeFee) : 0;
    const deliveryFee = Math.round((baseDeliveryFee + surgeFee) * 100) / 100;
    const foodGstAmount = Math.round((subTotal * 0.05) * 100) / 100;
    const deliveryGstAmount = Math.round((deliveryFee * 0.18) * 100) / 100;
    const gstAmount = Math.round((foodGstAmount + deliveryGstAmount) * 100) / 100;
    const gTotal = Math.round(Math.max(0, subTotal - discountValAmount + gstAmount + deliveryFee) * 100) / 100;
    // Dynamic Coins Calculation
    const coinsMin = feesConfig.coinMinOrderAmount ?? 200;
    const coinsBase = feesConfig.coinBaseAmount ?? 10;
    const coinsStep = feesConfig.coinStepAmount ?? 100;
    const coinsStepVal = feesConfig.coinStepValue ?? 5;
    const coinsMax = feesConfig.coinMaxLimit ?? 100;
    const coinsMaxOrder = feesConfig.coinMaxThreshold ?? 1000;

    let coins = 0;
    if (feesConfig?.isCoinsActive !== false) {
      if (subTotal >= coinsMaxOrder) {
        coins = coinsMax;
      } else if (subTotal >= coinsMin) {
        coins = coinsBase + Math.floor((subTotal - coinsMin) / coinsStep) * coinsStepVal;
        coins = Math.min(coins, coinsMax);
      }
    }
    const restName = cartItems[0]?.restaurantName || 'Restaurant';

    const activeUserId = await AsyncStorage.getItem('userid');
    const activeName = await AsyncStorage.getItem('name');
    const activeEmail = await AsyncStorage.getItem('email');
    const activePhone = await AsyncStorage.getItem('phone');
    const activePhoneVerified = (await AsyncStorage.getItem('isPhoneVerified')) === 'true';

    if (activeUserId) {
      try {
        const activeRes = await fetch(`${API_URL}/orderstatus/user/${activeUserId}`);
        const activeData = await activeRes.json();
        if (activeRes.ok && activeData.success && activeData.orderStatus) {
          const sStr = (activeData.orderStatus.status || activeData.orderStatus.orderStatus || '').toLowerCase().trim();
          const isRej = sStr.includes('reject') || sStr.includes('cancel') || sStr.includes('declin') || sStr.includes('failed');
          if (!isRej) {
            setHasActiveOrder(true);
            await AsyncStorage.setItem(`has_active_order_${activeUserId}`, 'true');
            resetPlacingOrderState();
            showAlert(
              'Active Order Exists',
              'You already have an active order in progress. Please wait until your current order is completed before placing a new one.'
            );
            return;
          }
        }
      } catch (activeErr) {
        console.warn('[Cart] Live active order check warning in online payment:', activeErr);
      }
    }

    const rawPhone = (activePhone || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : '';
    const cleanEmail = (activeEmail && activeEmail.includes('@')) ? activeEmail.trim() : 'customer@leevondelivery.in';
    const cleanName = (activeName && activeName.trim() !== '' && activeName !== 'N/A') ? activeName.trim() : 'Customer';

    setIsProcessingPayment(true);

    try {
      // 1. Create Razorpay order on backend
      const response = await fetch(`${API_URL}/payment/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: gTotal,
          userId: activeUserId,
        }),
      });

      const orderData = await response.json();
      if (!orderData.success) {
        resetPlacingOrderState();
        showAlert('Payment Error', orderData.message || 'Failed to initiate payment.');
        return;
      }

      // 2. Platform-specific Checkout Handler
      if (Platform.OS === 'web') {
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          resetPlacingOrderState();
          showAlert('Payment Error', 'Failed to load Razorpay checkout SDK.');
          return;
        }

        const options = {
          description: `Order from ${restName}`,
          image: 'https://leevondelivery.in/logo.png',
          currency: 'INR',
          key: orderData.keyId,
          amount: orderData.amount,
          name: 'Leevon Delivery',
          order_id: orderData.orderId,
          prefill: {
            email: cleanEmail,
            contact: cleanPhone,
            name: cleanName,
          },
          theme: { color: '#27AE60' },
          handler: async function (paymentResult) {
            try {
              const verifyResponse = await fetch(`${API_URL}/payment/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: paymentResult.razorpay_order_id,
                  razorpay_payment_id: paymentResult.razorpay_payment_id,
                  razorpay_signature: paymentResult.razorpay_signature,
                  userId: activeUserId,
                  cartItems: cartItems,
                  restaurantId: restId,
                  restaurantName: restName,
                  totalPrice: subTotal,
                  gst: gstAmount,
                  foodGst: foodGstAmount,
                  deliveryGst: deliveryGstAmount,
                  platformFee: pFee,
                  grandTotal: gTotal,
                  coinsEarned: coins,
                  userName: activeName,
                  userEmail: activeEmail,
                  userPhone: activePhone,
                  isPhoneVerified: activePhoneVerified,
                  deliveryAddressInfo: {
                    flatNo,
                    street,
                    landmark,
                    tag: selectedTag === 'Other' ? (customTag.trim() || 'Other') : selectedTag,
                  },
                  userCoordinates: userLocation ? {
                    lat: userLocation.latitude,
                    lng: userLocation.longitude
                  } : null,
                  deliveryDistance: roadDistances[restId] || null,
                  deliveryFee: deliveryFee,
                  surgeFee: surgeFee,
                  couponCode: appliedCoupon ? appliedCoupon.couponCode : null,
                  influencerName: appliedCoupon ? appliedCoupon.influencerName : null,
                  discountAmount: discountValAmount,
                }),
              });

              const verifyData = await verifyResponse.json();
              if (verifyData.success) {
                if (activeUserId) {
                  await AsyncStorage.setItem(`has_active_order_${activeUserId}`, 'true');
                  await AsyncStorage.removeItem(`recent_rejected_order_${activeUserId}`).catch(() => {});
                  await AsyncStorage.removeItem(`active_order_data_${activeUserId}`).catch(() => {});
                }
                setHasActiveOrder(true);
                // Clear cart in AsyncStorage
                await AsyncStorage.removeItem('cart');
                await AsyncStorage.removeItem('applied_coupon');
                resetPlacingOrderState();
                setShowSuccessModal(true);
              } else {
                resetPlacingOrderState();
                showAlert('Verification Failed', verifyData.message || 'Unable to verify payment with server.');
              }
            } catch (verifyError) {
              resetPlacingOrderState();
              console.error('Verify payment error on Web:', verifyError);
              showAlert('Server Error', 'Failed to connect to backend server for verification.');
            }
          },
          modal: {
            ondismiss: function () {
              resetPlacingOrderState();
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Mobile (Android / iOS)
        const { NativeModules } = require('react-native');
        const hasNativeRazorpay = NativeModules && (
          NativeModules.RNRazorpayCheckout ||
          NativeModules.RazorpayCheckout ||
          NativeModules.Razorpay ||
          NativeModules.RNPay
        );

        let RazorpayCheckout = null;
        try {
          const RazorpayModule = require('react-native-razorpay');
          RazorpayCheckout = RazorpayModule.default || RazorpayModule;
        } catch (e) {
          console.warn('[Razorpay] Failed to load react-native-razorpay native module:', e);
        }

        const options = {
          description: `Order from ${restName}`,
          image: 'https://leevondelivery.in/logo.png',
          currency: 'INR',
          key: orderData.keyId,
          amount: orderData.amount,
          name: 'Leevon Delivery',
          order_id: orderData.orderId,
          prefill: {
            email: cleanEmail,
            contact: cleanPhone,
            name: cleanName,
          },
          theme: { color: '#27AE60' },
        };

        if (hasNativeRazorpay && RazorpayCheckout && typeof RazorpayCheckout.open === 'function') {
          console.log('[Razorpay] Opening official Razorpay Checkout SDK for real-time payment...');
          RazorpayCheckout.open(options)
            .then(async (paymentResult) => {
              try {
                const verifyResponse = await fetch(`${API_URL}/payment/verify`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    razorpay_order_id: paymentResult.razorpay_order_id,
                    razorpay_payment_id: paymentResult.razorpay_payment_id,
                    razorpay_signature: paymentResult.razorpay_signature,
                    userId: activeUserId,
                    cartItems: cartItems,
                    restaurantId: restId,
                    restaurantName: restName,
                    totalPrice: subTotal,
                    gst: gstAmount,
                    foodGst: foodGstAmount,
                    deliveryGst: deliveryGstAmount,
                    platformFee: pFee,
                    grandTotal: gTotal,
                    coinsEarned: coins,
                    userName: activeName,
                    userEmail: activeEmail,
                    userPhone: activePhone,
                    isPhoneVerified: activePhoneVerified,
                    deliveryAddressInfo: {
                      flatNo,
                      street,
                      landmark,
                      tag: selectedTag === 'Other' ? (customTag.trim() || 'Other') : selectedTag,
                    },
                    userCoordinates: userLocation ? {
                      lat: userLocation.latitude,
                      lng: userLocation.longitude
                    } : null,
                    deliveryDistance: roadDistances[restId] || null,
                    deliveryFee: deliveryFee,
                    surgeFee: surgeFee,
                    couponCode: appliedCoupon ? appliedCoupon.couponCode : null,
                    influencerName: appliedCoupon ? appliedCoupon.influencerName : null,
                    discountAmount: discountValAmount,
                  }),
                });

                const verifyData = await verifyResponse.json();
                if (verifyData.success) {
                  if (activeUserId) {
                    await AsyncStorage.setItem(`has_active_order_${activeUserId}`, 'true');
                    await AsyncStorage.removeItem(`recent_rejected_order_${activeUserId}`).catch(() => {});
                    await AsyncStorage.removeItem(`active_order_data_${activeUserId}`).catch(() => {});
                  }
                  setHasActiveOrder(true);
                  // Clear cart in AsyncStorage
                  await AsyncStorage.removeItem('cart');
                  await AsyncStorage.removeItem('applied_coupon');
                  resetPlacingOrderState();
                  setShowSuccessModal(true);
                } else {
                  resetPlacingOrderState();
                  showAlert('Verification Failed', verifyData.message || 'Unable to verify payment with server.');
                }
              } catch (verifyError) {
                resetPlacingOrderState();
                console.error('Verify payment error:', verifyError);
                showAlert('Server Error', 'Failed to connect to backend server for verification.');
              }
            })
            .catch((error) => {
              resetPlacingOrderState();
              console.log('[Razorpay] Payment checkout cancelled or dismissed:', error);
            });
        } else {
          resetPlacingOrderState();
          showAlert(
            'Razorpay Native Checkout',
            'To process live Razorpay payments on mobile, please run on a compiled APK / Android build (npx expo run:android) or on web.'
          );
        }
      }
    } catch (err) {
      resetPlacingOrderState();
      console.error('Initiate payment error:', err);
      showAlert('Payment Connection Error', 'Could not establish connection to initiate checkout.');
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => {
      const itemCat = String(item.category || '').trim().toLowerCase();
      const matchedCatDiscount = (restaurantOffers?.categoryDiscounts || []).find((d) => {
        if (d.isActive === false) return false;
        const targetCat = String(d.category || '').trim().toLowerCase();
        return targetCat && (targetCat === itemCat || itemCat.includes(targetCat) || targetCat.includes(itemCat));
      });
      const catDiscountPercent = matchedCatDiscount ? Number(matchedCatDiscount.discountPercentage || 0) : Number(item.categoryDiscountPercent || 0);
      const directOffer = item.offerpercentage ? parseFloat(item.offerpercentage) : 0;
      const offerPercent = Math.max(directOffer, catDiscountPercent);
      const price = (offerPercent > 0 && offerPercent <= 100)
        ? (item.price - (item.price * (offerPercent / 100)))
        : (item.price || 0);
      return sum + price * (item.quantity || 0);
    }, 0);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <Text style={styles.title}>Loading cart...</Text>
      </View>
    );
  }

  const restaurantName = cartItems[0]?.restaurantName || 'Restaurant Cart';
  const total = calculateTotal();

  // Dynamic Coupon Discount Calculation
  let discountAmount = 0;
  if (appliedCoupon) {
    const minOrder = Number(appliedCoupon.minOrderAmount ?? appliedCoupon.minOrderValue ?? appliedCoupon.minOrder ?? 0);
    if (minOrder === 0 || total >= minOrder) {
      if (appliedCoupon.discountType === 'flat') {
        discountAmount = Math.min(appliedCoupon.discountValue, total);
      } else if (appliedCoupon.discountType === 'percentage') {
        discountAmount = total * (appliedCoupon.discountValue / 100);
      }
      discountAmount = Math.round(discountAmount * 100) / 100;
    } else {
      discountAmount = 0;
    }
  }

  // Tiered Bill Discount Calculation (supports % or Flat Money ₹)
  const activeTiers = (restaurantOffers?.tieredDiscounts || [])
    .filter(t => {
      if (t.isActive === false || Number(t.minBillAmount) <= 0) return false;
      const isFlat = t.discountType === 'flat' || (Number(t.discountAmount) > 0 && !t.discountPercentage);
      return isFlat ? Number(t.discountAmount) > 0 : Number(t.discountPercentage) > 0;
    })
    .sort((a, b) => Number(b.minBillAmount) - Number(a.minBillAmount));

  const activeTier = activeTiers.find(t => total >= Number(t.minBillAmount));
  let restaurantTieredDiscount = 0;
  if (activeTier) {
    const isFlat = activeTier.discountType === 'flat' || (Number(activeTier.discountAmount) > 0 && !activeTier.discountPercentage);
    if (isFlat) {
      restaurantTieredDiscount = Math.min(Number(activeTier.discountAmount || 0), total);
    } else {
      restaurantTieredDiscount = Math.round(total * (Number(activeTier.discountPercentage || 0) / 100) * 100) / 100;
    }
  }

  const ascendingTiers = [...activeTiers].sort((a, b) => Number(a.minBillAmount) - Number(b.minBillAmount));
  const nextTier = ascendingTiers.find(t => total < Number(t.minBillAmount));

  const platformFee = 0.00; // Platform fee removed
  const restId = targetRestId;
  const distanceVal = parseFloat(distanceStr) || 0;
  const baseKmThreshold = Number(feesConfig?.baseKmThreshold ?? 3);
  const extraDistance = Math.max(0, distanceVal - baseKmThreshold);
  const baseDeliveryFee = Number(feesConfig?.deliveryFeeBase || 0) + (extraDistance * Number(feesConfig?.deliveryFeePerKm || 0));
  const isSurgeOn = (feesConfig?.isSurgeActive === true || feesConfig?.isSurgeActive === 'true' || feesConfig?.isSurgeActive === 1 || feesConfig?.isSurgeActive === '1') && Number(feesConfig?.surgeFee || 0) > 0;
  const surgeFee = isSurgeOn ? Number(feesConfig.surgeFee) : 0;
  const isLocationFetched = locationStatus === 'inside';
  const deliveryFee = isLocationFetched ? Math.round((baseDeliveryFee + surgeFee) * 100) / 100 : 0;
  const foodGst = Math.round((total * 0.05) * 100) / 100; // 5% Food GST
  const deliveryGst = isLocationFetched ? Math.round((deliveryFee * 0.18) * 100) / 100 : 0; // 18% Delivery GST
  const gst = Math.round((foodGst + deliveryGst) * 100) / 100;
  const grandTotal = Math.round(Math.max(0, total - discountAmount - restaurantTieredDiscount + gst + deliveryFee) * 100) / 100;
  // Dynamic Coins Calculation
  const coinsMin = feesConfig.coinMinOrderAmount ?? 200;
  const coinsBase = feesConfig.coinBaseAmount ?? 10;
  const coinsStep = feesConfig.coinStepAmount ?? 100;
  const coinsStepVal = feesConfig.coinStepValue ?? 5;
  const coinsMax = feesConfig.coinMaxLimit ?? 100;
  const coinsMaxOrder = feesConfig.coinMaxThreshold ?? 1000;

  let coinsEarned = 0;
  if (feesConfig?.isCoinsActive !== false) {
    if (total >= coinsMaxOrder) {
      coinsEarned = coinsMax;
    } else if (total >= coinsMin) {
      coinsEarned = coinsBase + Math.floor((total - coinsMin) / coinsStep) * coinsStepVal;
      coinsEarned = Math.min(coinsEarned, coinsMax);
    }
  }

  if (cartItems.length === 0 && !showSuccessModal) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20, justifyContent: 'center' }]}>
        <Animated.View style={[styles.iconCircle, { transform: [{ translateY: floatAnim }] }]}>
          <MaterialIcons name="shopping-cart" size={56} color="#1A1A1A" />
        </Animated.View>
        <Text style={styles.title}>No items in the cart</Text>
        <Text style={styles.subtitle}>
          Your cart is quiet right now. Let{`'`}s fix{'\n'}that with some delicious food!
        </Text>
        <TouchableOpacity
          style={styles.orderButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/restaurentlist');
            }
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.orderButtonText}>Order Something Tasty</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isWarningToast = toastConfig.type === 'warning';
  const toastBgColor = isWarningToast ? '#D32F2F' : '#008000';
  const toastIconColor = isWarningToast ? '#D32F2F' : '#008000';
  const toastIconName = isWarningToast ? 'alert' : 'checkmark';

  return (
    <View style={{ flex: 1, backgroundColor: 'rgb(247, 247, 235)' }}>
      <StatusBar style="dark" backgroundColor="transparent" translucent={true} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: Math.max(160, insets.bottom + 140) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Restaurant Title */}
        <Text style={styles.restaurantTitle}>{restaurantName}</Text>

        {/* Cart Items List */}
        <View style={styles.itemsListContainer}>
          {cartItems.map((item) => {
            const isVeg = (item.vegOrNonVeg || 'veg').toLowerCase() === 'veg';
            const suffix = isVeg ? ' (Veg)' : ' (Non-Veg)';
            let displayItemName = item.itemName ? item.itemName.charAt(0).toUpperCase() + item.itemName.slice(1) : 'Food Item';
            if (!displayItemName.toLowerCase().includes('(veg') && !displayItemName.toLowerCase().includes('(non-veg')) {
              displayItemName += suffix;
            }

            const itemCat = String(item.category || '').trim().toLowerCase();
            const matchedCatDiscount = (restaurantOffers?.categoryDiscounts || []).find((d) => {
              if (d.isActive === false) return false;
              const targetCat = String(d.category || '').trim().toLowerCase();
              return targetCat && (targetCat === itemCat || itemCat.includes(targetCat) || targetCat.includes(itemCat));
            });
            const catDiscountPercent = matchedCatDiscount ? Number(matchedCatDiscount.discountPercentage || 0) : Number(item.categoryDiscountPercent || 0);
            const directOffer = item.offerpercentage ? parseFloat(item.offerpercentage) : 0;
            const offerPercent = Math.max(directOffer, catDiscountPercent);
            const hasOffer = offerPercent > 0 && offerPercent <= 100;
            const offerPrice = hasOffer ? (item.price - (item.price * (offerPercent / 100))) : item.price;

            const isBogo = Boolean(
              item.isBogo ||
              (restaurantOffers?.bogoOffers || []).some((b) => {
                if (b.isActive === false) return false;
                const srcCat = String(b.sourceCategory || '').trim().toLowerCase();
                return srcCat && (srcCat === itemCat || itemCat.includes(srcCat) || srcCat.includes(itemCat));
              })
            );

            return (
              <View key={item._id || item.itemId} style={[styles.cartCard, { flexDirection: 'column', alignItems: 'stretch' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {displayItemName}
                  </Text>

                  <View style={styles.controlsRow}>
                    {/* Quantity Pill with Plus on Left and Minus on Right */}
                    <View style={styles.quantityContainer}>
                      <TouchableOpacity style={styles.quantityBtn} onPress={() => updateQuantity(item._id || item.itemId, 1)}>
                        <Feather name="plus" size={14} color="#1A1A1A" />
                      </TouchableOpacity>
                      <Text style={styles.quantityText}>{isBogo ? (item.quantity * 2) : item.quantity}</Text>
                      <TouchableOpacity style={styles.quantityBtn} onPress={() => updateQuantity(item._id || item.itemId, -1)}>
                        <Feather name="minus" size={14} color="#1A1A1A" />
                      </TouchableOpacity>
                    </View>

                    {/* Price */}
                    <View style={{ alignItems: 'flex-end', minWidth: 60 }}>
                      <Text style={styles.itemPrice}>₹{(offerPrice * item.quantity).toFixed(2)}</Text>
                      {hasOffer && (
                        <Text style={[styles.itemPrice, { textDecorationLine: 'line-through', textDecorationColor: '#FF5E00', color: '#FF5E00', fontSize: 11, fontWeight: 'normal', marginTop: 1, minWidth: 0 }]}>
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </Text>
                      )}
                    </View>

                    {/* Red Trash Icon */}
                    <TouchableOpacity onPress={() => updateQuantity(item._id || item.itemId, -item.quantity)} activeOpacity={0.7}>
                      <MaterialIcons name="delete" size={24} color="#FF5E5E" />
                    </TouchableOpacity>
                  </View>
                </View>

                {isBogo && (
                  <View style={{
                    marginTop: 10,
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: 'rgba(0, 128, 0, 0.2)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <View style={{
                      backgroundColor: '#008000',
                      paddingHorizontal: 7,
                      paddingVertical: 2.5,
                      borderRadius: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' }}>1+1 OFFER</Text>
                    </View>
                    <Text style={{ color: '#008000', fontSize: 12, fontWeight: '700' }}>
                      {item.quantity * 2} Items ({item.quantity} Paid + {item.quantity} Free)
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Coupon Card */}
        <View style={styles.couponCard}>
          <Text style={styles.couponTitle}>Coupon Code</Text>
          {!appliedCoupon ? (
            <View style={styles.couponInputContainer}>
              <TextInput
                style={styles.couponInput}
                placeholder="Enter Coupon Code"
                placeholderTextColor="#8A8A8A"
                value={couponInput}
                onChangeText={(text) => {
                  setCouponInput(text);
                  if (couponError) setCouponError('');
                }}
                autoCapitalize="characters"
                editable={!isValidatingCoupon}
              />
              <TouchableOpacity
                style={styles.couponApplyBtn}
                onPress={handleApplyCoupon}
                disabled={isValidatingCoupon}
              >
                {isValidatingCoupon ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.couponApplyBtnText}>Apply</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.appliedCouponContainer}>
              <View style={styles.appliedCouponLeft}>
                <Ionicons name="pricetag" size={18} color="#27AE60" style={{ marginRight: 8 }} />
                <View>
                  <Text style={styles.appliedCouponCode}>{appliedCoupon.couponCode}</Text>
                  <Text style={styles.appliedCouponSub}>
                    Code from {appliedCoupon.influencerName}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.couponRemoveBtn} onPress={handleRemoveCoupon}>
                <Text style={styles.couponRemoveBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
          {couponError ? <Text style={styles.couponErrorText}>{couponError}</Text> : null}
          {appliedCoupon ? (
            <Text style={styles.couponSuccessText}>
              Savings of ₹{discountAmount.toFixed(2)} applied!
            </Text>
          ) : null}
        </View>


        {/* Dynamic Tiered Discount Progress / Unlocked Banner (After Coupon Card) */}
        {nextTier && (() => {
          const neededAmount = Math.max(0, nextTier.minBillAmount - total);
          const isNextFlat = nextTier.discountType === 'flat' || (Number(nextTier.discountAmount) > 0 && !nextTier.discountPercentage);
          const nextDiscountText = isNextFlat ? `₹${nextTier.discountAmount} OFF!` : `${nextTier.discountPercentage}% OFF!`;
          return (
            <View style={{
              backgroundColor: '#000000',
              borderRadius: 20,
              paddingVertical: 12,
              paddingHorizontal: 16,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.2,
              shadowRadius: 5,
              elevation: 3,
            }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>⚡</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '700', flex: 1 }}>
                Just ₹{neededAmount.toFixed(0)} away from unlocking <Text style={{ color: '#FBBF24', fontWeight: '900' }}>{nextDiscountText}</Text>
              </Text>
            </View>
          );
        })()}
        {!nextTier && activeTier && (() => {
          const isActiveFlat = activeTier.discountType === 'flat' || (Number(activeTier.discountAmount) > 0 && !activeTier.discountPercentage);
          const activeSavingsText = isActiveFlat ? `₹${activeTier.discountAmount} Instant Savings!` : `${activeTier.discountPercentage}% Instant Savings!`;
          return (
            <View style={{
              backgroundColor: '#000000',
              borderRadius: 20,
              paddingVertical: 12,
              paddingHorizontal: 16,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.2,
              shadowRadius: 5,
              elevation: 3,
            }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>🎉</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '700', flex: 1 }}>
                Big win! You unlocked <Text style={{ color: '#FBBF24', fontWeight: '900' }}>{activeSavingsText}</Text>
              </Text>
            </View>
          );
        })()}
        

        {/* Bill Details Card */}
        <View style={styles.billCard}>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Total</Text>
            <Text style={styles.billValue}>₹{total.toFixed(2)}</Text>
          </View>
          
          <TouchableOpacity
            style={styles.billRow}
            onPress={() => setIsGstExpanded(!isGstExpanded)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.billLabel}>GST</Text>
              <Feather
                name={isGstExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#555"
              />
            </View>
            <Text style={styles.billValue}>₹{gst.toFixed(2)}</Text>
          </TouchableOpacity>

          {isGstExpanded && (() => {
            const foodCgst = (foodGst / 2).toFixed(2);
            const foodSgst = (foodGst / 2).toFixed(2);
            const delCgst = (deliveryGst / 2).toFixed(2);
            const delSgst = (deliveryGst / 2).toFixed(2);
            return (
              <View style={{ backgroundColor: '#F4F6F8', borderRadius: 10, padding: 12, marginVertical: 6, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B', marginBottom: 4 }}>
                  Food GST (5%): ₹{foodGst.toFixed(2)}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 12, marginVertical: 1 }}>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>CGST (2.5%)</Text>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>₹{foodCgst}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 12, marginVertical: 1 }}>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>SGST (2.5%)</Text>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>₹{foodSgst}</Text>
                </View>

                {deliveryGst > 0 && (
                  <>
                    <View style={{ height: 1, backgroundColor: '#CBD5E1', marginVertical: 8 }} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B', marginBottom: 4 }}>
                      Delivery GST (18%): ₹{deliveryGst.toFixed(2)}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 12, marginVertical: 1 }}>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>CGST (9.0%)</Text>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>₹{delCgst}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 12, marginVertical: 1 }}>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>SGST (9.0%)</Text>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>₹{delSgst}</Text>
                    </View>
                  </>
                )}
              </View>
            );
          })()}

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>
              Delivery fee {isLocationFetched ? `(${distanceStr})` : ''}
            </Text>
            <Text style={styles.billValue}>
              {isLocationFetched ? `₹${baseDeliveryFee.toFixed(2)}` : 'To be calculated'}
            </Text>
          </View>
          {isSurgeOn && (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: '#FF5E5E', fontWeight: '600' }]}>
                ⚡ Surge fee (high demand)
              </Text>
              <Text style={[styles.billValue, { color: '#FF5E5E', fontWeight: '600' }]}>
                ₹{Number(feesConfig.surgeFee).toFixed(2)}
              </Text>
            </View>
          )}
          

          {restaurantTieredDiscount > 0 ? (() => {
            const isActiveFlat = activeTier?.discountType === 'flat' || (Number(activeTier?.discountAmount) > 0 && !activeTier?.discountPercentage);
            const badgeLabel = isActiveFlat ? `₹${activeTier?.discountAmount}` : `${activeTier?.discountPercentage}%`;
            return (
              <View style={[styles.billRow, { backgroundColor: '#008000', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginVertical: 4 }]}>
                <Text style={[styles.billLabel, { color: '#FFFFFF', fontWeight: '800', fontSize: 14.5 }]}>
                  🎉 You have saved ({badgeLabel})
                </Text>
                <Text style={[styles.billValue, { color: '#FFFFFF', fontWeight: '900', fontSize: 16 }]}>
                  -₹{restaurantTieredDiscount.toFixed(2)}
                </Text>
              </View>
            );
          })() : null}
          {discountAmount > 0 ? (
            <View style={[styles.billRow, { backgroundColor: '#008000', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginVertical: 4 }]}>
              <Text style={[styles.billLabel, { color: '#FFFFFF', fontWeight: '800', fontSize: 14.5 }]}>
                Coupon Discount ({appliedCoupon?.couponCode})
              </Text>
              <Text style={[styles.billValue, { color: '#FFFFFF', fontWeight: '900', fontSize: 16 }]}>
                -₹{discountAmount.toFixed(2)}
              </Text>
            </View>
          ) : null}

          <View style={styles.divider} />

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Grand total</Text>
            <Text style={styles.grandTotalValue}>₹{grandTotal.toFixed(2)}</Text>
          </View>

          {coinsEarned > 0 && feesConfig.isCoinsActive !== false && (
            <>
              <View style={styles.dottedDivider} />
              {/* Coins Earned Badge */}
              <View style={styles.coinsBadge}>
                <View style={styles.coinsLeft}>
                  <FontAwesome5 name="coins" size={18} color="#FFD200" style={{ marginRight: 8 }} />
                  <Text style={styles.coinsText}>Coins you earn</Text>
                </View>
                <Text style={styles.coinsValue}>+{coinsEarned}</Text>
              </View>
            </>
          )}
        </View>

        {/* Active Order warning banner inside Cart */}
        {hasActiveOrder && (
          <View style={{
            backgroundColor: '#FDF0ED',
            borderColor: '#F8D7DA',
            borderWidth: 1,
            borderRadius: 16,
            padding: 16,
            marginHorizontal: 16,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12
          }}>
            <Ionicons name="alert-circle-outline" size={24} color="#D32F2F" />
            <Text style={{
              flex: 1,
              fontSize: 13,
              color: '#C62828',
              lineHeight: 18,
              fontWeight: 'bold'
            }}>
              You already have an active order in progress. Please wait for your ongoing order to be completed before placing a new one.
            </Text>
          </View>
        )}



        {/* Action Buttons Row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.clearButton} onPress={clearCart} activeOpacity={0.85}>
            <Text style={styles.clearButtonText}>Clear all</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.checkoutButton, (showDeliveryForm || hasActiveOrder) && styles.checkoutButtonDisabled]}
            onPress={handlePlaceOrder}
            disabled={showDeliveryForm || hasActiveOrder}
            activeOpacity={0.85}
          >
            <Text style={styles.checkoutButtonText}>
              Place the order
            </Text>
          </TouchableOpacity>
        </View>

        {/* Delivery Address Section */}
        {showDeliveryForm && (() => {
          const selectedSavedAddressObj = savedAddresses.find(
            (addr) => (addr.id || addr._id) === selectedSavedAddressId
          );

          return (
            <View style={styles.addressSectionContainer}>
              <Text style={styles.addressSectionTitle}>Delivery address</Text>

              {/* Option 1: Use Current Location Button */}
              <TouchableOpacity
                style={[
                  styles.savedAddressCard,
                  !selectedSavedAddressId && styles.savedAddressCardSelected,
                  {
                    backgroundColor: !selectedSavedAddressId ? '#E8F5E9' : 'rgb(224, 214, 188)',
                    borderColor: !selectedSavedAddressId ? '#2E7D32' : '#C8BEA7',
                    marginBottom: 16
                  }
                ]}
                onPress={handleUseCurrentLocation}
                activeOpacity={0.85}
              >
                <View style={styles.savedCardLeft}>
                  <Ionicons
                    name="navigate-circle"
                    size={26}
                    color={!selectedSavedAddressId ? '#2E7D32' : '#FF9800'}
                    style={{ marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.savedCardTag, !selectedSavedAddressId && { color: '#1B5E20' }]}>
                      Use Current Location
                    </Text>
                  </View>
                </View>
                {!selectedSavedAddressId && (
                  <View style={{ backgroundColor: '#27AE60', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' }}>SELECTED</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Option 2: Address Button Dropdown (if user has saved addresses) */}
              {savedAddresses.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <TouchableOpacity
                    style={[
                      styles.savedAddressCard,
                      Boolean(selectedSavedAddressId) && styles.savedAddressCardSelected,
                      { borderColor: selectedSavedAddressId ? '#1A1A1A' : '#C8BEA7', marginBottom: isSavedAddressesExpanded ? 8 : 16 }
                    ]}
                    onPress={() => setIsSavedAddressesExpanded(!isSavedAddressesExpanded)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.savedCardLeft}>
                      <Ionicons
                        name={selectedSavedAddressObj ? ((selectedSavedAddressObj.tag || selectedSavedAddressObj.label) === 'Home' ? 'home' : (selectedSavedAddressObj.tag || selectedSavedAddressObj.label) === 'Office' ? 'briefcase' : 'business') : 'bookmarks'}
                        size={22}
                        color="#1A1A1A"
                        style={{ marginRight: 10 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.savedCardTag}>
                          {selectedSavedAddressObj
                            ? `${selectedSavedAddressObj.tag || 'Selected Address'}`
                            : 'Select Delivery Address'}
                        </Text>
                        <Text style={styles.savedCardDetails} numberOfLines={1}>
                          {selectedSavedAddressObj
                            ? `${selectedSavedAddressObj.flatNo || ''}, ${selectedSavedAddressObj.street || ''}`
                            : `Tap to choose from your ${savedAddresses.length} address${savedAddresses.length > 1 ? 'es' : ''}`}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={isSavedAddressesExpanded ? 'chevron-up' : 'chevron-down'}
                      size={22}
                      color="#1A1A1A"
                    />
                  </TouchableOpacity>

                  {/* Expanded Address List */}
                  {isSavedAddressesExpanded && (
                    <View style={{ marginTop: 4 }}>
                      <Text style={styles.savedAddressesLabel}>Your addresses:</Text>
                      {Array.isArray(savedAddresses) && savedAddresses.map((addr, addrIdx) => {
                        if (!addr || typeof addr !== 'object') return null;
                        const addressId = String(addr.id || addr._id || `cart-addr-${addrIdx}`);
                        const isSelected = String(selectedSavedAddressId) === addressId;
                        return (
                          <TouchableOpacity
                            key={addressId}
                            style={[
                              styles.savedAddressCard,
                              isSelected && styles.savedAddressCardSelected,
                              { backgroundColor: isSelected ? '#E8F5E9' : '#F2EBDA', borderColor: isSelected ? '#2E7D32' : '#C8BEA7' }
                            ]}
                            onPress={() => handlePrefillAddress(addr)}
                            activeOpacity={0.9}
                          >
                            <View style={styles.savedCardLeft}>
                              <Ionicons
                                name={(addr.tag || addr.label) === 'Home' ? 'home' : (addr.tag || addr.label) === 'Office' ? 'briefcase' : 'business'}
                                size={20}
                                color={isSelected ? '#2E7D32' : '#1A1A1A'}
                                style={{ marginRight: 10 }}
                              />
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.savedCardTag, isSelected && { color: '#1B5E20' }]}>{addr.tag || addr.label || 'Address'}</Text>
                                <Text style={styles.savedCardDetails} numberOfLines={2}>
                                  {`${addr.flatNo || ''}, ${addr.street || ''}${addr.landmark ? ', ' + addr.landmark : ''}`}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.savedCardRight}>
                              {isSelected && (
                                <View style={{ backgroundColor: '#27AE60', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, marginRight: 8 }}>
                                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' }}>SELECTED</Text>
                                </View>
                              )}
                              <TouchableOpacity
                                style={styles.deleteAddressDustbin}
                                onPress={() => handleDeleteAddress(addressId)}
                                activeOpacity={0.7}
                              >
                                <Feather name="trash-2" size={18} color="#FF5E5E" />
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Address Input Fields (Shown when 'Use Current Location' is selected) */}
              {!selectedSavedAddressId && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.savedAddressesLabel, { color: '#1A1A1A', fontWeight: 'bold' }]}>
                    Enter details for current location:
                  </Text>

                  <TextInput
                    style={styles.addressInput}
                    placeholder="Flat no / house no"
                    placeholderTextColor="#8A8A8A"
                    value={flatNo}
                    onChangeText={setFlatNo}
                  />

                  <TextInput
                    style={styles.addressInput}
                    placeholder="Street / Area / Colony"
                    placeholderTextColor="#8A8A8A"
                    value={street}
                    onChangeText={setStreet}
                  />

                  <TextInput
                    style={styles.addressInput}
                    placeholder="Land Mark"
                    placeholderTextColor="#8A8A8A"
                    value={landmark}
                    onChangeText={setLandmark}
                  />

                  {/* Tags Selectors */}
                  <View style={styles.tagSelectorContainer}>
                    {['Home', 'Office', 'Apartment', 'Other'].map((tag) => {
                      const isActive = selectedTag === tag;
                      return (
                        <TouchableOpacity
                          key={tag}
                          style={[styles.tagButton, isActive && styles.tagButtonActive]}
                          onPress={() => setSelectedTag(tag)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.tagText, isActive && styles.tagTextActive]}>
                            {tag}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Custom Name Input when 'Other' tag is selected */}
                  {selectedTag === 'Other' && (
                    <TextInput
                      style={[styles.addressInput, { marginTop: 10 }]}
                      placeholder="Name of this place (e.g. Friend's House, Gym, Hostel)"
                      placeholderTextColor="#8A8A8A"
                      value={customTag}
                      onChangeText={setCustomTag}
                      autoCapitalize="words"
                    />
                  )}

                  {/* Save Address Button */}
                  <TouchableOpacity
                    style={[styles.saveAddressButton, hasActiveOrder && { backgroundColor: '#CCC' }]}
                    onPress={handleSaveAddress}
                    disabled={hasActiveOrder}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.saveAddressButtonText}>Save Address</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Delivery Intimation Banner (Clickable to open Google Maps) */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#E8F5E9',
                  borderColor: '#2E7D32',
                  borderWidth: 1.5,
                  borderRadius: 20,
                  padding: 14,
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12
                }}
                onPress={openGoogleMapsForSelectedLocation}
                activeOpacity={0.85}
              >
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: '#27AE60',
                  alignItems: 'center',
                  justifyContent: 'center',
                  alignSelf: 'center'
                }}>
                  <Ionicons name="location" size={24} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, justifyContent: 'center', paddingTop: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#1B5E20', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Order will be delivered to:
                    </Text>
                    <View style={{ backgroundColor: '#27AE60', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' }}>SELECTED</Text>
                    </View>
                  </View>

                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1A1A1A', marginTop: 1, marginBottom: 1 }} numberOfLines={2}>
                    {selectedSavedAddressId && selectedSavedAddressObj
                      ? `${selectedSavedAddressObj.tag || 'Selected Location'}: ${selectedSavedAddressObj.flatNo || ''}, ${selectedSavedAddressObj.street || ''}${selectedSavedAddressObj.landmark ? ' (Near ' + selectedSavedAddressObj.landmark + ')' : ''}`
                      : (flatNo.trim() || street.trim())
                        ? `Live GPS Location (${selectedTag}): ${flatNo ? flatNo + ', ' : ''}${street}${landmark ? ' (Near ' + landmark + ')' : ''}`
                        : 'Current GPS Location'}
                  </Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                    <Ionicons name="map-outline" size={13} color="#2E7D32" />
                    <Text style={{ fontSize: 11, color: '#2E7D32', fontWeight: 'bold' }}>
                      Tap to open in Google Maps ↗
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Confirm Order Button */}
              <TouchableOpacity
                style={[styles.confirmOrderButton, (hasActiveOrder || (!flatNo.trim() || !street.trim())) && { backgroundColor: '#CCC' }]}
                onPress={handleConfirmOrder}
                disabled={hasActiveOrder}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmOrderButtonText}>
                  {hasActiveOrder
                    ? 'Active order in progress'
                    : (!flatNo.trim() || !street.trim())
                      ? 'Please enter flat & street details'
                      : `Confirm order and pay ₹${grandTotal.toFixed(2)}`}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })()}
      </ScrollView>

      {/* Processing Payment Full Screen Loading Overlay Modal */}
      <Modal
        visible={isProcessingPayment}
        transparent={false}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => {}}
      >
        <View style={{ flex: 1, width: '100%', height: '100%', backgroundColor: 'rgb(247, 247, 235)' }}>
          <LoadingView />
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { position: 'relative' }]}>
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
              onPress={() => setShowSuccessModal(false)}
              activeOpacity={0.7}
            >
              <Feather name="x" size={18} color="#1E3545" />
            </TouchableOpacity>
            {/* Green Check Circle */}
            <View style={styles.checkmarkOuter}>
              <View style={styles.checkmarkInner}>
                <Ionicons name="checkmark" size={38} color="#FFFFFF" />
              </View>
            </View>

            {/* Title */}
            <Text style={styles.modalTitle}>Order Placed{"\n"}Successfully! 🎉</Text>

            {/* Divider Line */}
            <View style={styles.modalDivider} />

            {/* Subtitle */}
            <Text style={styles.modalSubtitle}>
              Your order has been received and is being prepared. Thank you for ordering with us!
            </Text>

            {/* Button */}
            <TouchableOpacity
              style={styles.modalButton}
              activeOpacity={0.85}
              onPress={() => {
                setCartItems([]);
                setShowDeliveryForm(false);
                setShowSuccessModal(false);
                router.replace('/orderstatus');
              }}
            >
              <Text style={styles.modalButtonText}>Track Order & View Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Alert Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={customAlert.visible}
        onRequestClose={() => setCustomAlert({ ...customAlert, visible: false })}
      >
        <View style={styles.alertBackdrop}>
          <View style={[styles.alertCard, { position: 'relative' }]}>
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
              onPress={() => setCustomAlert({ ...customAlert, visible: false })}
              activeOpacity={0.7}
            >
              <Feather name="x" size={18} color="#1E3545" />
            </TouchableOpacity>
            <View style={[styles.alertIconContainer, { backgroundColor: '#FDF0ED' }]}>
              <Feather name="x" size={32} color="#E05A47" />
            </View>
            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            <Text style={styles.alertMessage}>{customAlert.message}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.alertButton,
                pressed && { opacity: 0.85 }
              ]}
              onPress={() => {
                const onOkCallback = customAlert.onOk;
                setCustomAlert({ visible: false, title: '', message: '', onOk: null });
                if (typeof onOkCallback === 'function') {
                  onOkCallback();
                }
              }}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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

      {/* Phone Number OTP Verification Modal */}
      <Modal
        visible={showPhoneOTPModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!otpLoading) setShowPhoneOTPModal(false);
        }}
      >
        <View style={styles.alertBackdrop}>
          <View style={[styles.alertCard, { backgroundColor: '#F9F9F6', padding: 24, maxWidth: 320, position: 'relative' }]}>
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
              onPress={() => {
                if (!otpLoading) setShowPhoneOTPModal(false);
              }}
              activeOpacity={0.7}
            >
              <Feather name="x" size={18} color="#1E3545" />
            </TouchableOpacity>
            <View style={[styles.alertIconContainer, { backgroundColor: '#1E3545', marginBottom: 15 }]}>
              <Feather name="phone" size={28} color="#FFFFFF" />
            </View>

            {!confirmResult ? (
              // Step 1: Input Phone Number
              <>
                <Text style={styles.alertTitle}>Verify Phone Number</Text>
                <Text style={styles.alertMessage}>
                  Please enter your 10-digit mobile number to complete your order.
                </Text>

                <View style={[styles.addressInput, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCD3C5', paddingHorizontal: 12, marginBottom: 20 }]}>
                  <Text style={{ fontSize: 16, color: '#7E7C77', fontWeight: 'bold', marginRight: 5 }}>+91</Text>
                  <TextInput
                    style={{ flex: 1, fontSize: 16, color: '#1A1A1A', padding: 0 }}
                    placeholder="Enter Mobile Number"
                    placeholderTextColor="#A19E95"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={verificationPhone}
                    onChangeText={setVerificationPhone}
                    editable={!otpLoading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.alertButton, otpLoading && { opacity: 0.6 }]}
                  onPress={() => handleSendOTP(false)}
                  disabled={otpLoading}
                >
                  {otpLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.alertButtonText}>Send OTP</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ marginTop: 15 }}
                  onPress={() => setShowPhoneOTPModal(false)}
                  disabled={otpLoading}
                >
                  <Text style={{ color: '#E05A47', fontWeight: '700', fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Step 2: Input OTP Code
              <>
                <Text style={styles.alertTitle}>Enter OTP</Text>
                <Text style={styles.alertMessage}>
                  We sent a 6-digit verification code to +91 {verificationPhone.trim().slice(-10)}.
                </Text>

                <TextInput
                  style={[styles.addressInput, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCD3C5', textAlign: 'center', fontSize: 20, letterSpacing: 5, fontWeight: 'bold', marginBottom: 20 }]}
                  placeholder="------"
                  placeholderTextColor="#A19E95"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  editable={!otpLoading}
                />

                <TouchableOpacity
                  style={[styles.alertButton, otpLoading && { opacity: 0.6 }]}
                  onPress={handleVerifyOTP}
                  disabled={otpLoading}
                >
                  {otpLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.alertButtonText}>Verify & Pay</Text>
                  )}
                </TouchableOpacity>

                {resendTimer > 0 ? (
                  <Text style={{ marginTop: 15, color: '#7E7C77', fontSize: 13, fontWeight: '600' }}>
                    Resend code in {resendTimer}s
                  </Text>
                ) : (
                  <TouchableOpacity
                    style={{ marginTop: 15 }}
                    onPress={() => handleSendOTP(true)}
                    disabled={otpLoading}
                  >
                    <Text style={{ color: '#1E3545', fontWeight: '700', fontSize: 14 }}>Resend OTP</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={{ marginTop: 12 }}
                  onPress={() => setConfirmResult(null)}
                  disabled={otpLoading}
                >
                  <Text style={{ color: '#E05A47', fontWeight: '700', fontSize: 14 }}>Back</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Select Delivery Location Modal */}
      <Modal
        transparent
        visible={showLocationChoiceModal}
        animationType="slide"
        onRequestClose={() => setShowLocationChoiceModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '85%', maxWidth: 360, maxHeight: '80%', backgroundColor: 'rgb(224, 214, 188)', borderRadius: 30, padding: 22, alignItems: 'center', position: 'relative' }}>
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
              onPress={() => setShowLocationChoiceModal(false)}
              activeOpacity={0.7}
            >
              <Feather name="x" size={18} color="#1E3545" />
            </TouchableOpacity>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#F0F6F0', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}>
              <Feather name="map-pin" size={28} color="#2B783E" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1E3545', textAlign: 'center', marginBottom: 6 }}>
              Select Delivery Location
            </Text>
            <Text style={{ fontSize: 13, color: '#666666', textAlign: 'center', marginBottom: 18 }}>
              Please choose where you would like your food delivered:
            </Text>

            <ScrollView style={{ width: '100%', maxHeight: 280, marginBottom: 15 }} showsVerticalScrollIndicator={false}>
              {/* Option A: Use Current Location */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E4E1D8',
                  borderWidth: 1,
                  borderRadius: 18,
                  marginBottom: 12,
                  gap: 14
                }}
                activeOpacity={0.8}
                onPress={handleUseCurrentLocation}
              >
                <Feather name="navigation" size={22} color="#2B783E" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E3545' }}>Use Current Location</Text>
                  <Text style={{ fontSize: 12, color: '#808C94', marginTop: 2 }}>Locate me using my device&apos;s GPS</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#2B783E" />
              </TouchableOpacity>

              {/* Option B: Saved Addresses list */}
              {Array.isArray(savedAddresses) && savedAddresses.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: '#000000', fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Saved Addresses
                  </Text>
                  {savedAddresses.map((addr, addrIdx) => {
                    if (!addr || typeof addr !== 'object') return null;
                    const addrId = String(addr.id || addr._id || `cart-modal-addr-${addrIdx}`);
                    const isSelected = String(selectedSavedAddressId) === addrId;
                    const tagLabel = addr.tag || addr.label || 'Address';
                    return (
                      <TouchableOpacity
                        key={addrId}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 14,
                          backgroundColor: isSelected ? '#F0F6F0' : '#FFFFFF',
                          borderColor: isSelected ? '#2B783E' : '#E4E1D8',
                          borderWidth: 1,
                          borderRadius: 16,
                          marginBottom: 8,
                          gap: 12
                        }}
                        activeOpacity={0.8}
                        onPress={() => {
                          setShowLocationChoiceModal(false);
                          handlePrefillAddress(addr);
                          setShowDeliveryForm(true);
                        }}
                      >
                        <Feather name={tagLabel === 'Home' ? 'home' : tagLabel === 'Office' ? 'briefcase' : 'map-pin'} size={20} color={isSelected ? '#2B783E' : '#1E3545'} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: isSelected ? '#2B783E' : '#1E3545' }}>
                            {tagLabel}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#808C94', marginTop: 1 }} numberOfLines={1}>
                            {addr.flatNo ? `${addr.flatNo}, ` : ''}{addr.street || ''}
                          </Text>
                        </View>
                        {isSelected ? (
                          <Feather name="check" size={18} color="#2B783E" />
                        ) : (
                          <Feather name="chevron-right" size={16} color="#808C94" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* Cancel Button */}
            <TouchableOpacity
              style={{ width: '100%', paddingVertical: 10, alignItems: 'center' }}
              onPress={() => setShowLocationChoiceModal(false)}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#666666', textDecorationLine: 'underline' }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Select Payment Method Modal */}
      <Modal
        visible={showPaymentChoiceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentChoiceModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { position: 'relative', padding: 22, maxWidth: 360 }]}>
            {/* Top Right Close X Button */}
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
              onPress={() => setShowPaymentChoiceModal(false)}
              activeOpacity={0.7}
            >
              <Feather name="x" size={18} color="#1E3545" />
            </TouchableOpacity>

            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="card-outline" size={28} color="#27AE60" />
            </View>

            <Text style={{ fontSize: 20, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', marginBottom: 4 }}>
              Select Payment Method
            </Text>
            <Text style={{ fontSize: 13, color: '#666666', textAlign: 'center', marginBottom: 18 }}>
              Choose your preferred payment option:
            </Text>

            {/* Option 1: Pay Online (Razorpay) */}
            <TouchableOpacity
              disabled={isProcessingPayment}
              style={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                borderColor: '#27AE60',
                borderWidth: 1.5,
                borderRadius: 18,
                padding: 16,
                marginBottom: 12,
                gap: 12,
                opacity: isProcessingPayment ? 0.6 : 1
              }}
              onPress={() => {
                if (isProcessingPayment) return;
                setShowPaymentChoiceModal(false);
                processOnlinePayment();
              }}
              activeOpacity={0.85}
            >
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="card" size={22} color="#27AE60" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' }}>
                  Pay Online
                </Text>
                <Text style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>
                  Razorpay / UPI / Cards / NetBanking
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#27AE60" />
            </TouchableOpacity>

            {/* Option 2: UPI On Delivery */}
            <TouchableOpacity
              disabled={isProcessingPayment}
              style={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                borderColor: '#E4E1D8',
                borderWidth: 1.5,
                borderRadius: 18,
                padding: 16,
                marginBottom: 16,
                gap: 12,
                opacity: isProcessingPayment ? 0.6 : 1
              }}
              onPress={() => {
                if (isProcessingPayment) return;
                setShowPaymentChoiceModal(false);
                processCodPayment();
              }}
              activeOpacity={0.85}
            >
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="qr-code-outline" size={22} color="#E65100" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' }}>
                  UPI On Delivery
                </Text>
                <Text style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>
                  Pay via UPI QR Code or cash at doorstep
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#E65100" />
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      {/* Fetching Location Loading Overlay Modal */}
      <Modal transparent visible={Boolean(isFetchingLocation || showFetchingModal)} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '85%', maxWidth: 320, backgroundColor: 'rgb(224, 214, 188)', borderRadius: 30, padding: 24, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#1a1a1a" style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1E3545', textAlign: 'center', marginBottom: 6 }}>Fetching Location</Text>
            <Text style={{ fontSize: 13, color: '#666666', textAlign: 'center', lineHeight: 18 }}>
              Retrieving your coordinates and calculating delivery distances...
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: 'rgb(247, 247, 235)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 160, // ample padding to clear floating navbar
  },
  container: {
    flex: 1,
    backgroundColor: 'rgb(247, 247, 235)',
    paddingHorizontal: 20,
  },
  restaurantTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginVertical: 18,
    fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'serif',
  },
  itemsListContainer: {
    gap: 12,
    marginBottom: 16,
  },
  cartCard: {
    backgroundColor: 'rgb(224, 214, 188)',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 12,
  },
  quantityBtn: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1A1A1A',
    minWidth: 40,
    textAlign: 'right',
  },
  billCard: {
    backgroundColor: 'rgb(224, 214, 188)',
    borderRadius: 20,
    padding: 16,
    marginVertical: 10,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  billLabel: {
    fontSize: 15,
    color: '#333333',
    fontWeight: '500',
  },
  billValue: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#C8BEA7',
    marginVertical: 12,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  dottedDivider: {
    borderStyle: 'dashed',
    borderWidth: 0.5,
    borderColor: '#C8BEA7',
    marginVertical: 12,
    height: 1,
  },
  coinsBadge: {
    backgroundColor: '#008000',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  coinsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinsText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  coinsValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 24,
    gap: 12,
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#FF5E5E',
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF5E5E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  checkoutButton: {
    flex: 1.2,
    backgroundColor: '#008000',
    borderRadius: 32,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#008000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8E2D4',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E3545',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: '#808C94',
    textAlign: 'center',
    lineHeight: 23,
  },
  orderButton: {
    marginTop: 16,
    backgroundColor: '#1E3545',
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 36,
    alignSelf: 'center',
    alignItems: 'center',
  },
  orderButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  checkoutButtonDisabled: {
    backgroundColor: '#C8BEA7',
  },
  addressSectionContainer: {
    marginTop: 20,
    backgroundColor: 'transparent',
  },
  addressSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
    fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'serif',
  },
  addressInput: {
    backgroundColor: 'rgb(224, 214, 188)',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
    fontSize: 15,
    color: '#1A1A1A',
    marginBottom: 12,
    outlineStyle: 'none',
  },
  tagSelectorContainer: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  tagButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C8BEA7',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagButtonActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  tagText: {
    color: '#1A1A1A',
    fontSize: 13,
    fontWeight: '600',
  },
  tagTextActive: {
    color: '#FFFFFF',
  },
  saveAddressButton: {
    backgroundColor: '#FF5E5E',
    borderRadius: 32,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    shadowColor: '#FF5E5E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  saveAddressButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  savedSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  savedAddressesLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
    marginBottom: 12,
  },
  savedAddressCard: {
    backgroundColor: 'rgb(224, 214, 188)',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#C8BEA7',
    marginBottom: 12,
  },
  savedAddressCardSelected: {
    borderColor: '#1A1A1A',
    borderWidth: 2,
  },
  savedCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  savedCardTag: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  savedCardDetails: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  deleteAddressIcon: {
    padding: 6,
  },
  viewMoreButton: {
    backgroundColor: '#F5C55F',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  viewMoreButtonText: {
    color: '#1A1A1A',
    fontWeight: 'bold',
    fontSize: 14,
  },
  confirmOrderButton: {
    backgroundColor: '#008000',
    borderRadius: 35,
    paddingVertical: 18,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 24,
    shadowColor: '#008000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  confirmOrderButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 17,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  savedCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteAddressDustbin: {
    padding: 6,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  couponCard: {
    backgroundColor: 'rgb(224, 214, 188)',
    borderRadius: 20,
    padding: 16,
    marginVertical: 10,
  },
  couponTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  couponInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  couponInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 15,
    fontSize: 14,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#C8BEA7',
  },
  couponApplyBtn: {
    backgroundColor: '#1E3545',
    borderRadius: 15,
    paddingVertical: 11,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponApplyBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  appliedCouponContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E2F0D9',
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: '#27AE60',
  },
  appliedCouponLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appliedCouponCode: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#27AE60',
  },
  appliedCouponSub: {
    fontSize: 12,
    color: '#666',
  },
  couponRemoveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  couponRemoveBtnText: {
    color: '#FF5E5E',
    fontWeight: 'bold',
    fontSize: 13,
  },
  couponErrorText: {
    color: '#D32F2F',
    fontSize: 13,
    marginTop: 8,
    fontWeight: '600',
  },
  couponSuccessText: {
    color: '#27AE60',
    fontSize: 13,
    marginTop: 8,
    fontWeight: '600',
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
  alertBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertCard: {
    backgroundColor: 'rgb(224, 214, 188)',
    borderRadius: 30,
    width: '85%',
    maxWidth: 340,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  modalContent: {
    backgroundColor: 'rgb(224, 214, 188)',
    borderRadius: 30,
    width: '85%',
    maxWidth: 340,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  alertIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FDF0ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkmarkOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkmarkInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#27AE60',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E3545',
    textAlign: 'center',
    marginBottom: 10,
  },
  alertMessage: {
    fontSize: 14,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E8E8E8',
    marginVertical: 15,
  },
  alertButton: {
    backgroundColor: '#E05A47',
    borderRadius: 30,
    paddingVertical: 15,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E05A47',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  modalButton: {
    backgroundColor: '#27AE60',
    borderRadius: 30,
    paddingVertical: 15,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#27AE60',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  alertButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
});



























