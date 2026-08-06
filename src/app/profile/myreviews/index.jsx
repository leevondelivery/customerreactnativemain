import { Feather, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import LoadingView from '../../../components/LoadingView';
import { API_URL } from '../../../config';
import { fetchProfileData } from '../../../store/restaurantsSlice';
import { styles } from '../../../styles/myreviews.styles';
import { useTabBar } from '../../_layout';

export default function MyReviewsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { showTabBar, hideTabBar } = useTabBar();
  const lastOffsetY = useRef(0);

  const reviews = useSelector((state) => state.restaurants.reviews || []);
  const completedOrders = useSelector((state) => state.restaurants.orders || []);

  const handleScroll = (event) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    const direction = currentOffset > lastOffsetY.current ? 'down' : 'up';
    if (Math.abs(currentOffset - lastOffsetY.current) > 15) {
      if (direction === 'down' && currentOffset > 60) hideTabBar();
      else if (direction === 'up') showTabBar();
      lastOffsetY.current = currentOffset;
    }
  };

  useFocusEffect(
    useCallback(() => {
      showTabBar(true);
      const refreshOnFocus = async () => {
        try {
          const userid = await AsyncStorage.getItem('userid');
          if (userid) dispatch(fetchProfileData(userid));
        } catch (e) {
          console.warn('[MyReviews] Error refreshing on focus:', e);
        }
      };
      refreshOnFocus();
    }, [showTabBar, dispatch])
  );

  const [loading, setLoading] = useState(true);
  const [locallySubmittedReviews, setLocallySubmittedReviews] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const initializeData = async () => {
      try {
        const userid = await AsyncStorage.getItem('userid');

        // Load locally submitted reviews from AsyncStorage (submitted via orderstatus modal)
        const storedReviews = await AsyncStorage.getItem('locally_submitted_reviews');
        if (storedReviews) {
          try {
            const parsedRev = JSON.parse(storedReviews);
            if (Array.isArray(parsedRev) && isMounted) setLocallySubmittedReviews(parsedRev);
          } catch (e) {
            console.warn('[MyReviews] Error parsing storedReviews:', e);
          }
        }

        if (userid) await dispatch(fetchProfileData(userid)).unwrap();
      } catch (err) {
        console.error('[MyReviews] Error initializing data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    initializeData();
    return () => { isMounted = false; };
  }, [dispatch]);

  // Helper to safely extract Order ID from a review object
  const getOrderIdFromReview = (r) => {
    if (!r) return '';
    const id = r.orderId || r.order_id || r.orderID || r.orderDetails?.[0]?.orderId || r.order?._id || r.order?.orderId || '';
    const str = String(id).trim();
    if (!str || str === 'undefined' || str === 'null' || str === 'N/A') return '';
    return str;
  };

  // Merge backend reviews + locally submitted reviews, deduplicating by orderId
  const displayReviews = [
    ...locallySubmittedReviews,
    ...reviews.filter((r) => {
      const rOrderId = getOrderIdFromReview(r);
      return !locallySubmittedReviews.some((lr) => {
        const lrOrderId = getOrderIdFromReview(lr);
        return (rOrderId && lrOrderId && rOrderId === lrOrderId) || String(lr._id) === String(r._id);
      });
    }),
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const maxStars = 5;
    const activeRating = Math.max(0, Math.min(maxStars, Math.round(rating || 0)));
    for (let i = 1; i <= maxStars; i++) {
      stars.push(
        <FontAwesome key={i} name={i <= activeRating ? 'star' : 'star-o'} size={16} color="#FFC107" />
      );
    }
    return <View style={styles.starsRow}>{stars}</View>;
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '';
    return `₹ ${Number(val).toFixed(0)}`;
  };

  if (loading) return <LoadingView />;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, styles.shadow]}
            onPress={() => router.replace('/profile')}
            activeOpacity={0.8}
          >
            <Feather name="chevron-left" size={24} color="#000000" />
          </TouchableOpacity>

          <View style={[styles.headerTitleCard, styles.shadow]}>
            <FontAwesome name="star" size={18} color="#FFC107" />
            <Text style={styles.headerTitleText}>My Reviews</Text>
          </View>

          <View style={styles.placeholderRight} />
        </View>

        {/* Section Title */}
        {displayReviews.length > 0 && (
          <Text style={styles.sectionHeaderTitle}>Your Given Reviews</Text>
        )}

        {/* Reviews List */}
        {displayReviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="message-square" size={48} color="#C8C7CC" />
            <Text style={styles.emptyText}>No reviews submitted yet</Text>
          </View>
        ) : (
          displayReviews.map((review) => {
            const orderDetailsObj = review.orderDetails && review.orderDetails[0] ? review.orderDetails[0] : null;
            const matchingCompletedOrder = completedOrders.find((o) => String(o.orderId || o._id) === String(review.orderId));

            const items = (orderDetailsObj && orderDetailsObj.items && orderDetailsObj.items.length > 0)
              ? orderDetailsObj.items
              : (matchingCompletedOrder?.items || []);

            const restaurantName = review.restaurantName || orderDetailsObj?.restaurantName || matchingCompletedOrder?.restaurantName || 'Restaurant';
            const subTotal = orderDetailsObj?.subTotal ?? matchingCompletedOrder?.subTotal ?? matchingCompletedOrder?.subtotal ?? '';
            const deliveryCharges = orderDetailsObj?.deliveryCharges ?? orderDetailsObj?.deliveryFee ?? matchingCompletedOrder?.deliveryFee ?? matchingCompletedOrder?.deliveryCharges ?? '';
            const surgeFee = orderDetailsObj?.surgeFee ?? matchingCompletedOrder?.surgeFee ?? matchingCompletedOrder?.surge_fee ?? '';
            const gst = orderDetailsObj?.gst ?? matchingCompletedOrder?.gst ?? matchingCompletedOrder?.tax ?? '';
            const platformFee = orderDetailsObj?.platformFee ?? matchingCompletedOrder?.platformFee ?? matchingCompletedOrder?.platform_fee ?? '';
            const discountAmount = orderDetailsObj?.discountAmount ?? matchingCompletedOrder?.discountAmount ?? matchingCompletedOrder?.discount ?? '';
            const grandTotal = orderDetailsObj?.grandTotal ?? matchingCompletedOrder?.grandTotal ?? matchingCompletedOrder?.totalPrice ?? '';

            return (
              <View key={review._id || review.orderId} style={styles.reviewCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.orderTitle}>Order #{review.orderId}</Text>
                  <Text style={styles.dateText}>{formatDate(review.createdAt)}</Text>
                </View>

                {restaurantName ? (
                  <Text style={[styles.restaurantNameTag, { marginBottom: 10 }]}>{restaurantName}</Text>
                ) : null}

                {/* Restaurant Experience */}
                <View style={styles.experienceBox}>
                  <Text style={styles.experienceTitle}>Restaurant Experience</Text>
                  {renderStars(review.restaurantRating)}
                  {review.restaurantReview && review.restaurantReview.trim() ? (
                    <Text style={styles.reviewCommentText}>{`"${review.restaurantReview.trim()}"`}</Text>
                  ) : null}
                </View>

                {/* Delivery Experience */}
                <View style={styles.experienceBox}>
                  <Text style={styles.experienceTitle}>Delivery Experience</Text>
                  {renderStars(review.deliveryBoyRating)}
                  {review.deliveryBoyReview && review.deliveryBoyReview.trim() ? (
                    <Text style={styles.reviewCommentText}>{`"${review.deliveryBoyReview.trim()}"`}</Text>
                  ) : null}
                </View>

                {/* Order Details & Price Breakdown */}
                {(items.length > 0 || grandTotal !== '') && (
                  <View style={styles.detailsBox}>
                    <Text style={styles.detailsBoxTitle}>Order Details & Summary</Text>

                    {items.length > 0 && items.map((item, idx) => (
                      <View key={item._id || idx} style={styles.itemRow}>
                        <Text style={styles.itemName}>{item.name || item.itemName || 'Item'}</Text>
                        <Text style={styles.itemQty}>{item.quantity || item.qty || 1}x</Text>
                        <Text style={styles.itemCost}>{formatCurrency(item.cost || item.price || item.amount)}</Text>
                      </View>
                    ))}

                    <View style={styles.priceBreakdown}>
                      {subTotal !== '' && (
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>Sub Total</Text>
                          <Text style={styles.priceValue}>{formatCurrency(subTotal)}</Text>
                        </View>
                      )}
                      {deliveryCharges !== '' && (
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>Delivery Charges</Text>
                          <Text style={styles.priceValue}>{formatCurrency(deliveryCharges)}</Text>
                        </View>
                      )}
                      {surgeFee !== '' && Number(surgeFee) > 0 && (
                        <View style={styles.priceRow}>
                          <Text style={[styles.priceLabel, { color: '#FF5E5E' }]}>⚡ Surge Fee</Text>
                          <Text style={[styles.priceValue, { color: '#FF5E5E' }]}>{formatCurrency(surgeFee)}</Text>
                        </View>
                      )}
                      {gst !== '' && (
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>GST</Text>
                          <Text style={styles.priceValue}>{formatCurrency(gst)}</Text>
                        </View>
                      )}
                      {platformFee !== '' && (
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>Platform Fee</Text>
                          <Text style={styles.priceValue}>{formatCurrency(platformFee)}</Text>
                        </View>
                      )}
                      {discountAmount !== '' && Number(discountAmount) > 0 && (
                        <View style={styles.priceRow}>
                          <Text style={[styles.priceLabel, { color: '#2E7D32' }]}>Discount</Text>
                          <Text style={[styles.priceValue, { color: '#2E7D32' }]}>-{formatCurrency(discountAmount)}</Text>
                        </View>
                      )}
                      {grandTotal !== '' && (
                        <View style={styles.totalPriceRow}>
                          <Text style={styles.totalPriceLabel}>Total Paid</Text>
                          <Text style={styles.totalPriceValue}>{formatCurrency(grandTotal)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
