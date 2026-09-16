
import { Feather, FontAwesome, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDispatch } from 'react-redux';
import LoadingView from '../../components/LoadingView';
import { API_URL } from '../../config';
import { skipLocation } from '../../store/locationSlice';
import { fetchProfileData, addReviewLocally } from '../../store/restaurantsSlice';
import { styles } from '../../styles/orderstatus.styles';
import { useTabBar } from '../_layout';


// Helper to check if order is picked up (Stage 4 - 100%)
const checkIsPickedUp = (status, orderStatusObj = {}) => {
  if (!status && !orderStatusObj) return false;
  const s = String(status || '').trim().toLowerCase();
  const cleanStr = s.replace(/_/g, ' ').replace(/\s+/g, ' ');

  if (
    cleanStr.includes('picked') ||
    cleanStr.includes('pick up order') ||
    cleanStr.includes('order picked up') ||
    cleanStr.includes('picked up') ||
    (cleanStr.includes('pickup') && !cleanStr.includes('ready for pickup')) ||
    cleanStr.includes('out for') ||
    cleanStr.includes('on the way') ||
    cleanStr.includes('reaching') ||
    cleanStr.includes('doorstep') ||
    cleanStr.includes('delivered') ||
    cleanStr.includes('completed') ||
    String(orderStatusObj.isPickedUp) === 'true' ||
    String(orderStatusObj.pickedUp) === 'true' ||
    String(orderStatusObj.is_picked_up) === 'true' ||
    String(orderStatusObj.picked_up) === 'true'
  ) {
    if (!cleanStr.includes('ready for pickup') && !cleanStr.includes('ready for pick up')) {
      return true;
    }
  }
  return false;
};

// Helper to check if delivery boy accepted (Stage 3 - 75%)
const checkIsDeliveryBoyAccepted = (status, orderStatusObj = {}) => {
  if (!status && !orderStatusObj) return false;
  const s = String(status || '').trim().toLowerCase();
  const cleanStr = s.replace(/_/g, ' ').replace(/\s+/g, ' ');

  // 1. Check main status text keywords
  if (
    cleanStr.includes('driver accept') ||
    cleanStr.includes('delivery boy accept') ||
    cleanStr.includes('delivery partner accept') ||
    cleanStr.includes('boy accept') ||
    cleanStr.includes('partner accept') ||
    cleanStr.includes('delivery accept') ||
    cleanStr.includes('assigned') ||
    cleanStr.includes('heading') ||
    cleanStr.includes('at restaurant') ||
    cleanStr.includes('at store') ||
    cleanStr.includes('arrived') ||
    cleanStr.includes('reached') ||
    cleanStr.includes('accepted by delivery') ||
    cleanStr.includes('accepted by driver') ||
    cleanStr.includes('accepted by partner') ||
    cleanStr.includes('accepted by savior')
  ) {
    return true;
  }

  if (!orderStatusObj || typeof orderStatusObj !== 'object') return false;

  // 2. Check boolean / string acceptance flags
  const isAcceptedFlag =
    String(orderStatusObj.isDeliveryBoyAccepted).toLowerCase() === 'true' ||
    String(orderStatusObj.deliveryBoyAccepted).toLowerCase() === 'true' ||
    String(orderStatusObj.is_delivery_boy_accepted).toLowerCase() === 'true' ||
    String(orderStatusObj.delivery_boy_accepted).toLowerCase() === 'true' ||
    String(orderStatusObj.isDriverAccepted).toLowerCase() === 'true' ||
    String(orderStatusObj.driverAccepted).toLowerCase() === 'true' ||
    String(orderStatusObj.is_driver_accepted).toLowerCase() === 'true' ||
    String(orderStatusObj.driver_accepted).toLowerCase() === 'true' ||
    orderStatusObj.deliveryBoyAccepted === true ||
    orderStatusObj.isDeliveryBoyAccepted === true ||
    orderStatusObj.delivery_boy_accepted === true ||
    orderStatusObj.driverAccepted === true ||
    orderStatusObj.deliveryBoyAccepted === 1 ||
    orderStatusObj.isDeliveryBoyAccepted === 1;

  if (isAcceptedFlag) return true;

  // 3. Check delivery status subfields (e.g. deliveryBoyStatus, delivery_boy_status, driverStatus, driver_status, deliveryStatus)
  const delivBoyStatusStr = String(
    orderStatusObj.deliveryBoyStatus ||
    orderStatusObj.delivery_boy_status ||
    orderStatusObj.driverStatus ||
    orderStatusObj.driver_status ||
    orderStatusObj.deliveryStatus ||
    orderStatusObj.delivery_status ||
    ''
  ).trim().toLowerCase();

  if (
    delivBoyStatusStr.includes('accept') ||
    delivBoyStatusStr.includes('assign') ||
    delivBoyStatusStr.includes('heading') ||
    delivBoyStatusStr.includes('arrived') ||
    delivBoyStatusStr.includes('reached') ||
    delivBoyStatusStr.includes('pick') ||
    delivBoyStatusStr.includes('active') ||
    delivBoyStatusStr === 'true' ||
    delivBoyStatusStr === '1'
  ) {
    return true;
  }

  // 4. Check presence of delivery boy ID
  const rawId =
    orderStatusObj.deliveryBoyId ||
    orderStatusObj.delivery_boy_id ||
    orderStatusObj.driverId ||
    orderStatusObj.driver_id ||
    orderStatusObj.saviorId ||
    orderStatusObj.savior_id ||
    orderStatusObj.deliveryPartnerId ||
    orderStatusObj.delivery_partner_id ||
    (orderStatusObj.deliveryBoy && (orderStatusObj.deliveryBoy._id || orderStatusObj.deliveryBoy.id || orderStatusObj.deliveryBoy)) ||
    (orderStatusObj.delivery_boy && (orderStatusObj.delivery_boy._id || orderStatusObj.delivery_boy.id || orderStatusObj.delivery_boy)) ||
    (orderStatusObj.driver && (orderStatusObj.driver._id || orderStatusObj.driver.id || orderStatusObj.driver)) ||
    null;

  if (rawId) {
    const idStr = (typeof rawId === 'object' ? JSON.stringify(rawId) : String(rawId)).trim().toLowerCase();
    if (
      idStr &&
      idStr !== 'null' &&
      idStr !== 'undefined' &&
      idStr !== 'not assigned' &&
      idStr !== 'none' &&
      idStr !== '{}' &&
      idStr !== ''
    ) {
      return true;
    }
  }

  // 5. Check presence of delivery boy Name
  const rawName =
    orderStatusObj.deliveryBoyName ||
    orderStatusObj.delivery_boy_name ||
    orderStatusObj.deliveryName ||
    orderStatusObj.driverName ||
    orderStatusObj.driver_name ||
    orderStatusObj.saviorName ||
    orderStatusObj.savior_name ||
    orderStatusObj.deliveryPartnerName ||
    orderStatusObj.delivery_partner_name ||
    (orderStatusObj.deliveryBoy && orderStatusObj.deliveryBoy.name) ||
    (orderStatusObj.delivery_boy && orderStatusObj.delivery_boy.name) ||
    (orderStatusObj.driver && orderStatusObj.driver.name) ||
    null;

  if (rawName) {
    const nameStr = String(rawName).trim().toLowerCase();
    if (
      nameStr &&
      nameStr !== 'null' &&
      nameStr !== 'undefined' &&
      nameStr !== 'not assigned' &&
      nameStr !== 'none' &&
      nameStr !== ''
    ) {
      return true;
    }
  }

  return false;
};

