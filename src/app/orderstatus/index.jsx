import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBar } from '../_layout';
import { API_URL } from '../../config';
import { styles } from '../../styles/orderstatus.styles';
import LoadingView from '../../components/LoadingView';


// Map DB status value to one of 4 progress stages (text always comes from DB)
const getStageInfo = (status) => {
  if (!status) return { percent: 10 };
  const s = status.trim().toLowerCase();
  // Stage 4 — Out for delivery
  if (s.includes('out for delivery') || s.includes('out for')) return { percent: 100 };
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

  const hadActiveOrder = useRef(false);

  // Redirect to reviews screen once the order completes
  useEffect(() => {
    if (orderStatus) {
      const statusLower = orderStatus.status?.toLowerCase() || '';
      if (statusLower.includes('delivered') || statusLower.includes('completed')) {
        hadActiveOrder.current = false;
        router.replace('/profile/myreviews');
      } else {
        hadActiveOrder.current = true;
      }
    } else if (hadActiveOrder.current && !loading) {
      hadActiveOrder.current = false;
      router.replace('/profile/myreviews');
    }
  }, [orderStatus, loading, router]);

  const handleScroll = (event) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    const direction = currentOffset > lastOffsetY.current ? 'down' : 'up';
    if (Math.abs(currentOffset - lastOffsetY.current) > 15) {
      if (direction === 'down' && currentOffset > 60) hideTabBar();
      else if (direction === 'up') showTabBar();
      lastOffsetY.current = currentOffset;
    }
  };

  const fetchStatus = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const userid = await AsyncStorage.getItem('userid');
      if (!userid) { setError('Not logged in'); return; }

      const url = `${API_URL}/orderstatus/user/${userid}`;
      console.log('[OrderStatus] Fetching:', url);
      const res = await fetch(url);
      const data = await res.json();
      console.log('[OrderStatus] Response fields:', Object.keys(data.orderStatus || {}));

      if (res.ok && data.success) {
        setOrderStatus(data.orderStatus);
      } else {
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
  }, []);

  // Auto-refresh every 15 seconds while focused
  useFocusEffect(
    useCallback(() => {
      fetchStatus();
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

  const formatCurrency = (value) => {
    if (value === undefined || value === null || value === '') return '';
    return `₹ ${Number(value).toFixed(0)}`;
  };

  if (loading) {
    return <LoadingView />;
  }

  if (!orderStatus || error) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top + 20 }]}>
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
