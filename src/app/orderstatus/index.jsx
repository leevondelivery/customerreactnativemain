import { Feather, FontAwesome, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadingView from '../../components/LoadingView';
import { API_URL } from '../../config';
import { styles } from '../../styles/orderstatus.styles';
import { useTabBar } from '../_layout';


// Map DB status value to one of 4 progress stages (text always comes from DB)
const getStageInfo = (status) => {
  if (!status) return { percent: 10 };
  const s = status.trim().toLowerCase();
  // Stage 4 — Out for delivery / Delivered
  if (s.includes('delivered') || s.includes('completed') || s.includes('out for delivery') || s.includes('out for')) return { percent: 100 };
  // Stage 3 — Delivered soon (waiting to pickup)
  if (s.includes('delivered soon') || s.includes('pickup') || s.includes('pick up') || s.includes('waiting to pickup')) return { percent: 75 };
  // Stage 2 — Waiting for delivery boy to accept
  if (s.includes('waiting for delivery') || s.includes('delivery boy') || s.includes('waiting for driver')) return { percent: 50 };
  // Stage 1 — Pending (restaurant to be accepted)
  return { percent: 25 };
};

// Auto-generate fun notification message based on status
const getNotificationMessage = (status) => {
  if (!status) return null;
  const s = status.trim().toLowerCase();
  if (s.includes('delivered') || s.includes('completed')) return `Your order has been delivered! Enjoy your meal! 🎉`;
  if (s.includes('out for delivery') || s.includes('out for')) return `Clear the table! Greatness is on its way... 🛵`;
  if (s.includes('delivered soon') || s.includes('pickup') || s.includes('waiting to pickup')) return `Your order is packed and ready for pickup! 📦`;
  if (s.includes('waiting for delivery') || s.includes('delivery boy')) return `Searching for your hunger savior... 🚴`;
  return `Your order is pending restaurant confirmation 🍽️`;
};

export default function OrderStatusScreen() {
  const { showTabBar, hideTabBar } = useTabBar();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lastOffsetY = useRef(0);

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // ── Review Modal State ────────────────────────────────────────────────────
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewOrder, setReviewOrder] = useState(null);
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [restaurantReview, setRestaurantReview] = useState('');
  const [deliveryBoyRating, setDeliveryBoyRating] = useState(0);
  const [deliveryBoyReview, setDeliveryBoyReview] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

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
    return `₹ ${Number(value).toFixed(0)}`;
  };

  // Check if this order was already reviewed
  const isOrderAlreadyReviewed = useCallback(async (orderId) => {
    try {
      const storedIds = await AsyncStorage.getItem('submitted_reviewed_orders');
      if (storedIds) {
        const parsed = JSON.parse(storedIds);
        if (Array.isArray(parsed) && parsed.map(String).includes(String(orderId))) {
          return true;
        }
      }
    } catch (e) {
      console.warn('[OrderStatus] Error checking reviewed orders:', e);
    }
    return false;
  }, []);

  const handleOpenReviewModal = useCallback(async (order) => {
    const orderId = order?.orderId || order?.orderID || order?.order_id || order?._id || '';
    if (!orderId) return;

    // Don't show if already reviewed
    const alreadyReviewed = await isOrderAlreadyReviewed(orderId);
    if (alreadyReviewed) {
      console.log('[OrderStatus] Order already reviewed, skipping modal.');
      return;
    }

    setReviewOrder({
      orderId,
      restaurantName: order.restaurantName || order.restaurant_name || order.restName || 'Restaurant',
      restaurantId: order.restaurantId || order.restaurant_id || '',
      deliveryBoyId: order.deliveryBoyId || order.delivery_boy_id || order.driverId || '',
      deliveryBoyName: order.deliveryBoyName || order.deliveryName || order.driverName || 'Delivery Partner',
      items: order.items || order.orderItems || [],
      subTotal: order.subTotal ?? order.subtotal ?? '',
      deliveryCharges: order.deliveryFee ?? order.deliveryCharges ?? '',
      gst: order.gst ?? order.GST ?? order.tax ?? '',
      platformFee: order.platformFee ?? order.platform_fee ?? '',
      surgeFee: order.surgeFee ?? order.surge_fee ?? '',
      discountAmount: order.discountAmount ?? order.discount ?? '',
      grandTotal: order.grandTotal ?? order.totalPrice ?? order.total ?? '',
    });

    // Reset form fields
    setRestaurantRating(0);
    setRestaurantReview('');
    setDeliveryBoyRating(0);
    setDeliveryBoyReview('');
    setShowReviewModal(true);
  }, [isOrderAlreadyReviewed]);

  const handleDismissReview = () => {
    setShowReviewModal(false);
    setReviewOrder(null);
  };

  const handleSubmitReview = async () => {
    if (!reviewOrder) return;
    const currentOrderId = String(reviewOrder.orderId);

    try {
      setSubmittingReview(true);
      const userid = await AsyncStorage.getItem('userid');

      const reviewPayload = {
        userId: userid || '',
        user_id: userid || '',
        orderId: reviewOrder.orderId,
        order_id: reviewOrder.orderId,
        restaurantId: reviewOrder.restaurantId || '',
        restaurant_id: reviewOrder.restaurantId || '',
        restaurantName: reviewOrder.restaurantName || 'Restaurant',
        deliveryBoyId: reviewOrder.deliveryBoyId || '',
        delivery_boy_id: reviewOrder.deliveryBoyId || '',
        deliveryBoyName: reviewOrder.deliveryBoyName || 'Delivery Partner',
        restaurantRating: Number(restaurantRating) || 0,
        restaurantReview: restaurantReview.trim(),
        rating: Number(restaurantRating) || 0,
        review: restaurantReview.trim(),
        deliveryBoyRating: Number(deliveryBoyRating) || 0,
        deliveryBoyReview: deliveryBoyReview.trim(),
        orderDetails: [{
          items: reviewOrder.items || [],
          grandTotal: reviewOrder.grandTotal,
          subTotal: reviewOrder.subTotal,
          deliveryCharges: reviewOrder.deliveryCharges,
          gst: reviewOrder.gst,
          platformFee: reviewOrder.platformFee,
          surgeFee: reviewOrder.surgeFee,
          discountAmount: reviewOrder.discountAmount,
          restaurantName: reviewOrder.restaurantName,
        }],
      };

      // Mark as reviewed locally immediately
      const storedIds = await AsyncStorage.getItem('submitted_reviewed_orders');
      const existingIds = storedIds ? JSON.parse(storedIds) : [];
      const updatedIds = Array.from(new Set([...existingIds, currentOrderId]));
      await AsyncStorage.setItem('submitted_reviewed_orders', JSON.stringify(updatedIds));

      // Attempt POST to backend
      const candidateEndpoints = [
        `${API_URL}/reviews`,
        `${API_URL}/reviews/user/${userid}`,
        `${API_URL}/reviews/create`,
        `${API_URL}/reviews/add`,
        `${API_URL}/reviews/submit`,
        `${API_URL}/review`,
        `${API_URL}/review/create`,
        `${API_URL}/api/reviews`,
      ];

      let successRes = false;
      for (const endpoint of candidateEndpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reviewPayload),
          });
          if (res.ok) {
            console.log('[OrderStatus] Review saved to MongoDB at:', endpoint);
            successRes = true;
            break;
          }
        } catch (postErr) {
          console.log('[OrderStatus] POST to', endpoint, 'failed:', postErr.message);
        }
      }

      if (!successRes) {
        console.warn('[OrderStatus] Review saved locally only.');
      }

      setShowReviewModal(false);
      setReviewOrder(null);
    } catch (err) {
      console.error('[OrderStatus] Review submission error:', err);
      setShowReviewModal(false);
      setReviewOrder(null);
    } finally {
      setSubmittingReview(false);
    }
  };

  // ── Order Fetch ───────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (!orderStatusRef.current) {
        setLoading(true);
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
        hadActiveOrderRef.current = true;
        lastActiveOrderRef.current = data.orderStatus;
        orderStatusRef.current = data.orderStatus;
        setOrderStatus(data.orderStatus);

        const statusStr = (data.orderStatus.status || '').toLowerCase();
        if (statusStr.includes('delivered') || statusStr.includes('completed')) {
          handleOpenReviewModal(data.orderStatus);
        }
      } else {
        if (hadActiveOrderRef.current && lastActiveOrderRef.current) {
          hadActiveOrderRef.current = false;
          console.log('[OrderStatus] Active order disappeared. Showing review modal.');
          handleOpenReviewModal(lastActiveOrderRef.current);
        } else {
          // Check user's completed orders for any unreviewed order
          try {
            const compRes = await fetch(`${API_URL}/orders/completed/${userid}`);
            const compData = await compRes.json();
            if (compRes.ok && compData.orders && compData.orders.length > 0) {
              const sorted = [...compData.orders].reverse();
              for (const compOrd of sorted) {
                const compId = compOrd.orderId || compOrd.orderID || compOrd.order_id || compOrd._id || '';
                if (compId) {
                  const reviewed = await isOrderAlreadyReviewed(compId);
                  if (!reviewed) {
                    handleOpenReviewModal(compOrd);
                    break;
                  }
                }
              }
            }
          } catch (compErr) {
            console.warn('[OrderStatus] Error checking completed orders for review:', compErr);
          }
        }
        orderStatusRef.current = null;
        setOrderStatus(null);
        setError(data.message || 'No active order found');
      }
    } catch (err) {
      console.error('[OrderStatus] Fetch error:', err);
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [handleOpenReviewModal]);

  // Auto-refresh every 15 seconds while focused
  useFocusEffect(
    useCallback(() => {
      fetchStatus(orderStatusRef.current ? true : false);
      const interval = setInterval(() => fetchStatus(true), 15000);
      return () => clearInterval(interval);
    }, [fetchStatus])
  );

  const handleCallSavior = () => {
    const phone = orderStatus?.deliveryBoyPhone || orderStatus?.deliveryPhone || orderStatus?.deliveryBoyMobile;
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(err => console.error('Phone dialer error:', err));
    }
  };

  if (loading) {
    return <LoadingView />;
  }

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

  // ── Empty State ───────────────────────────────────────────────────────────
  if (!orderStatus || error) {
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
  const { percent } = getStageInfo(statusText);
  const notifMsg = orderStatus.notification || orderStatus.message || orderStatus.announcement || getNotificationMessage(statusText);

  const restaurantName = orderStatus.restaurantName || orderStatus.restaurant_name || orderStatus.restName || 'Restaurant';
  const orderId = orderStatus.orderId || orderStatus.orderID || orderStatus.order_id || '';

  const deliveryBoyName = orderStatus.deliveryBoyName || orderStatus.deliveryName || orderStatus.driverName || null;
  const hasDeliveryBoy = !!(deliveryBoyName && deliveryBoyName.toString().trim().length > 0);

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

  const gst = orderStatus.gst ?? orderStatus.GST ?? orderStatus.tax ?? '';
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

  const paymentStatus = orderStatus.paymentStatus || 'Paid';
  const paymentId = orderStatus.razorpayPaymentId || orderStatus.paymentId || '';
  const razorpayOrderId = orderStatus.razorpayOrderId || orderStatus.orderId || '';
  const otp = razorpayOrderId ? razorpayOrderId.toString().slice(-5) : '';

  return (
    <View style={styles.container}>
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
            <Text style={styles.orderIdText}>Order ID - {orderId}</Text>
          </View>

          {/* 3-Stage Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressBarWrapper}>
              <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
              <Text style={styles.progressBarText}>{statusText}</Text>
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
            {gst !== '' && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>GST</Text>
                <Text style={styles.summaryValue}>{formatCurrency(gst)}</Text>
              </View>
            )}
            {platformFee !== '' && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Platform Fee</Text>
                <Text style={styles.summaryValue}>{formatCurrency(platformFee)}</Text>
              </View>
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
            {paymentId ? (
              <Text style={styles.paymentIdText}>
                Payment ID <Text style={styles.paymentIdValue}>{paymentId}</Text>
              </Text>
            ) : null}
          </View>

          {/* OTP */}
          {otp ? (
            <View style={styles.otpBox}>
              <Text style={styles.otpText}>OTP - {otp}</Text>
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