// Helper to check if restaurant accepted (Stage 2 - 50%)
const checkIsRestaurantAccepted = (status, orderStatusObj = {}) => {
  if (!status && !orderStatusObj) return false;
  const s = String(status || '').trim().toLowerCase();
  const cleanStr = s.replace(/_/g, ' ').replace(/\s+/g, ' ');

  return (
    String(orderStatusObj.isRestaurantAccepted).toLowerCase() === 'true' ||
    String(orderStatusObj.restaurantAccepted).toLowerCase() === 'true' ||
    String(orderStatusObj.is_restaurant_accepted).toLowerCase() === 'true' ||
    String(orderStatusObj.restaurant_accepted).toLowerCase() === 'true' ||
    orderStatusObj.isRestaurantAccepted === true ||
    orderStatusObj.restaurantAccepted === true ||
    orderStatusObj.is_restaurant_accepted === true ||
    orderStatusObj.restaurant_accepted === true ||
    cleanStr.includes('restaurant accept') ||
    cleanStr.includes('restaurent accept') ||
    cleanStr.includes('food prep') ||
    cleanStr.includes('prep') ||
    cleanStr.includes('cook') ||
    cleanStr.includes('kitchen') ||
    cleanStr.includes('ready') ||
    cleanStr.includes('packed') ||
    cleanStr.includes('waiting for delivery boy to accept') ||
    cleanStr.includes('waiting for delivery partner') ||
    cleanStr.includes('waiting for driver') ||
    cleanStr.includes('waiting for boy') ||
    cleanStr.includes('waiting for delivery') ||
    cleanStr.includes('searching') ||
    (cleanStr.includes('accept') &&
      !cleanStr.includes('restaurent to accept') &&
      !cleanStr.includes('restaurant to accept') &&
      !cleanStr.includes('pending'))
  );
};

// Map DB status value to one of 4 progress stages
const getStageInfo = (status, orderStatusObj = {}) => {
  if (!status && !orderStatusObj) return { percent: 25 };

  // Stage 4 (100% - Picked Up / Out for Delivery / On the Way / Delivered)
  if (checkIsPickedUp(status, orderStatusObj)) {
    return { percent: 100 };
  }

  // Stage 3 (75% - Delivery Partner Accepts / Driver Assigned / Heading to Restaurant)
  if (checkIsDeliveryBoyAccepted(status, orderStatusObj)) {
    return { percent: 75 };
  }

  // Stage 2 (50% - Restaurant Accepts / Food Preparing in Kitchen)
  if (checkIsRestaurantAccepted(status, orderStatusObj)) {
    return { percent: 50 };
  }

  // Stage 1 (25% - Order Placed / Waiting for Restaurant to Accept)
  return { percent: 25 };
};

// Generate friendly notification message based on status
const getNotificationMessage = (status, orderStatusObj = {}) => {
  if (!status && !orderStatusObj) return null;
  const s = String(status || '').trim().toLowerCase();

  // 1. Stage 4 (100%) - Delivered / Completed / Picked Up / Out for delivery
  if (s.includes('delivered') || s.includes('completed')) {
    return `Your order has been delivered! Enjoy your meal! 🎉`;
  }
  if (s.includes('out for delivery') || s.includes('reaching') || s.includes('doorstep')) {
    return `Clear the table! Greatness is on its way... 🛵`;
  }
  if (checkIsPickedUp(status, orderStatusObj)) {
    return `Your order is picked up & on the way to your location! 🛵`;
  }

  // 2. Stage 3 (75%) - Driver / Delivery Boy Accepted (Assigned)
  if (checkIsDeliveryBoyAccepted(status, orderStatusObj)) {
    return `Delivery partner assigned & heading to restaurant! 🛵`;
  }

  // 3. Stage 2 (50%) - Restaurant Accepted / Food Preparing
  if (checkIsRestaurantAccepted(status, orderStatusObj)) {
    return `Order accepted & food is preparing in the kitchen! 🍳`;
  }

  // 4. Stage 1 (25%) - Pending & Waiting for Restaurant Accept
  return `Your order is placed & pending restaurant confirmation 🍽️`;
};

// Format clean display status inside the progress bar
const formatDisplayStatus = (status, orderStatusObj = {}) => {
  if (!status && !orderStatusObj) return 'Waiting for restaurant to accept';
  const s = String(status || '').trim().toLowerCase();

  // 1. Stage 4 (100%)
  if (s.includes('delivered') || s.includes('completed')) {
    return 'Order delivered';
  }
  if (s.includes('out for delivery') || s.includes('reaching') || s.includes('doorstep')) {
    return 'Out for delivery';
  }
  if (checkIsPickedUp(status, orderStatusObj)) {
    return 'Order picked up & on the way';
  }

  // 2. Stage 3 (75%)
  if (checkIsDeliveryBoyAccepted(status, orderStatusObj)) {
    return 'Delivery partner assigned';
  }

  // 3. Stage 2 (50%)
  if (checkIsRestaurantAccepted(status, orderStatusObj)) {
    return 'Order accepted · Food preparing in kitchen';
  }

  // 4. Stage 1 (25%)
  return 'Order placed';
};

