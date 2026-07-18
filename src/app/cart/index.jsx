import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { checkLocationAndCalculateDistances } from '../../store/locationSlice';
import LoadingView from '../../components/LoadingView';
import { API_URL } from '../../config';
// Lazily require Firebase Auth to avoid crash when native module is not linked
let auth = null;
if (Platform.OS !== 'web') {
  try {
    auth = require('@react-native-firebase/auth').default;
  } catch (e) {
    console.warn('[Cart] Firebase Auth native module not available:', e.message);
  }
}

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const userLocation = useSelector((state) => state.location.userLocation);
  const roadDistances = useSelector((state) => state.location.roadDistances);
  const locationStatus = useSelector((state) => state.location.locationStatus);
  const selectedSavedAddressIdRedux = useSelector((state) => state.location.selectedSavedAddressId);
  const restaurants = useSelector((state) => state.restaurants.list);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Address flow states
  const [userid, setUserid] = useState(null);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [flatNo, setFlatNo] = useState('');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [selectedTag, setSelectedTag] = useState('Home'); // Home, Office, Apartment, Other
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState(null);
  const [customAlert, setCustomAlert] = useState({ visible: false, title: '', message: '' });
  const [hasActiveOrder, setHasActiveOrder] = useState(false);
  const [feesConfig, setFeesConfig] = useState({
    deliveryFeeBase: 20,
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
      const response = await fetch(`${API_URL}/api/coupon/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          couponCode: couponInput.trim(),
          cartTotal: calculateTotal(),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setAppliedCoupon({
          couponCode: data.couponCode,
          influencerName: data.influencerName,
          discountType: data.discountType,
          discountValue: data.discountValue,
          discountAmount: data.discountAmount,
        });
        triggerToast('COUPON APPLIED SUCCESSFULLY!', 'success');
      } else {
        setCouponError(data.message || 'Invalid coupon code.');
        setAppliedCoupon(null);
      }
    } catch (error) {
      console.error('Error validating coupon:', error);
      setCouponError('Failed to validate coupon. Please try again.');
      setAppliedCoupon(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError('');
    triggerToast('Coupon removed.', 'warning');
  };

  // Phone OTP Verification States
  const [showPhoneOTPModal, setShowPhoneOTPModal] = useState(false);
  const [verificationPhone, setVerificationPhone] = useState('');
  const [firstInputPhone, setFirstInputPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmResult, setConfirmResult] = useState(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const resendCountRef = useRef(0);
  const [isBypassMode, setIsBypassMode] = useState(false);

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

  const showAlert = (title, message) => {
    setCustomAlert({
      visible: true,
      title,
      message,
    });
  };

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
      if (cartData) {
        setCartItems(JSON.parse(cartData));
      } else {
        setCartItems([]);
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
      const response = await fetch(`${API_URL}/fees-config`);
      const data = await response.json();
      if (data.success && data.config) {
        setFeesConfig(data.config);
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
              setHasActiveOrder(true);
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
          setShowDeliveryForm(true);
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

  const handlePlaceOrder = () => {
    setShowDeliveryForm(true);
  };

  const handleSaveAddress = async () => {
    if (!flatNo || !street) {
      Alert.alert('Validation Error', 'Please enter Flat/House No and Street.');
      return;
    }
    if (!userid) {
      Alert.alert('Authentication Error', 'User not logged in.');
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
      Alert.alert('Already Saved', 'This address is already saved in your address book.');
      return;
    }

    // --- OPTIMISTIC UPDATE FOR NO LATENCY ---
    const tempId = `temp_${Date.now()}`;
    const newAddressObj = {
      _id: tempId,
      id: tempId,
      flatNo,
      street,
      landmark,
      tag: selectedTag,
      lat: userLocation ? userLocation.latitude : null,
      lng: userLocation ? userLocation.longitude : null,
    };

    const updatedAddresses = [...savedAddresses, newAddressObj];
    
    // 1. Instantly update state & cache
    setSavedAddresses(updatedAddresses);
    await AsyncStorage.setItem(`saved_addresses_${userid}`, JSON.stringify(updatedAddresses));
    
    // 2. Instantly show toast
    triggerToast('ADDRESS SAVED SUCCESSFULLY!', 'success');

    // 3. Keep inputs backup and instantly reset fields
    const savedFlatNo = flatNo;
    const savedStreet = street;
    const savedLandmark = landmark;
    const savedTag = selectedTag;

    setFlatNo('');
    setStreet('');
    setLandmark('');
    setSelectedTag('Home');
    setSelectedSavedAddressId(null);

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
          setSavedAddresses(data.addresses || []);
          await AsyncStorage.setItem(`saved_addresses_${userid}`, JSON.stringify(data.addresses || []));
        } else {
          // Revert and fetch actual db addresses
          fetchSavedAddresses(userid);
          Alert.alert('Error', data.message || 'Failed to save address to database.');
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
          Alert.alert('Error', data.message || 'Failed to delete address from database.');
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
      const formattedPhone = `+91${verificationPhone.trim().slice(-10)}`;
      console.log('[Phone Auth] Requesting OTP for:', formattedPhone);

      // Save the first input phone number (slice last 10 digits)
      const cleanFirstPhone = verificationPhone.trim().slice(-10);
      setFirstInputPhone(cleanFirstPhone);

      const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
      setConfirmResult(confirmation);
      triggerToast(isResend ? 'OTP Resent Successfully!' : 'OTP Sent Successfully!', 'success');
      setResendTimer(30);

      if (isResend) {
        resendCountRef.current += 1;
        if (resendCountRef.current >= 2) {
          setIsBypassMode(true);
          setVerificationPhone(''); // Clear it so they must re-enter to confirm!
        }
      }
    } catch (error) {
      console.error('[Phone Auth] Send OTP Error:', error);
      if (error.code === 'auth/too-many-requests' || error.message?.includes('blocked')) {
        showAlert('Temporarily Blocked', 'Too many requests. Switching to verbal confirmation.');
        const cleanFirstPhone = verificationPhone.trim().slice(-10);
        setFirstInputPhone(cleanFirstPhone);
        setIsBypassMode(true);
        setVerificationPhone(''); // Clear it so they must re-enter to confirm!
      } else {
        // If they click resend and it fails due to network/etc., check if resend count reached 2
        if (isResend) {
          resendCountRef.current += 1;
          if (resendCountRef.current >= 2) {
            showAlert('Switching to Verbal Confirmation', 'SMS service is not responding. Please confirm your number.');
            const cleanFirstPhone = verificationPhone.trim().slice(-10);
            setFirstInputPhone(cleanFirstPhone);
            setIsBypassMode(true);
            setVerificationPhone(''); // Clear it so they must re-enter to confirm!
          } else {
            showAlert('OTP Send Failed', 'Failed to send OTP. Please check your network or try again.');
          }
        } else {
          showAlert('OTP Send Failed', 'Failed to send OTP. Please check your network or try again.');
        }
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 6) {
      showAlert('Invalid OTP', 'Please enter the 6-digit verification code.');
      return;
    }

    setOtpLoading(true);
    try {
      console.log('[Phone Auth] Confirming OTP code:', otpCode);
      await confirmResult.confirm(otpCode);
      console.log('[Phone Auth] Verification successful!');

      const cleanPhone = verificationPhone.trim().slice(-10);
      await saveVerifiedPhoneToBackend(cleanPhone, true);
    } catch (error) {
      console.error('[Phone Auth] OTP verification error:', error);
      showAlert('Verification Failed', 'The code you entered is invalid or expired. Please try again.');
      setOtpLoading(false);
    }
  };

  const handleBypassSubmit = async () => {
    if (!verificationPhone || verificationPhone.trim().length < 10) {
      showAlert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setOtpLoading(true);
    try {
      const cleanPhone = verificationPhone.trim().slice(-10);
      
      // Verify both phone numbers are the same
      if (cleanPhone !== firstInputPhone) {
        showAlert('Verification Error', 'The phone number entered does not match the first number you entered. Please verify your number.');
        setOtpLoading(false);
        return;
      }

      console.log('[Phone Auth] Bypassing OTP, saving number as unverified:', cleanPhone);
      await saveVerifiedPhoneToBackend(cleanPhone, false);
    } catch (error) {
      console.error('[Phone Auth] Bypass submit error:', error);
      showAlert('Error saving number', 'Failed to save your phone number. Please try again.');
      setOtpLoading(false);
    }
  };

  const handleConfirmOrder = async () => {
    if (!flatNo || !street) {
      showAlert('Delivery Address Required', 'Please select a saved address or enter a delivery address manually to proceed.');
      return;
    }

    // Gated Phone Verification Check
    const activePhone = await AsyncStorage.getItem('phone');
    const isPhoneVerified = await AsyncStorage.getItem('isPhoneVerified');
    if (!activePhone || activePhone === 'N/A' || activePhone.trim() === '' || isPhoneVerified !== 'true') {
      setVerificationPhone(activePhone && activePhone !== 'N/A' ? activePhone : '');
      setOtpCode('');
      setConfirmResult(null);
      setIsBypassMode(false);
      setFirstInputPhone('');
      resendCountRef.current = 0;
      setResendTimer(0);
      setShowPhoneOTPModal(true);
      return;
    }

    const subTotal = calculateTotal();

    // Coupon Discount Calculation
    let discountValAmount = 0;
    if (appliedCoupon) {
      if (appliedCoupon.discountType === 'flat') {
        discountValAmount = Math.min(appliedCoupon.discountValue, subTotal);
      } else if (appliedCoupon.discountType === 'percentage') {
        discountValAmount = subTotal * (appliedCoupon.discountValue / 100);
      }
      discountValAmount = Math.round(discountValAmount * 100) / 100;
    }

    const gstAmount = subTotal * 0.05;
    const pFee = 2.00;
    const restId = cartItems[0]?.restId || '';
    const distanceStr = roadDistances[restId] || '';
    const distanceVal = parseFloat(distanceStr) || 0;
    const baseDeliveryFee = feesConfig.deliveryFeeBase + (distanceVal * feesConfig.deliveryFeePerKm);
    const surgeFee = (feesConfig.isSurgeActive && feesConfig.surgeFee > 0 && distanceVal > 0) ? feesConfig.surgeFee : 0;
    const deliveryFee = baseDeliveryFee + surgeFee;
    const gTotal = Math.max(0, subTotal - discountValAmount + gstAmount + pFee + deliveryFee);
    // Dynamic Coins Calculation
    const coinsMin = feesConfig.coinMinOrderAmount ?? 200;
    const coinsBase = feesConfig.coinBaseAmount ?? 10;
    const coinsStep = feesConfig.coinStepAmount ?? 100;
    const coinsStepVal = feesConfig.coinStepValue ?? 5;
    const coinsMax = feesConfig.coinMaxLimit ?? 100;
    const coinsMaxOrder = feesConfig.coinMaxThreshold ?? 1000;

    let coins = 0;
    if (feesConfig.isCoinsActive !== false) {
      if (subTotal >= coinsMaxOrder) {
        coins = coinsMax;
      } else if (subTotal > coinsMin) {
        coins = coinsBase + Math.floor((subTotal - coinsMin) / coinsStep) * coinsStepVal;
        coins = Math.min(coins, coinsMax);
      }
    }
    const restName = cartItems[0]?.restaurantName || 'Restaurant';

    const activeUserId = await AsyncStorage.getItem('userid');
    const activeName = await AsyncStorage.getItem('name');
    const activeEmail = await AsyncStorage.getItem('email');
    const activePhoneVerified = (await AsyncStorage.getItem('isPhoneVerified')) === 'true';

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
        setIsProcessingPayment(false);
        showAlert('Payment Error', orderData.message || 'Failed to initiate payment.');
        return;
      }

      // 2. Platform-specific Checkout Handler
      if (Platform.OS === 'web') {
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          setIsProcessingPayment(false);
          showAlert('Payment Error', 'Failed to load Razorpay checkout SDK.');
          return;
        }

        const options = {
          description: `Order from ${restName}`,
          image: 'https://i.imgur.com/3g7nmJC.png',
          currency: 'INR',
          key: orderData.keyId,
          amount: orderData.amount,
          name: 'Food Delivery App',
          order_id: orderData.orderId,
          prefill: {
            email: activeEmail && activeEmail !== 'N/A' ? activeEmail : 'customer@example.com',
            contact: activePhone && activePhone !== 'N/A' ? activePhone : '9999999999',
            name: activeName && activeName !== 'N/A' ? activeName : 'Customer',
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
                    tag: selectedTag,
                  },
                  userCoordinates: userLocation ? {
                    lat: userLocation.latitude,
                    lng: userLocation.longitude
                  } : null,
                  deliveryDistance: roadDistances[restId] || null,
                  deliveryFee: deliveryFee,
                  couponCode: appliedCoupon ? appliedCoupon.couponCode : null,
                  influencerName: appliedCoupon ? appliedCoupon.influencerName : null,
                  discountAmount: discountValAmount,
                }),
              });

              const verifyData = await verifyResponse.json();
              if (verifyData.success) {
                // Clear cart in AsyncStorage
                await AsyncStorage.removeItem('cart');
                setIsProcessingPayment(false);
                setShowSuccessModal(true);
              } else {
                setIsProcessingPayment(false);
                showAlert('Verification Failed', verifyData.message || 'Unable to verify payment with server.');
              }
            } catch (verifyError) {
              setIsProcessingPayment(false);
              console.error('Verify payment error on Web:', verifyError);
              showAlert('Server Error', 'Failed to connect to backend server for verification.');
            }
          },
          modal: {
            ondismiss: function () {
              setIsProcessingPayment(false);
              showAlert('Payment Cancelled', 'The payment process was closed. Please try again.');
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Mobile (Android / iOS)
        const { NativeModules } = require('react-native');
        const hasNativeRazorpay = NativeModules && NativeModules.RazorpayCheckout;

        let RazorpayCheckout = null;
        try {
          const RazorpayModule = require('react-native-razorpay');
          RazorpayCheckout = RazorpayModule.default || RazorpayModule;
        } catch (e) {
          console.warn('[Razorpay] Failed to load react-native-razorpay native module:', e);
        }

        const options = {
          description: `Order from ${restName}`,
          image: 'https://i.imgur.com/3g7nmJC.png',
          currency: 'INR',
          key: orderData.keyId,
          amount: orderData.amount,
          name: 'Food Delivery App',
          order_id: orderData.orderId,
          prefill: {
            email: activeEmail && activeEmail !== 'N/A' ? activeEmail : 'customer@example.com',
            contact: activePhone && activePhone !== 'N/A' ? activePhone : '9999999999',
            name: activeName && activeName !== 'N/A' ? activeName : 'Customer',
          },
          theme: { color: '#27AE60' },
        };

        if (!RazorpayCheckout || !RazorpayCheckout.open || !hasNativeRazorpay) {
          console.warn('[Razorpay] Native module not available. Simulating success for testing...');
          Alert.alert(
            'Expo Go Testing Mode',
            'react-native-razorpay native module is not linked in Expo Go. Would you like to simulate a successful payment for testing?',
            [
              {
                text: 'Cancel',
                onPress: () => setIsProcessingPayment(false),
                style: 'cancel',
              },
              {
                text: 'Simulate Success',
                onPress: async () => {
                  try {
                    const mockPaymentId = `pay_mock_${Date.now()}`;
                    const mockSignature = `sig_mock_${Date.now()}`;
                    const verifyResponse = await fetch(`${API_URL}/payment/verify`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        razorpay_order_id: orderData.orderId,
                        razorpay_payment_id: mockPaymentId,
                        razorpay_signature: mockSignature,
                        userId: activeUserId,
                        cartItems: cartItems,
                        restaurantId: restId,
                        restaurantName: restName,
                        totalPrice: subTotal,
                        gst: gstAmount,
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
                          tag: selectedTag,
                        },
                        userCoordinates: userLocation ? {
                          lat: userLocation.latitude,
                          lng: userLocation.longitude
                        } : null,
                        deliveryDistance: roadDistances[restId] || null,
                        deliveryFee: deliveryFee,
                        couponCode: appliedCoupon ? appliedCoupon.couponCode : null,
                        influencerName: appliedCoupon ? appliedCoupon.influencerName : null,
                        discountAmount: discountValAmount,
                      }),
                    });

                    const verifyData = await verifyResponse.json();
                    if (verifyData.success) {
                      await AsyncStorage.removeItem('cart');
                      setIsProcessingPayment(false);
                      setShowSuccessModal(true);
                    } else {
                      setIsProcessingPayment(false);
                      showAlert('Verification Failed', verifyData.message || 'Unable to verify payment.');
                    }
                  } catch (verifyError) {
                    setIsProcessingPayment(false);
                    console.error('Verify payment error on mock checkout:', verifyError);
                    showAlert('Server Error', 'Failed to connect to backend server for verification.');
                  }
                }
              }
            ]
          );
          return;
        }

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
                    tag: selectedTag,
                  },
                  userCoordinates: userLocation ? {
                    lat: userLocation.latitude,
                    lng: userLocation.longitude
                  } : null,
                  deliveryDistance: roadDistances[restId] || null,
                  deliveryFee: deliveryFee,
                  couponCode: appliedCoupon ? appliedCoupon.couponCode : null,
                  influencerName: appliedCoupon ? appliedCoupon.influencerName : null,
                  discountAmount: discountValAmount,
                }),
              });

              const verifyData = await verifyResponse.json();
              if (verifyData.success) {
                // Clear cart in AsyncStorage
                await AsyncStorage.removeItem('cart');
                setIsProcessingPayment(false);
                setShowSuccessModal(true);
              } else {
                setIsProcessingPayment(false);
                showAlert('Verification Failed', verifyData.message || 'Unable to verify payment with server.');
              }
            } catch (verifyError) {
              setIsProcessingPayment(false);
              console.error('Verify payment error:', verifyError);
              showAlert('Server Error', 'Failed to connect to backend server for verification.');
            }
          })
          .catch((error) => {
            setIsProcessingPayment(false);
            console.log('Payment checkout failure:', error);
            showAlert('Payment Cancelled/Failed', error.description || 'The payment process was interrupted. Please try again.');
          });
      }
    } catch (err) {
      setIsProcessingPayment(false);
      console.error('Initiate payment error:', err);
      showAlert('Payment Connection Error', 'Could not establish connection to initiate checkout.');
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => {
      const offerPercent = item.offerpercentage ? parseFloat(item.offerpercentage) : 0;
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
    if (appliedCoupon.discountType === 'flat') {
      discountAmount = Math.min(appliedCoupon.discountValue, total);
    } else if (appliedCoupon.discountType === 'percentage') {
      discountAmount = total * (appliedCoupon.discountValue / 100);
    }
    discountAmount = Math.round(discountAmount * 100) / 100;
  }

  const gst = total * 0.05; // 5% GST
  const platformFee = 2.00; // Constant platform fee
  const restId = cartItems[0]?.restId || '';
  const distanceStr = roadDistances[restId] || '';
  const distanceVal = parseFloat(distanceStr) || 0;
  const baseDeliveryFee = feesConfig.deliveryFeeBase + (distanceVal * feesConfig.deliveryFeePerKm);
  const surgeFee = (feesConfig.isSurgeActive && feesConfig.surgeFee > 0 && distanceVal > 0) ? feesConfig.surgeFee : 0;
  const isLocationFetched = locationStatus === 'inside';
  const deliveryFee = isLocationFetched ? (baseDeliveryFee + surgeFee) : 0;
  const grandTotal = Math.max(0, total - discountAmount + gst + platformFee + deliveryFee);
  // Dynamic Coins Calculation
  const coinsMin = feesConfig.coinMinOrderAmount ?? 200;
  const coinsBase = feesConfig.coinBaseAmount ?? 10;
  const coinsStep = feesConfig.coinStepAmount ?? 100;
  const coinsStepVal = feesConfig.coinStepValue ?? 5;
  const coinsMax = feesConfig.coinMaxLimit ?? 100;
  const coinsMaxOrder = feesConfig.coinMaxThreshold ?? 1000;

  let coinsEarned = 0;
  if (feesConfig.isCoinsActive !== false) {
    if (total >= coinsMaxOrder) {
      coinsEarned = coinsMax;
    } else if (total > coinsMin) {
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
          onPress={() => router.replace('/restaurentlist')}
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
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

            const offerPercent = item.offerpercentage ? parseFloat(item.offerpercentage) : 0;
            const hasOffer = offerPercent > 0 && offerPercent <= 100;
            const offerPrice = hasOffer ? (item.price - (item.price * (offerPercent / 100))) : item.price;

            return (
              <View key={item._id || item.itemId} style={styles.cartCard}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {displayItemName}
                </Text>

                <View style={styles.controlsRow}>
                  {/* Quantity Pill with Plus on Left and Minus on Right */}
                  <View style={styles.quantityContainer}>
                    <TouchableOpacity style={styles.quantityBtn} onPress={() => updateQuantity(item._id || item.itemId, 1)}>
                      <Feather name="plus" size={14} color="#1A1A1A" />
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{item.quantity}</Text>
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

        {/* Bill Details Card */}
        <View style={styles.billCard}>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Total</Text>
            <Text style={styles.billValue}>₹{total.toFixed(2)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>GST</Text>
            <Text style={styles.billValue}>₹{gst.toFixed(2)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Platform fee</Text>
            <Text style={styles.billValue}>₹{platformFee.toFixed(2)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>
              Delivery fee {isLocationFetched ? `(${distanceStr})` : ''}
            </Text>
            <Text style={styles.billValue}>
              {isLocationFetched ? `₹${baseDeliveryFee.toFixed(2)}` : 'To be calculated'}
            </Text>
          </View>
          {isLocationFetched && feesConfig.isSurgeActive && feesConfig.surgeFee > 0 && (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: '#FF5E5E', fontWeight: '600' }]}>
                ⚡ Surge fee (high demand)
              </Text>
              <Text style={[styles.billValue, { color: '#FF5E5E', fontWeight: '600' }]}>
                ₹{feesConfig.surgeFee.toFixed(2)}
              </Text>
            </View>
          )}
          {discountAmount > 0 ? (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: '#27AE60', fontWeight: '600' }]}>
                Coupon Discount ({appliedCoupon?.couponCode})
              </Text>
              <Text style={[styles.billValue, { color: '#27AE60', fontWeight: '600' }]}>
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

        {/* Location warning banner inside Cart if skipped */}
        {locationStatus !== 'inside' && !hasActiveOrder && (
          <View style={{
            backgroundColor: '#FFF9E6',
            borderColor: '#FFE0B2',
            borderWidth: 1,
            borderRadius: 16,
            padding: 16,
            marginHorizontal: 16,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12
          }}>
            <Ionicons name="location-outline" size={24} color="#FF9800" />
            <Text style={{
              flex: 1,
              fontSize: 13,
              color: '#B78103',
              lineHeight: 18,
              fontWeight: '500'
            }}>
              GPS / Location access is required to place orders. Please enable device location settings to verify service area and calculate delivery road distance.
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
            <Text style={styles.checkoutButtonText}>Place the order</Text>
          </TouchableOpacity>
        </View>

        {/* Delivery Address Section */}
        {showDeliveryForm && (
          <View style={styles.addressSectionContainer}>
            <Text style={styles.addressSectionTitle}>Delivery address</Text>

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

            {/* Save Address Button */}
            <TouchableOpacity
              style={[styles.saveAddressButton, hasActiveOrder && { backgroundColor: '#CCC' }]}
              onPress={handleSaveAddress}
              disabled={hasActiveOrder}
              activeOpacity={0.85}
            >
              <Text style={styles.saveAddressButtonText}>Save Address</Text>
            </TouchableOpacity>

            {/* Saved Address Selection */}
            {savedAddresses.length > 0 && (
              <View style={styles.savedSection}>
                <Text style={styles.savedAddressesLabel}>Use a saved address:</Text>

                {savedAddresses.map((addr) => {
                  const isSelected = selectedSavedAddressId === (addr.id || addr._id);
                  return (
                    <TouchableOpacity
                      key={addr.id || addr._id}
                      style={[styles.savedAddressCard, isSelected && styles.savedAddressCardSelected]}
                      onPress={() => handlePrefillAddress(addr)}
                      activeOpacity={0.9}
                    >
                      <View style={styles.savedCardLeft}>
                        <Ionicons
                          name={(addr.tag || addr.label) === 'Home' ? 'home' : (addr.tag || addr.label) === 'Office' ? 'briefcase' : 'business'}
                          size={20}
                          color="#1A1A1A"
                          style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.savedCardTag}>{addr.tag || addr.label}</Text>
                          <Text style={styles.savedCardDetails} numberOfLines={2}>
                            {`${addr.flatNo || ''}, ${addr.street || ''}${addr.landmark ? ', ' + addr.landmark : ''}`}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.savedCardRight}>
                        <TouchableOpacity
                          style={styles.deleteAddressDustbin}
                          onPress={() => handleDeleteAddress(addr.id || addr._id)}
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

            {/* Confirm Order Button */}
            <TouchableOpacity
              style={[styles.confirmOrderButton, (locationStatus !== 'inside' || hasActiveOrder) && { backgroundColor: '#CCC' }]}
              onPress={handleConfirmOrder}
              disabled={locationStatus !== 'inside' || hasActiveOrder}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmOrderButtonText}>
                {locationStatus !== 'inside' ? 'Please select/verify delivery address' : `Confirm order and pay ₹${grandTotal.toFixed(2)}`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Loading Overlay */}
      {isProcessingPayment && (
        <View style={styles.loadingOverlay}>
          <LoadingView />
        </View>
      )}

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
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
          <View style={styles.alertCard}>
            <View style={styles.alertIconContainer}>
              <Feather name="alert-triangle" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            <Text style={styles.alertMessage}>{customAlert.message}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.alertButton,
                pressed && { opacity: 0.85 }
              ]}
              onPress={() => setCustomAlert({ ...customAlert, visible: false })}
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
          <View style={[styles.alertCard, { backgroundColor: '#F9F9F6', padding: 24, maxWidth: 320 }]}>
            <View style={[styles.alertIconContainer, { backgroundColor: '#1E3545', marginBottom: 15 }]}>
              <Feather name="phone" size={28} color="#FFFFFF" />
            </View>

            {!confirmResult && !isBypassMode ? (
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
                    disabled={otpLoading}
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
            ) : isBypassMode ? (
              // Bypass Mode: Input Number directly (manual verbal confirmation)
              <>
                <Text style={styles.alertTitle}>Confirm Phone Number</Text>
                <Text style={[styles.alertMessage, { color: '#B78103', fontWeight: '600', marginBottom: 12 }]}>
                  SMS services are delayed. Please confirm your 10-digit number below. We will call you to verify your order details.
                </Text>

                {/* First Input: Already Entered Number (Disabled/ReadOnly) */}
                <Text style={{ fontSize: 13, color: '#7E7C77', fontWeight: 'bold', alignSelf: 'flex-start', marginBottom: 5 }}>Original Number Entered:</Text>
                <View style={[styles.addressInput, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFEFEF', borderWidth: 1, borderColor: '#DCD3C5', paddingHorizontal: 12, marginBottom: 12, opacity: 0.8 }]}>
                  <Text style={{ fontSize: 16, color: '#7E7C77', fontWeight: 'bold', marginRight: 5 }}>+91</Text>
                  <TextInput
                    style={{ flex: 1, fontSize: 16, color: '#7E7C77', padding: 0 }}
                    value={firstInputPhone}
                    editable={false}
                  />
                </View>

                {/* Second Input: Manually Entered Confirmation Number */}
                <Text style={{ fontSize: 13, color: '#7E7C77', fontWeight: 'bold', alignSelf: 'flex-start', marginBottom: 5 }}>Confirm Mobile Number:</Text>
                <View style={[styles.addressInput, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCD3C5', paddingHorizontal: 12, marginBottom: 20 }]}>
                  <Text style={{ fontSize: 16, color: '#7E7C77', fontWeight: 'bold', marginRight: 5 }}>+91</Text>
                  <TextInput
                    style={{ flex: 1, fontSize: 16, color: '#1A1A1A', padding: 0 }}
                    placeholder="Re-enter Mobile Number"
                    placeholderTextColor="#A19E95"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={verificationPhone}
                    onChangeText={setVerificationPhone}
                    disabled={otpLoading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.alertButton, { backgroundColor: '#B78103' }, otpLoading && { opacity: 0.6 }]}
                  onPress={handleBypassSubmit}
                  disabled={otpLoading}
                >
                  {otpLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.alertButtonText}>Confirm & Checkout</Text>
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
                  disabled={otpLoading}
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
    paddingBottom: 120, // push below tab bar
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
    backgroundColor: '#4CD080',
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
    gap: 12,
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#FF5E5E',
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  checkoutButton: {
    flex: 1.2,
    backgroundColor: '#27AE60',
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
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
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  saveAddressButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  savedAddressCardSelected: {
    borderColor: '#1A1A1A',
    borderWidth: 1.5,
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
    backgroundColor: '#27AE60',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  confirmOrderButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
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
});



