export default function OrderStatusScreen() {
  const { showTabBar, hideTabBar } = useTabBar();
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const lastOffsetY = useRef(0);

  useFocusEffect(
    useCallback(() => {
      showTabBar(true);
      const onBackPress = () => {
        router.replace('/restaurentlist');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [router, showTabBar])
  );

  // Floating animation for empty state icon
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

  const [orderStatus, setOrderStatus] = useState(null);
  const [recentRejectedOrder, setRecentRejectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isGstExpanded, setIsGstExpanded] = useState(false);

  // ── Review Modal State ────────────────────────────────────────────────────
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewOrder, setReviewOrder] = useState(null);
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [restaurantReview, setRestaurantReview] = useState('');
  const [deliveryBoyRating, setDeliveryBoyRating] = useState(0);
  const [deliveryBoyReview, setDeliveryBoyReview] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const showReviewModalRef = useRef(false);
  const reviewOrderRef = useRef(null);
  const reviewedOrDismissedSessionRef = useRef(new Set());

  const handleScroll = (event) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    const direction = currentOffset > lastOffsetY.current ? 'down' : 'up';
    if (Math.abs(currentOffset - lastOffsetY.current) > 15) {
      if (direction === 'down' && currentOffset > 60) hideTabBar();
      else if (direction === 'up') showTabBar();
      lastOffsetY.current = currentOffset;
    }
  };

  const hadActiveOrderRef = useRef(false);
  const lastActiveOrderRef = useRef(null);
  const orderStatusRef = useRef(null);

  // ── Review helpers ────────────────────────────────────────────────────────
  const renderInteractiveStars = (currentRating, setRatingFn) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          style={reviewStyles.starBtn}
          onPress={() => setRatingFn(i)}
          activeOpacity={0.7}
        >
          <FontAwesome
            name={i <= currentRating ? 'star' : 'star-o'}
            size={28}
            color={i <= currentRating ? '#FFC107' : '#CCCCCC'}
          />
        </TouchableOpacity>
      );
    }
    return <View style={reviewStyles.starsRow}>{stars}</View>;
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null || value === '') return '';
    const num = Number(value);
    if (isNaN(num)) return '';
    return `₹ ${num.toFixed(2)}`;
  };

  // Check if this order was already reviewed or review prompt was dismissed
  const isOrderAlreadyReviewed = useCallback(async (orderId, orderObj = null) => {
    const targetId = String(orderId || orderObj?.orderId || orderObj?.orderID || orderObj?.order_id || orderObj?._id || orderObj?.id || '');
    if (!targetId) return false;

    if (reviewedOrDismissedSessionRef.current.has(targetId)) {
      return true;
    }

    if (orderObj) {
      if (
        (orderObj.restaurantRating && Number(orderObj.restaurantRating) > 0) ||
        (orderObj.deliveryBoyRating && Number(orderObj.deliveryBoyRating) > 0) ||
        (orderObj.rating && Number(orderObj.rating) > 0) ||
        orderObj.isReviewed === true ||
        orderObj.reviewed === true
      ) {
        return true;
      }
    }

    try {
      const storedIds = await AsyncStorage.getItem('submitted_reviewed_orders');
      if (storedIds) {
        const parsed = JSON.parse(storedIds);
        if (Array.isArray(parsed) && parsed.map(String).includes(targetId)) {
          return true;
        }
      }

      const dismissedIds = await AsyncStorage.getItem('dismissed_review_prompts');
      if (dismissedIds) {
        const parsed = JSON.parse(dismissedIds);
        if (Array.isArray(parsed) && parsed.map(String).includes(targetId)) {
          return true;
        }
      }
    } catch (e) {
      console.warn('[OrderStatus] Error checking reviewed orders:', e);
    }
    return false;
  }, []);

  const handleOpenReviewModal = useCallback(async (order) => {
    const orderId = String(order?.orderId || order?.orderID || order?.order_id || order?._id || '');
    if (!orderId) return;

    // If modal is already open for this exact order, DO NOT reset state or flicker!
    if (showReviewModalRef.current && String(reviewOrderRef.current?.orderId) === orderId) {
      return;
    }

    // Skip review modal ONLY if order was rejected or cancelled
    const statusStr = (order?.status || order?.orderStatus || order?.order_status || '').toLowerCase().trim();
    const isRejectedOrCancelled =
      statusStr.includes('reject') ||
      statusStr.includes('cancel') ||
      statusStr.includes('declin') ||
      statusStr.includes('failed');

    if (isRejectedOrCancelled) {
      console.log('[OrderStatus] Order was rejected or cancelled. Skipping review modal.');
      return;
    }

    // Don't show if already reviewed or dismissed
    const alreadyReviewed = await isOrderAlreadyReviewed(orderId, order);
    if (alreadyReviewed) {
      console.log('[OrderStatus] Order already reviewed, skipping modal.');
      return;
    }

    const newReviewOrder = {
      orderId,
      restaurantName: order.restaurantName || order.restaurant_name || order.restName || 'Restaurant',
      restaurantId: order.restaurantId || order.restaurant_id || order.restId || '',
      deliveryBoyId: order.deliveryBoyId || order.delivery_boy_id || order.driverId || order.saviorId || '',
      deliveryBoyName: order.deliveryBoyName || order.deliveryName || order.driverName || order.saviorName || 'Delivery Partner',
      items: order.items || order.orderItems || order.cartItems || [],
      subTotal: order.subTotal ?? order.subtotal ?? order.totalPrice ?? '',
      deliveryCharges: order.deliveryFee ?? order.deliveryCharges ?? '',
      gst: order.gst ?? order.GST ?? order.tax ?? '',
      platformFee: order.platformFee ?? order.platform_fee ?? '',
      surgeFee: order.surgeFee ?? order.surge_fee ?? '',
      discountAmount: order.discountAmount ?? order.discount ?? '',
      grandTotal: order.grandTotal ?? order.totalPrice ?? order.total ?? '',
    };

    reviewOrderRef.current = newReviewOrder;
    showReviewModalRef.current = true;
    setReviewOrder(newReviewOrder);

    // Reset form fields
    setRestaurantRating(0);
    setRestaurantReview('');
    setDeliveryBoyRating(0);
    setDeliveryBoyReview('');
    setShowReviewModal(true);
  }, [isOrderAlreadyReviewed]);

  const handleDismissReview = async () => {
    const targetId = String(reviewOrderRef.current?.orderId || reviewOrder?.orderId || '');
    if (targetId) {
      reviewedOrDismissedSessionRef.current.add(targetId);
      try {
        const storedDismissed = await AsyncStorage.getItem('dismissed_review_prompts');
        const existingIds = storedDismissed ? JSON.parse(storedDismissed) : [];
        const updatedIds = Array.from(new Set([...existingIds, targetId]));
        await AsyncStorage.setItem('dismissed_review_prompts', JSON.stringify(updatedIds));
      } catch (e) {
        console.warn('[OrderStatus] Error saving dismissed review prompt:', e);
      }
    }
    showReviewModalRef.current = false;
    reviewOrderRef.current = null;
    setShowReviewModal(false);
    setReviewOrder(null);
  };

  const handleSubmitReview = async () => {
    const currentOrder = reviewOrderRef.current || reviewOrder;
    if (!currentOrder) return;
    const currentOrderId = String(currentOrder.orderId);

    try {
      setSubmittingReview(true);
      const userid = await AsyncStorage.getItem('userid');

      const reviewPayload = {
        userId: userid || '',
        user_id: userid || '',
        orderId: currentOrder.orderId,
        order_id: currentOrder.orderId,
        restaurantId: currentOrder.restaurantId || '',
        restaurant_id: currentOrder.restaurantId || '',
        restaurantName: currentOrder.restaurantName || 'Restaurant',
        deliveryBoyId: currentOrder.deliveryBoyId || '',
        delivery_boy_id: currentOrder.deliveryBoyId || '',
        deliveryBoyName: currentOrder.deliveryBoyName || 'Delivery Partner',
        restaurantRating: Number(restaurantRating) || 0,
        restaurantReview: restaurantReview.trim(),
        rating: Number(restaurantRating) || 0,
        review: restaurantReview.trim(),
        deliveryBoyRating: Number(deliveryBoyRating) || 0,
        deliveryBoyReview: deliveryBoyReview.trim(),
        orderDetails: [{
          items: currentOrder.items || [],
          grandTotal: currentOrder.grandTotal,
          subTotal: currentOrder.subTotal,
          deliveryCharges: currentOrder.deliveryCharges,
          gst: currentOrder.gst,
          platformFee: currentOrder.platformFee,
          surgeFee: currentOrder.surgeFee,
          discountAmount: currentOrder.discountAmount,
          restaurantName: currentOrder.restaurantName,
        }],
      };

      reviewedOrDismissedSessionRef.current.add(currentOrderId);

      // Mark as reviewed locally immediately
      const storedIds = await AsyncStorage.getItem('submitted_reviewed_orders');
      const existingIds = storedIds ? JSON.parse(storedIds) : [];
      const updatedIds = Array.from(new Set([...existingIds, currentOrderId]));
      await AsyncStorage.setItem('submitted_reviewed_orders', JSON.stringify(updatedIds));

      // Save into locally_submitted_reviews for MyReviews
      try {
        const storedLocals = await AsyncStorage.getItem('locally_submitted_reviews');
        const existingLocals = storedLocals ? JSON.parse(storedLocals) : [];
        const localEntry = {
          ...reviewPayload,
          _id: `local_rev_${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        const updatedLocals = [localEntry, ...existingLocals.filter(r => String(r.orderId) !== currentOrderId)];
        await AsyncStorage.setItem('locally_submitted_reviews', JSON.stringify(updatedLocals));
        dispatch(addReviewLocally(localEntry));
      } catch (locErr) {
        console.warn('[OrderStatus] Error saving locally_submitted_reviews:', locErr);
      }

      // Attempt POST to backend with timeout
      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;
        const res = await fetch(`${API_URL}/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reviewPayload),
          signal: controller?.signal,
        });
        if (timeoutId) clearTimeout(timeoutId);
        if (res.ok) {
          console.log('[OrderStatus] Review saved to MongoDB successfully');
        } else {
          // Fallback alias
          await fetch(`${API_URL}/api/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reviewPayload),
          }).catch(() => {});
        }
      } catch (_postErr) {
        console.warn('[OrderStatus] Network error posting review, saved locally:', _postErr?.message);
      }

      showReviewModalRef.current = false;
      reviewOrderRef.current = null;
      setShowReviewModal(false);
      setSubmittingReview(false);

      if (userid) {
        dispatch(fetchProfileData(userid));
      }
      setReviewOrder(null);
    } catch (err) {
      console.error('[OrderStatus] Review submission error:', err);
      showReviewModalRef.current = false;
      reviewOrderRef.current = null;
      setShowReviewModal(false);
      setReviewOrder(null);
    } finally {
      setSubmittingReview(false);
    }
  };

  // ── Order Fetch ───────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async (isRefresh = false, isSilent = false) => {
    // If the review modal is currently open and being interacted with, avoid re-fetching or polling interference
    if (showReviewModalRef.current) {
      return;
    }

    try {
      if (isSilent) {
        // Silent background polling: DO NOT trigger any loading or refreshing spinners
      } else if (isRefresh) {
        setRefreshing(true);
      }
      setError(null);

      const userid = await AsyncStorage.getItem('userid');
      if (!userid) {
        setError('Not logged in');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const url = `${API_URL}/orderstatus/user/${userid}`;
      console.log('[OrderStatus] Fetching:', url);
      const res = await fetch(url);
      const data = await res.json();
      console.log('[OrderStatus] Response fields:', Object.keys(data.orderStatus || {}));

      if (res.ok && data.success && data.orderStatus) {
        const sStr = (data.orderStatus.status || data.orderStatus.orderStatus || '').toLowerCase().trim();
        const isRej = sStr.includes('reject') || sStr.includes('cancel') || sStr.includes('declin') || sStr.includes('failed');

        if (isRej) {
          const rejData = {
            orderId: data.orderStatus.orderId || data.orderStatus.orderID || data.orderStatus.order_id || data.orderStatus._id || '',
            restaurantName: data.orderStatus.restaurantName || data.orderStatus.restaurant_name || data.orderStatus.restName || 'Restaurant',
            timestamp: Date.now(),
          };
          lastActiveOrderRef.current = null;
          orderStatusRef.current = null;
          setOrderStatus(null);
          setRecentRejectedOrder(rejData);
          AsyncStorage.setItem(`recent_rejected_order_${userid}`, JSON.stringify(rejData)).catch(() => {});
          AsyncStorage.setItem(`has_active_order_${userid}`, 'false').catch(() => {});
          AsyncStorage.removeItem(`active_order_data_${userid}`).catch(() => {});
        } else {
          hadActiveOrderRef.current = true;
          lastActiveOrderRef.current = data.orderStatus;
          orderStatusRef.current = data.orderStatus;
          setOrderStatus(data.orderStatus);
          setRecentRejectedOrder(null);
          AsyncStorage.removeItem(`recent_rejected_order_${userid}`).catch(() => {});
          AsyncStorage.setItem(`has_active_order_${userid}`, 'true').catch(() => {});
          AsyncStorage.setItem(`active_order_data_${userid}`, JSON.stringify(data.orderStatus)).catch(() => {});
        }
      } else {
        // Capture previous active order before clearing refs
        const previousActiveOrder = lastActiveOrderRef.current || orderStatusRef.current;

        hadActiveOrderRef.current = false;
        lastActiveOrderRef.current = null;
        orderStatusRef.current = null;
        setOrderStatus(null);
        setError(data.message || 'No active order found');
        showTabBar(true);

        const hasActiveOrderCached = await AsyncStorage.getItem(`has_active_order_${userid}`);

        if (hasActiveOrderCached !== 'true') {
          AsyncStorage.setItem(`has_active_order_${userid}`, 'false').catch(() => {});
          AsyncStorage.removeItem(`active_order_data_${userid}`).catch(() => {});
        }

        // If an active order was rejected or completed
        if (previousActiveOrder) {
          const prevStatus = (previousActiveOrder.status || previousActiveOrder.orderStatus || '').toLowerCase().trim();
          const isPrevRej = prevStatus.includes('reject') || prevStatus.includes('cancel') || prevStatus.includes('declin') || prevStatus.includes('failed');
          const prevId = previousActiveOrder.orderId || previousActiveOrder.orderID || previousActiveOrder.order_id || previousActiveOrder._id || previousActiveOrder.id || '';

          // Check if this order actually reached finalcompletedorders
          let isActuallyCompleted = false;
          if (prevId && !isPrevRej) {
            try {
              const compRes = await fetch(`${API_URL}/orders/completed/${userid}`);
              if (compRes.ok) {
                const compData = await compRes.json();
                const compList = compData.orders || compData.data || [];
                if (Array.isArray(compList)) {
                  isActuallyCompleted = compList.some(o => {
                    const oid = String(o.orderId || o.orderID || o.order_id || o._id || o.id || '');
                    return oid === String(prevId);
                  });
                }
              }
            } catch (cErr) {
              console.warn('[OrderStatus] Check completion status error:', cErr.message);
            }
          }

          if (isPrevRej || (!isActuallyCompleted && prevId)) {
            console.log('[OrderStatus] Active order ended with rejected/cancelled status. Displaying rejected banner.');
            const rejData = {
              orderId: prevId || previousActiveOrder.orderId || '',
              restaurantName: previousActiveOrder.restaurantName || previousActiveOrder.restaurant_name || previousActiveOrder.restName || 'Restaurant',
              timestamp: Date.now(),
            };
            setRecentRejectedOrder(rejData);
            AsyncStorage.setItem(`recent_rejected_order_${userid}`, JSON.stringify(rejData)).catch(() => {});
          } else {
            setRecentRejectedOrder(null);
            AsyncStorage.removeItem(`recent_rejected_order_${userid}`).catch(() => {});
            if (prevId && !reviewedOrDismissedSessionRef.current.has(String(prevId))) {
              const reviewed = await isOrderAlreadyReviewed(prevId, previousActiveOrder);
              if (!reviewed && !showReviewModalRef.current) {
                console.log('[OrderStatus] Active order completed successfully! Opening review modal ONCE for order:', prevId);
                await handleOpenReviewModal(previousActiveOrder);
              }
            }
          }
        } else {
          try {
            const rejStr = await AsyncStorage.getItem(`recent_rejected_order_${userid}`);
            if (rejStr) {
              const parsed = JSON.parse(rejStr);
              if (parsed && parsed.timestamp && (Date.now() - Number(parsed.timestamp) < 3600000)) {
                setRecentRejectedOrder(parsed);
              } else {
                setRecentRejectedOrder(null);
                AsyncStorage.removeItem(`recent_rejected_order_${userid}`).catch(() => {});
              }
            }
          } catch (e) {}
          try {
            if (showReviewModalRef.current) return;
            const completedRes = await fetch(`${API_URL}/orders/completed/${userid}`);
            if (completedRes.ok) {
              const completedData = await completedRes.json();
              const completedList = completedData.orders || completedData.data || [];
              if (Array.isArray(completedList) && completedList.length > 0) {
                const latestOrder = completedList[0];
                const latestId = latestOrder.orderId || latestOrder.orderID || latestOrder.order_id || latestOrder._id || latestOrder.id || '';
                if (latestId && !reviewedOrDismissedSessionRef.current.has(String(latestId))) {
                  const reviewed = await isOrderAlreadyReviewed(latestId, latestOrder);
                  if (!reviewed && !showReviewModalRef.current) {
                    const orderDate = new Date(latestOrder.orderDate || latestOrder.completedAt || latestOrder.createdAt || Date.now()).getTime();
                    if (Date.now() - orderDate < 24 * 60 * 60 * 1000) {
                      console.log('[OrderStatus] Unreviewed recent completed order found:', latestId);
                      setRecentRejectedOrder(null);
                      AsyncStorage.removeItem(`recent_rejected_order_${userid}`).catch(() => {});
                      await handleOpenReviewModal(latestOrder);
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.warn('[OrderStatus] Check completed orders error:', e.message);
          }
        }
      }
    } catch (err) {
      console.error('[OrderStatus] Fetch error:', err);
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [handleOpenReviewModal, showTabBar, dispatch, isOrderAlreadyReviewed]);

  // Auto-refresh silently while focused & app is active
  useFocusEffect(
    useCallback(() => {
      showTabBar(true);

      // Load active order data & recent rejected order on focus
      AsyncStorage.getItem('userid').then((uid) => {
        if (uid) {
          AsyncStorage.getItem(`has_active_order_${uid}`).then((hasActive) => {
            if (hasActive === 'true') {
              setRecentRejectedOrder(null);
              AsyncStorage.removeItem(`recent_rejected_order_${uid}`).catch(() => {});
            } else {
              AsyncStorage.getItem(`recent_rejected_order_${uid}`).then((rejStr) => {
                if (rejStr) {
                  try {
                    const parsed = JSON.parse(rejStr);
                    if (parsed && parsed.timestamp && (Date.now() - Number(parsed.timestamp) < 3600000)) {
                      setRecentRejectedOrder(parsed);
                    } else {
                      AsyncStorage.removeItem(`recent_rejected_order_${uid}`).catch(() => {});
                      setRecentRejectedOrder(null);
                    }
                  } catch (e) {}
                } else {
                  setRecentRejectedOrder(null);
                }
              });
            }
          });

          AsyncStorage.getItem(`active_order_data_${uid}`).then((cached) => {
            if (cached) {
              try {
                const parsed = JSON.parse(cached);
                if (parsed) {
                  setOrderStatus(parsed);
                  orderStatusRef.current = parsed;
                }
              } catch (e) {}
            }
          });
        }
      });

      fetchStatus(false, true); // ALWAYS fetch live order status silently in background on tab focus
      const interval = setInterval(() => {
        if (AppState.currentState === 'active') {
          fetchStatus(false, true); // Silent background polling
        }
      }, 5000);

      const subscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          fetchStatus(false, true); // Silent check on app resume
        }
      });

      return () => {
        clearInterval(interval);
        subscription.remove();
      };
    }, [fetchStatus, showTabBar])
  );

  const handleCallSavior = () => {
    const phone = orderStatus?.deliveryBoyPhone || orderStatus?.deliveryPhone || orderStatus?.deliveryBoyMobile;
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(err => console.error('Phone dialer error:', err));
    }
  };

  // Render Modal inline directly to prevent component unmounting & input focus flickering on state changes
  const renderReviewModal = () => (
    <Modal
      visible={showReviewModal}
      transparent
      animationType="slide"
      onRequestClose={handleDismissReview}
    >
      <View style={reviewStyles.backdrop}>
        <View style={reviewStyles.sheet}>
          {/* Header */}
          <View style={reviewStyles.sheetHeader}>
            <View style={reviewStyles.sheetTitleRow}>
              <FontAwesome name="star" size={18} color="#FFC107" />
              <Text style={reviewStyles.sheetTitle}>Rate Your Order</Text>
            </View>
            <TouchableOpacity
              style={reviewStyles.closeBtn}
              onPress={handleDismissReview}
              activeOpacity={0.75}
            >
              <Feather name="x" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          {reviewOrder && (
            <>
              <Text style={reviewStyles.orderTag}>
                #{reviewOrder.orderId} · {reviewOrder.restaurantName}
              </Text>

              <ScrollView
                style={reviewStyles.formScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Restaurant Rating */}
                <View style={reviewStyles.ratingBox}>
                  <Text style={reviewStyles.ratingLabel}>
                    🍽️ Rate Restaurant
                  </Text>
                  <Text style={reviewStyles.ratingSubLabel}>{reviewOrder.restaurantName}</Text>
                  {renderInteractiveStars(restaurantRating, setRestaurantRating)}
                  <TextInput
                    style={reviewStyles.textInput}
                    placeholder="Write your review for the restaurant..."
                    placeholderTextColor="#AEAEB2"
                    multiline
                    numberOfLines={3}
                    value={restaurantReview}
                    onChangeText={setRestaurantReview}
                  />
                </View>

                {/* Delivery Boy Rating */}
                <View style={reviewStyles.ratingBox}>
                  <Text style={reviewStyles.ratingLabel}>
                    🛵 Rate Delivery Partner
                  </Text>
                  <Text style={reviewStyles.ratingSubLabel}>{reviewOrder.deliveryBoyName}</Text>
                  {renderInteractiveStars(deliveryBoyRating, setDeliveryBoyRating)}
                  <TextInput
                    style={reviewStyles.textInput}
                    placeholder="Write your review for the delivery partner..."
                    placeholderTextColor="#AEAEB2"
                    multiline
                    numberOfLines={3}
                    value={deliveryBoyReview}
                    onChangeText={setDeliveryBoyReview}
                  />
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[reviewStyles.submitBtn, submittingReview && reviewStyles.submitBtnDisabled]}
                  onPress={handleSubmitReview}
                  disabled={submittingReview}
                  activeOpacity={0.85}
                >
                  {submittingReview ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={reviewStyles.submitBtnText}>Submit Review</Text>
                  )}
                </TouchableOpacity>

                <View style={{ height: 24 }} />
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  // ── Empty / Cancelled State ───────────────────────────────────────────────
  if (!orderStatus || error) {
    const isRejectedWithin1Hour = recentRejectedOrder && (Date.now() - Number(recentRejectedOrder.timestamp || 0) < 3600000);

    if (isRejectedWithin1Hour) {
      return (
        <View style={[styles.emptyContainer, { paddingTop: insets.top + 20 }]}>
          {renderReviewModal()}

          <Animated.View style={[styles.emptyIconCircle, { backgroundColor: '#FEE2E2', transform: [{ translateY: floatAnim }] }]}>
            <Feather name="x-circle" size={54} color="#DC2626" />
          </Animated.View>

          <Text style={[styles.emptyTitle, { color: '#991B1B' }]}>
            Sorry, your order got cancelled
          </Text>

          <Text style={styles.emptySubText}>
            Your order from <Text style={{ fontWeight: '700', color: '#1A1A1A' }}>{recentRejectedOrder.restaurantName || 'Restaurant'}</Text> was rejected by the restaurant.
          </Text>

          {recentRejectedOrder.orderId ? (
            <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginVertical: 4 }}>
              <Text style={{ fontSize: 13, color: '#4B5563', fontWeight: '600' }}>
                Order ID: #{recentRejectedOrder.orderId}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.emptySubText, { fontSize: 12, color: '#6B7280' }]}>
            If any payment was deducted, a full refund will be processed back to your original payment method.
          </Text>

          <TouchableOpacity
            onPress={() => {
              setRecentRejectedOrder(null);
              AsyncStorage.getItem('userid').then((uid) => {
                if (uid) AsyncStorage.removeItem(`recent_rejected_order_${uid}`).catch(() => {});
              });
              router.replace('/restaurentlist');
            }}
            style={[styles.orderButton, { backgroundColor: '#DC2626', marginTop: 16 }]}
            activeOpacity={0.85}
          >
            <Text style={styles.orderButtonText}>Browse Other Restaurants</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top + 20 }]}>
        {renderReviewModal()}

        {/* Floating beige circle with fork & knife icon */}
        <Animated.View style={[styles.emptyIconCircle, { transform: [{ translateY: floatAnim }] }]}>
          <MaterialIcons name="restaurant" size={52} color="#1A1A1A" />
        </Animated.View>

        <Text style={styles.emptyTitle}>No Active Orders</Text>
        <Text style={styles.emptySubText}>
          Your kitchen is quiet right now. Let{`'`}s fix{`\n`}that with some delicious food!
        </Text>

        <TouchableOpacity
          onPress={() => router.replace('/restaurentlist')}
          style={styles.orderButton}
          activeOpacity={0.85}
        >
          <Text style={styles.orderButtonText}>Order Something Tasty</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const statusText = orderStatus.status || 'Order Placed';
  const { percent } = getStageInfo(statusText, orderStatus);
  const notifMsg = getNotificationMessage(statusText, orderStatus);

  const restaurantName = orderStatus.restaurantName || orderStatus.restaurant_name || orderStatus.restName || 'Restaurant';
  const orderId = orderStatus.orderId || orderStatus.orderID || orderStatus.order_id || '';

  const deliveryAddressText = orderStatus.deliveryAddress 
    || orderStatus.address 
    || orderStatus.customerAddress 
    || orderStatus.userAddress
    || (orderStatus.deliveryAddressInfo 
        ? `${orderStatus.deliveryAddressInfo.flatNo ? orderStatus.deliveryAddressInfo.flatNo + ', ' : ''}${orderStatus.deliveryAddressInfo.street || ''}${orderStatus.deliveryAddressInfo.landmark ? ' (Near ' + orderStatus.deliveryAddressInfo.landmark + ')' : ''}`
        : null);

  const deliveryAddressTag = orderStatus.deliveryAddressInfo?.tag 
    || orderStatus.tag 
    || orderStatus.addressTag 
    || orderStatus.label 
    || null;

  const deliveryBoyName = 
    orderStatus.deliveryBoyName ||
    orderStatus.delivery_boy_name ||
    orderStatus.deliveryName ||
    orderStatus.driverName ||
    orderStatus.driver_name ||
    orderStatus.saviorName ||
    orderStatus.savior_name ||
    orderStatus.deliveryPartnerName ||
    orderStatus.delivery_partner_name ||
    (orderStatus.deliveryBoy && (orderStatus.deliveryBoy.name || orderStatus.deliveryBoy.fullName)) ||
    (orderStatus.delivery_boy && (orderStatus.delivery_boy.name || orderStatus.delivery_boy.fullName)) ||
    (orderStatus.driver && (orderStatus.driver.name || orderStatus.driver.fullName)) ||
    null;
  const statusClean = String(statusText).toLowerCase().trim();

  // Delivery partner details are shown ONLY after the delivery boy has explicitly accepted the order
  const isDriverAcceptedStatus = 
    checkIsDeliveryBoyAccepted(statusText, orderStatus) ||
    checkIsPickedUp(statusText, orderStatus);

  const hasDeliveryBoy = !!(
    isDriverAcceptedStatus &&
    deliveryBoyName && 
    deliveryBoyName.toString().trim().length > 0 &&
    deliveryBoyName.toString().trim().toLowerCase() !== 'null' &&
    deliveryBoyName.toString().trim().toLowerCase() !== 'undefined' &&
    deliveryBoyName.toString().trim().toLowerCase() !== 'not assigned'
  );

  const items = orderStatus.items || orderStatus.orderItems || [];
  const subTotal = orderStatus.subTotal ?? orderStatus.subtotal ?? (orderStatus.totalPrice && orderStatus.totalPrice !== orderStatus.grandTotal ? orderStatus.totalPrice : '') ?? '';

  let deliveryCharges = orderStatus.deliveryFee
    ?? orderStatus.delivery_fee
    ?? orderStatus.deliveryCharges
    ?? orderStatus.deliveryCharge
    ?? orderStatus.delivery_charge
    ?? orderStatus.delivery_charges
    ?? orderStatus.deliveryCost
    ?? orderStatus.delivery_cost
    ?? orderStatus.deliveryAmount
    ?? orderStatus.delivery_amount
    ?? '';

  const gst = orderStatus.gst 
    ?? orderStatus.GST 
    ?? orderStatus.gstAmount 
    ?? orderStatus.gst_amount 
    ?? orderStatus.tax 
    ?? orderStatus.taxAmount 
    ?? orderStatus.tax_amount 
    ?? '';
  const platformFee = orderStatus.platformFee ?? orderStatus.platform_fee ?? orderStatus.platformFeeAmount ?? '';
  const surgeFee = orderStatus.surgeFee ?? orderStatus.surge_fee ?? '';
  const grandTotal = orderStatus.grandTotal ?? orderStatus.totalPrice ?? orderStatus.total ?? orderStatus.finalTotal ?? '';
  const discountAmount = orderStatus.discountAmount ?? orderStatus.discount_amount ?? orderStatus.discount ?? '';
  const couponCode = orderStatus.couponCode ?? orderStatus.coupon_code ?? orderStatus.promo_code ?? '';

  if ((deliveryCharges === undefined || deliveryCharges === null || deliveryCharges === '') && grandTotal !== '' && subTotal !== '') {
    const calcSub = Number(subTotal) || 0;
    const calcGst = Number(gst) || 0;
    const calcPlat = Number(platformFee) || 0;
    const calcGrand = Number(grandTotal) || 0;
    const calcDiscount = Number(orderStatus.discountAmount || orderStatus.discount || 0);
    const diff = calcGrand - (calcSub + calcGst + calcPlat - calcDiscount);
    if (!isNaN(diff) && diff >= 0) {
      deliveryCharges = diff;
    }
  }

  const paymentStatus = orderStatus.paymentStatus || orderStatus.payment_status || orderStatus.paymentState || 'Pending';
  const paymentStatusClean = String(paymentStatus).trim().toLowerCase();
  const isPaid = 
    orderStatus.isPaid === true ||
    paymentStatusClean === 'paid' || 
    paymentStatusClean === 'completed' || 
    paymentStatusClean === 'success' || 
    paymentStatusClean === 'successful';

  // 1. Prioritize direct DB OTP fields if present
  const dbOtp = (
    orderStatus.otp ||
    orderStatus.OTP ||
    orderStatus.deliveryOtp ||
    orderStatus.delivery_otp ||
    orderStatus.orderOtp ||
    ''
  ).toString().trim();

  let finalOtpCode = dbOtp;

  // 2. If DB does not have an explicit OTP field, extract from razorpayOrderId / orderId
  if (!finalOtpCode) {
    const rawRzpOrderId = (
      orderStatus.razorpayOrderId || 
      orderStatus.razorpay_order_id || 
      orderStatus.razorpayOrder || 
      orderStatus.razorpay_order_ID || 
      orderStatus.razorpay_orderid || 
      orderStatus.rzpOrderId || 
      ''
    ).toString().trim();
    const cleanedRzpId = rawRzpOrderId.replace(/^(order_|ord_)/i, '');
    const rzpDigits = cleanedRzpId.replace(/\D/g, '');
    const rzpCode = rzpDigits ? rzpDigits.slice(-5) : (cleanedRzpId ? cleanedRzpId.slice(-5).toUpperCase() : '');
    const fallbackDigits = (orderStatus.orderId || '').toString().replace(/\D/g, '');
    finalOtpCode = rzpCode || (fallbackDigits ? fallbackDigits.slice(-5) : '');
  }

  const otp = isPaid && finalOtpCode ? finalOtpCode.padStart(5, '0') : (dbOtp ? dbOtp.padStart(5, '0') : '');

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="transparent" translucent={true} />
      {renderReviewModal()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top + 12, 24) }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchStatus(true)} tintColor="#2E7D32" />
        }
      >
        {/* ── Notification Banner (above main card) ── */}
        {notifMsg ? (
          <View style={styles.notificationBanner}>
            <View style={styles.notificationDot} />
            <Text style={styles.notificationText}>{notifMsg}</Text>
          </View>
        ) : null}

        {/* ── Main Beige Card ── */}
        <View style={styles.mainCard}>

          {/* Restaurant Name */}
          <Text style={styles.restaurantName}>{restaurantName}</Text>
          <View style={styles.restaurantDivider} />



          {/* Order Details */}
          <Text style={styles.sectionLabel}>Order details</Text>
          <View style={styles.orderIdBadge}>
            <Text style={styles.orderIdText}>Order ID - {String(orderId).replace(/^ord-/i, '')}</Text>
          </View>

          {/* 3-Stage Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressBarWrapper}>
              <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
              <Text style={styles.progressBarText}>{formatDisplayStatus(statusText, orderStatus)}</Text>
            </View>
          </View>

          {/* Hunger Savior Section */}
          <Text style={styles.sectionLabel}>Your Hunger Savior details</Text>
          <View style={styles.deliveryBoyCard}>
            <View style={styles.deliveryBoyRow}>
              <Text style={styles.deliveryBoyLabel}>Name</Text>
              {hasDeliveryBoy
                ? <Text style={styles.deliveryBoyName}>{deliveryBoyName}</Text>
                : <Text style={styles.notAssignedText}>Not Assigned</Text>
              }
            </View>
            {hasDeliveryBoy && (
              <TouchableOpacity style={styles.callButton} onPress={handleCallSavior} activeOpacity={0.85}>
                <FontAwesome5 name="phone-alt" size={14} color="#FFFFFF" />
                <Text style={styles.callButtonText}>Call Savior</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Delivery Address Section */}
          {deliveryAddressText ? (
            <>
              <Text style={styles.sectionLabel}>Order will be delivered to</Text>
              <View style={styles.deliveryAddressCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.addressIconCircle}>
                    <Feather name="map-pin" size={18} color="#2E7D32" />
                  </View>
                  <View style={{ flex: 1 }}>
                    {deliveryAddressTag ? (
                      <View style={styles.addressTagBadge}>
                        <Text style={styles.addressTagText}>{deliveryAddressTag.toUpperCase()}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.addressText}>{deliveryAddressText}</Text>
                  </View>
                </View>
              </View>
            </>
          ) : null}

          {/* Items Table */}
          <View style={styles.itemsTableCard}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderTextLeft}>Items</Text>
              <Text style={styles.tableHeaderText}>Quantity</Text>
              <Text style={styles.tableHeaderText}>Cost</Text>
            </View>

            {items.length > 0 ? items.map((item, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.tableCellLeft}>{item.name || item.itemName || item.item || '-'}</Text>
                <Text style={styles.tableCell}>{item.quantity || item.qty || 1}x</Text>
                <Text style={styles.tableCell}>{formatCurrency(item.cost || item.price || item.amount)}</Text>
              </View>
            )) : (
              <View style={styles.tableRow}>
                <Text style={[styles.tableCellLeft, { color: '#AEAEB2' }]}>No items found</Text>
              </View>
            )}

            {subTotal !== '' && (
              <>
                <View style={styles.tableDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Sub Total</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(subTotal)}</Text>
                </View>
              </>
            )}
            {(deliveryCharges !== '' && deliveryCharges !== null && deliveryCharges !== undefined) && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Charges</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(surgeFee !== '' && Number(surgeFee) > 0 ? Math.max(0, Number(deliveryCharges) - Number(surgeFee)) : deliveryCharges)}
                </Text>
              </View>
            )}
            {surgeFee !== '' && Number(surgeFee) > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: '#FF5E5E' }]}>⚡ Surge Fee</Text>
                <Text style={[styles.summaryValue, { color: '#FF5E5E' }]}>{formatCurrency(surgeFee)}</Text>
              </View>
            )}
            {(gst !== '' && gst !== null && gst !== undefined && Number(gst) > 0) && (
              <>
                <TouchableOpacity
                  style={styles.summaryRow}
                  onPress={() => setIsGstExpanded(!isGstExpanded)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 3 }}>
                    <Text style={[styles.summaryLabel, { flex: 0 }]}>GST</Text>
                    <Feather
                      name={isGstExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#555"
                    />
                  </View>
                  <Text style={styles.summaryValue}>{formatCurrency(gst)}</Text>
                </TouchableOpacity>
                {isGstExpanded && (() => {
                  const foodGstVal = orderStatus.foodGst !== undefined ? Number(orderStatus.foodGst) : ((Number(subTotal) || 0) * 0.05);
                  const delFeeVal = Number(deliveryCharges) || 0;
                  const deliveryGstVal = orderStatus.deliveryGst !== undefined ? Number(orderStatus.deliveryGst) : (delFeeVal * 0.18);
                  const fCgst = (foodGstVal / 2);
                  const fSgst = (foodGstVal / 2);
                  const dCgst = (deliveryGstVal / 2);
                  const dSgst = (deliveryGstVal / 2);
                  return (
                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginVertical: 4, borderWidth: 1, borderColor: '#E2E8F0' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B', marginBottom: 2 }}>
                        Food GST (5%): {formatCurrency(foodGstVal)}
                      </Text>
                      <View style={[styles.summaryRow, { paddingLeft: 12, marginVertical: 1 }]}>
                        <Text style={[styles.summaryLabel, { fontSize: 12, color: '#64748B' }]}>CGST (2.5%)</Text>
                        <Text style={[styles.summaryValue, { fontSize: 12, color: '#64748B' }]}>{formatCurrency(fCgst)}</Text>
                      </View>
                      <View style={[styles.summaryRow, { paddingLeft: 12, marginVertical: 1 }]}>
                        <Text style={[styles.summaryLabel, { fontSize: 12, color: '#64748B' }]}>SGST (2.5%)</Text>
                        <Text style={[styles.summaryValue, { fontSize: 12, color: '#64748B' }]}>{formatCurrency(fSgst)}</Text>
                      </View>

                      {deliveryGstVal > 0 && (
                        <>
                          <View style={{ height: 1, backgroundColor: '#CBD5E1', marginVertical: 6 }} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B', marginBottom: 2 }}>
                            Delivery GST (18%): {formatCurrency(deliveryGstVal)}
                          </Text>
                          <View style={[styles.summaryRow, { paddingLeft: 12, marginVertical: 1 }]}>
                            <Text style={[styles.summaryLabel, { fontSize: 12, color: '#64748B' }]}>CGST (9.0%)</Text>
                            <Text style={[styles.summaryValue, { fontSize: 12, color: '#64748B' }]}>{formatCurrency(dCgst)}</Text>
                          </View>
                          <View style={[styles.summaryRow, { paddingLeft: 12, marginVertical: 1 }]}>
                            <Text style={[styles.summaryLabel, { fontSize: 12, color: '#64748B' }]}>SGST (9.0%)</Text>
                            <Text style={[styles.summaryValue, { fontSize: 12, color: '#64748B' }]}>{formatCurrency(dSgst)}</Text>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })()}
              </>
            )}

            {discountAmount !== '' && Number(discountAmount) > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: '#2B783E', fontWeight: '700' }]}>
                  🏷️ Coupon Discount{couponCode ? ` (${couponCode})` : ''}
                </Text>
                <Text style={[styles.summaryValue, { color: '#2B783E', fontWeight: '700' }]}>
                  - {formatCurrency(discountAmount)}
                </Text>
              </View>
            )}
            {grandTotal !== '' && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatCurrency(grandTotal)}</Text>
              </View>
            )}
          </View>

          {/* Payment Status */}
          <View style={styles.paymentCard}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Payment status</Text>
              <View style={styles.paidBadge}>
                <Text style={styles.paidBadgeText}>{paymentStatus}</Text>
              </View>
            </View>
          </View>

          {/* OTP */}
          {otp ? (
            <View style={styles.otpBox}>
              <Text style={styles.otpText}>OTP - {otp}</Text>
            </View>
          ) : !isPaid ? (
            <View style={[styles.otpBox, { backgroundColor: '#FFF3E0', paddingHorizontal: 16 }]}>
              <Text style={[styles.otpText, { fontSize: 13, letterSpacing: 0, color: '#E65100', textAlign: 'center' }]}>
                Scan & Pay Delivery Partner via QR Code at doorstep to reveal your 5-digit OTP.
              </Text>
            </View>
          ) : null}


        </View>
      </ScrollView>
    </View>
  );
}

// ── Review Modal Styles ───────────────────────────────────────────────────────
const reviewStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#F9F9F6',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '88%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDECE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderTag: {
    fontSize: 13,
    color: '#7E7C77',
    fontWeight: '600',
    marginBottom: 16,
  },
  formScroll: {
    flexGrow: 0,
  },
  ratingBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  ratingLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  ratingSubLabel: {
    fontSize: 12,
    color: '#7E7C77',
    fontWeight: '500',
    marginBottom: 10,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  starBtn: {
    padding: 4,
  },
  textInput: {
    backgroundColor: '#F4F3EF',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1A1A1A',
    textAlignVertical: 'top',
    minHeight: 70,
  },
  submitBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  submitBtnDisabled: {
    opacity: 0.55,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
