import { Feather, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import LoadingView from '../../../components/LoadingView';
import { API_URL } from '../../../config';
import { fetchProfileData } from '../../../store/restaurantsSlice';
import { styles } from '../../../styles/myreviews.styles';
import { useTabBar } from '../../_layout';

export default function MyReviewsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const dispatch = useDispatch();
  const { showTabBar, hideTabBar } = useTabBar();
  const lastOffsetY = useRef(0);

  const reviews = useSelector((state) => state.restaurants.reviews || []);
  const completedOrders = useSelector((state) => state.restaurants.orders || []);
  const profileLoaded = useSelector((state) => state.restaurants.profileLoaded);

  const [submitting, setSubmitting] = useState(false);

  // Form states for pending review
  const [pendingOrder, setPendingOrder] = useState(null);
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [restaurantReview, setRestaurantReview] = useState('');
  const [deliveryBoyRating, setDeliveryBoyRating] = useState(0);
  const [deliveryBoyReview, setDeliveryBoyReview] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const handleScroll = (event) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    const direction = currentOffset > lastOffsetY.current ? 'down' : 'up';

    if (Math.abs(currentOffset - lastOffsetY.current) > 15) {
      if (direction === 'down' && currentOffset > 60) {
        hideTabBar();
      } else if (direction === 'up') {
        showTabBar();
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      showTabBar(true);
      const refreshOnFocus = async () => {
        try {
          const userid = await AsyncStorage.getItem('userid');
          if (userid) {
            dispatch(fetchProfileData(userid));
          }
        } catch (e) {
          console.warn('[MyReviews] Error refreshing on focus:', e);
        }
      };
      refreshOnFocus();
    }, [showTabBar, dispatch])
  );

  const [loading, setLoading] = useState(true);
  const [localSubmittedIds, setLocalSubmittedIds] = useState([]);
  const [locallySubmittedReviews, setLocallySubmittedReviews] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const initializeData = async () => {
      try {
        const userid = await AsyncStorage.getItem('userid');

        // Load AsyncStorage submitted data
        const storedIds = await AsyncStorage.getItem('submitted_reviewed_orders');
        if (storedIds) {
          try {
            const parsedIds = JSON.parse(storedIds);
            if (Array.isArray(parsedIds) && isMounted) {
              setLocalSubmittedIds(parsedIds.map(String));
            }
          } catch (e) {
            console.warn('[MyReviews] Error parsing storedIds:', e);
          }
        }

        const storedReviews = await AsyncStorage.getItem('locally_submitted_reviews');
        if (storedReviews) {
          try {
            const parsedRev = JSON.parse(storedReviews);
            if (Array.isArray(parsedRev) && isMounted) {
              setLocallySubmittedReviews(parsedRev);
            }
          } catch (e) {
            console.warn('[MyReviews] Error parsing storedReviews:', e);
          }
        }

        // Fetch Redux profile data
        if (userid) {
          await dispatch(fetchProfileData(userid)).unwrap();
        }
      } catch (err) {
        console.error('[MyReviews] Error initializing data:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    initializeData();
    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  // Helper functions for safely extracting Order IDs
  const getOrderIdFromReview = (r) => {
    if (!r) return '';
    const id = r.orderId || r.order_id || r.orderID || r.orderDetails?.[0]?.orderId || r.order?._id || r.order?.orderId || '';
    const str = String(id).trim();
    if (!str || str === 'undefined' || str === 'null' || str === 'N/A') return '';
    return str;
  };

  const getOrderIdFromOrder = (o) => {
    if (!o) return '';
    const id = o.orderId || o.orderID || o.order_id || o._id || o.id || '';
    const str = String(id).trim();
    if (!str || str === 'undefined' || str === 'null' || str === 'N/A') return '';
    return str;
  };

  // Display reviews combined from MongoDB backend store + locally submitted reviews
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

  // Compute set of all reviewed order IDs (from MongoDB reviews + local AsyncStorage)
  const reviewedOrderIds = new Set(
    [
      ...reviews.map(getOrderIdFromReview),
      ...locallySubmittedReviews.map(getOrderIdFromReview),
      ...localSubmittedIds.map((id) => String(id).trim()),
    ].filter((id) => id && id !== 'undefined' && id !== 'null' && id !== 'N/A')
  );

  // Extract primitive params to prevent object reference re-render loops from useLocalSearchParams()
  const orderIdParam = params?.orderId ? String(params.orderId).trim() : null;
  const itemsParam = params?.items;
  const restaurantNameParam = params?.restaurantName;
  const restaurantIdParam = params?.restaurantId;
  const deliveryBoyIdParam = params?.deliveryBoyId;
  const deliveryBoyNameParam = params?.deliveryBoyName;
  const subTotalParam = params?.subTotal;
  const deliveryFeeParam = params?.deliveryCharges || params?.deliveryFee;
  const gstParam = params?.gst;
  const platformFeeParam = params?.platformFee;
  const surgeFeeParam = params?.surgeFee;
  const discountAmountParam = params?.discountAmount;
  const grandTotalParam = params?.grandTotal || params?.totalPrice;

  // Determine if there is an unreviewed order (either passed via route params or from completed orders)
  useEffect(() => {
    if (loading) return;

    if (orderIdParam) {
      // Check if this order has ALREADY been reviewed
      if (reviewedOrderIds.has(orderIdParam)) {
        if (pendingOrder !== null) setPendingOrder(null);
        return;
      }

      if (reviewSubmitted) {
        setReviewSubmitted(false);
      }

      if (pendingOrder?.orderId === orderIdParam) return;

      let parsedItems = [];
      if (itemsParam) {
        try {
          parsedItems = typeof itemsParam === 'string' ? JSON.parse(itemsParam) : itemsParam;
        } catch {
          parsedItems = [];
        }
      }

      setPendingOrder({
        orderId: orderIdParam,
        restaurantName: restaurantNameParam || 'Restaurant',
        restaurantId: restaurantIdParam || '',
        deliveryBoyId: deliveryBoyIdParam || '',
        deliveryBoyName: deliveryBoyNameParam || 'Delivery Partner',
        items: parsedItems,
        subTotal: subTotalParam || '',
        deliveryCharges: deliveryFeeParam || '',
        gst: gstParam || '',
        platformFee: platformFeeParam || '',
        surgeFee: surgeFeeParam || '',
        discountAmount: discountAmountParam || '',
        grandTotal: grandTotalParam || '',
      });
    } else if (completedOrders && completedOrders.length > 0) {
      // Search completed orders from newest to oldest
      const sortedCompleted = [...completedOrders].reverse();
      const unreviewed = sortedCompleted.find((o) => {
        const id = getOrderIdFromOrder(o);
        return id && !reviewedOrderIds.has(id);
      });

      if (unreviewed) {
        const targetId = getOrderIdFromOrder(unreviewed);

        if (reviewSubmitted) {
          setReviewSubmitted(false);
        }

        if (pendingOrder?.orderId === targetId) return;

        setPendingOrder({
          orderId: targetId,
          restaurantName: unreviewed.restaurantName || 'Restaurant',
          restaurantId: unreviewed.restaurantId || '',
          deliveryBoyId: unreviewed.deliveryBoyId || '',
          deliveryBoyName: unreviewed.deliveryBoyName || 'Delivery Partner',
          items: unreviewed.items || [],
          subTotal: unreviewed.subTotal ?? unreviewed.subtotal ?? '',
          deliveryCharges: unreviewed.deliveryFee ?? unreviewed.deliveryCharges ?? '',
          gst: unreviewed.gst ?? unreviewed.tax ?? '',
          platformFee: unreviewed.platformFee ?? '',
          surgeFee: unreviewed.surgeFee ?? '',
          discountAmount: unreviewed.discountAmount ?? unreviewed.discount ?? '',
          grandTotal: unreviewed.grandTotal ?? unreviewed.totalPrice ?? '',
        });
      } else {
        if (pendingOrder !== null) setPendingOrder(null);
      }
    } else {
      if (pendingOrder !== null) setPendingOrder(null);
    }
  }, [
    orderIdParam,
    itemsParam,
    restaurantNameParam,
    restaurantIdParam,
    deliveryBoyIdParam,
    deliveryBoyNameParam,
    subTotalParam,
    deliveryFeeParam,
    gstParam,
    platformFeeParam,
    surgeFeeParam,
    discountAmountParam,
    grandTotalParam,
    completedOrders,
    reviews,
    reviewSubmitted,
    pendingOrder?.orderId,
    loading,
  ]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
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
        <FontAwesome
          key={i}
          name={i <= activeRating ? 'star' : 'star-o'}
          size={16}
          color="#FFC107"
        />
      );
    }
    return <View style={styles.starsRow}>{stars}</View>;
  };

  const renderInteractiveStars = (currentRating, setRatingFn) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          style={styles.starBtn}
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
    return <View style={styles.interactiveStarsRow}>{stars}</View>;
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '';
    return `₹ ${Number(val).toFixed(0)}`;
  };

  const handleSubmitReview = async () => {
    if (!pendingOrder) return;

    const currentOrderId = String(pendingOrder.orderId);

    try {
      setSubmitting(true);
      const userid = await AsyncStorage.getItem('userid');

      const reviewPayload = {
        userId: userid || '',
        user_id: userid || '',
        orderId: pendingOrder.orderId,
        order_id: pendingOrder.orderId,
        restaurantId: pendingOrder.restaurantId || '',
        restaurant_id: pendingOrder.restaurantId || '',
        restaurantName: pendingOrder.restaurantName || 'Restaurant',
        deliveryBoyId: pendingOrder.deliveryBoyId || '',
        delivery_boy_id: pendingOrder.deliveryBoyId || '',
        deliveryBoyName: pendingOrder.deliveryBoyName || 'Delivery Partner',
        restaurantRating: Number(restaurantRating) || 0,
        restaurantReview: restaurantReview.trim(),
        rating: Number(restaurantRating) || 0,
        review: restaurantReview.trim(),
        deliveryBoyRating: Number(deliveryBoyRating) || 0,
        deliveryBoyReview: deliveryBoyReview.trim(),
        orderDetails: [
          {
            items: pendingOrder.items || [],
            grandTotal: pendingOrder.grandTotal,
            subTotal: pendingOrder.subTotal,
            deliveryCharges: pendingOrder.deliveryCharges,
            gst: pendingOrder.gst,
            platformFee: pendingOrder.platformFee,
            surgeFee: pendingOrder.surgeFee,
            discountAmount: pendingOrder.discountAmount,
            restaurantName: pendingOrder.restaurantName,
          },
        ],
      };

      const newReviewCard = {
        _id: `local_${Date.now()}`,
        orderId: pendingOrder.orderId,
        restaurantName: pendingOrder.restaurantName || 'Restaurant',
        deliveryBoyName: pendingOrder.deliveryBoyName || 'Delivery Partner',
        restaurantRating: Number(restaurantRating) || 0,
        restaurantReview: restaurantReview.trim(),
        deliveryBoyRating: Number(deliveryBoyRating) || 0,
        deliveryBoyReview: deliveryBoyReview.trim(),
        createdAt: new Date().toISOString(),
        orderDetails: [
          {
            items: pendingOrder.items || [],
            grandTotal: pendingOrder.grandTotal,
            subTotal: pendingOrder.subTotal,
            deliveryCharges: pendingOrder.deliveryCharges,
            gst: pendingOrder.gst,
            platformFee: pendingOrder.platformFee,
            surgeFee: pendingOrder.surgeFee,
            discountAmount: pendingOrder.discountAmount,
            restaurantName: pendingOrder.restaurantName,
          },
        ],
      };

      console.log('[MyReviews] Submitting review payload directly to MongoDB:', reviewPayload);

      const updatedLocalReviews = [
        newReviewCard,
        ...locallySubmittedReviews.filter((r) => String(r.orderId) !== currentOrderId),
      ];
      setLocallySubmittedReviews(updatedLocalReviews);
      await AsyncStorage.setItem('locally_submitted_reviews', JSON.stringify(updatedLocalReviews));

      // Save orderId to local submitted list & AsyncStorage immediately so it never asks again
      const updatedSubmitted = Array.from(new Set([...localSubmittedIds, currentOrderId]));
      setLocalSubmittedIds(updatedSubmitted);
      await AsyncStorage.setItem('submitted_reviewed_orders', JSON.stringify(updatedSubmitted));

      // Attempt POST to candidate review endpoints to support backend route variations
      const candidateEndpoints = [
        `${API_URL}/reviews`,
        `${API_URL}/reviews/user/${userid}`,
        `${API_URL}/reviews/${userid}`,
        `${API_URL}/reviews/order/${currentOrderId}`,
        `${API_URL}/reviews/${currentOrderId}`,
        `${API_URL}/reviews/create`,
        `${API_URL}/reviews/add`,
        `${API_URL}/reviews/submit`,
        `${API_URL}/reviews/add/${userid}`,
        `${API_URL}/reviews/create/${userid}`,
        `${API_URL}/review`,
        `${API_URL}/review/user/${userid}`,
        `${API_URL}/review/${userid}`,
        `${API_URL}/review/create`,
        `${API_URL}/review/add`,
        `${API_URL}/review/submit`,
        `${API_URL}/orders/review`,
        `${API_URL}/orders/${currentOrderId}/review`,
        `${API_URL}/order/${currentOrderId}/review`,
        `${API_URL}/api/reviews`,
        `${API_URL}/api/reviews/user/${userid}`,
        `${API_URL}/api/review`,
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
            console.log('[MyReviews] Successfully saved review in MongoDB at:', endpoint);
            successRes = true;
            break;
          } else {
            console.log('[MyReviews] Attempted endpoint', endpoint, 'returned status:', res.status);
          }
        } catch (postErr) {
          console.log('[MyReviews] POST to', endpoint, 'failed:', postErr.message);
        }
      }

      if (!successRes) {
        console.warn('[MyReviews] Review saved locally (backend endpoint responded with non-200 or 404).');
      }

      // Re-fetch profile data to refresh reviews state in Redux
      if (userid) {
        await dispatch(fetchProfileData(userid)).unwrap();
      }

      setReviewSubmitted(true);
      setPendingOrder(null);

      // Clear navigation route params
      router.setParams({ orderId: undefined, items: undefined, restaurantName: undefined });

      Alert.alert('Thank You! 🎉', 'Your review has been submitted successfully.');
    } catch (err) {
      console.error('[MyReviews] Review submission error:', err);

      const userid = await AsyncStorage.getItem('userid');
      if (userid) {
        dispatch(fetchProfileData(userid));
      }
      setReviewSubmitted(true);
      setPendingOrder(null);
      router.setParams({ orderId: undefined, items: undefined, restaurantName: undefined });
      Alert.alert('Review Recorded', 'Thank you for your feedback!');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingView />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Custom Header */}
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

        {/* ── Pending Order Review Form Card (If user has an unreviewed order) ── */}
        {pendingOrder && !reviewSubmitted && (
          <View style={styles.pendingCard}>
            <View style={styles.pendingBadgeRow}>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>⭐ Rate Your Order</Text>
              </View>
              <Text style={styles.orderTitle}>Order #{pendingOrder.orderId}</Text>
            </View>

            <Text style={styles.restaurantNameTag}>
              Ordering from: {pendingOrder.restaurantName}
            </Text>

            {/* Items & Price Breakdown Box */}
            <View style={styles.detailsBox}>
              <Text style={styles.detailsBoxTitle}>Order Details & Summary</Text>

              {pendingOrder.items && pendingOrder.items.length > 0 ? (
                pendingOrder.items.map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemName}>{item.name || item.itemName || 'Item'}</Text>
                    <Text style={styles.itemQty}>{item.quantity || item.qty || 1}x</Text>
                    <Text style={styles.itemCost}>{formatCurrency(item.cost || item.price || item.amount)}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ fontSize: 13, color: '#8E8E93' }}>Standard order items</Text>
              )}

              {/* Price Breakdown */}
              <View style={styles.priceBreakdown}>
                {pendingOrder.subTotal ? (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Sub Total</Text>
                    <Text style={styles.priceValue}>{formatCurrency(pendingOrder.subTotal)}</Text>
                  </View>
                ) : null}
                {pendingOrder.deliveryCharges ? (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Delivery Charges</Text>
                    <Text style={styles.priceValue}>{formatCurrency(pendingOrder.deliveryCharges)}</Text>
                  </View>
                ) : null}
                {pendingOrder.surgeFee && Number(pendingOrder.surgeFee) > 0 ? (
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: '#FF5E5E' }]}>⚡ Surge Fee</Text>
                    <Text style={[styles.priceValue, { color: '#FF5E5E' }]}>{formatCurrency(pendingOrder.surgeFee)}</Text>
                  </View>
                ) : null}
                {pendingOrder.gst ? (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>GST</Text>
                    <Text style={styles.priceValue}>{formatCurrency(pendingOrder.gst)}</Text>
                  </View>
                ) : null}
                {pendingOrder.platformFee ? (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Platform Fee</Text>
                    <Text style={styles.priceValue}>{formatCurrency(pendingOrder.platformFee)}</Text>
                  </View>
                ) : null}
                {pendingOrder.discountAmount && Number(pendingOrder.discountAmount) > 0 ? (
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: '#2E7D32' }]}>Discount</Text>
                    <Text style={[styles.priceValue, { color: '#2E7D32' }]}>-{formatCurrency(pendingOrder.discountAmount)}</Text>
                  </View>
                ) : null}
                {pendingOrder.grandTotal ? (
                  <View style={styles.totalPriceRow}>
                    <Text style={styles.totalPriceLabel}>Total Paid</Text>
                    <Text style={styles.totalPriceValue}>{formatCurrency(pendingOrder.grandTotal)}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* 1. Restaurant Rating & Description */}
            <View style={styles.experienceBox}>
              <Text style={styles.experienceTitle}>Rate Restaurant ({pendingOrder.restaurantName})</Text>
              {renderInteractiveStars(restaurantRating, setRestaurantRating)}
              <TextInput
                style={styles.textInput}
                placeholder="Write your review for the restaurant..."
                placeholderTextColor="#999999"
                multiline
                numberOfLines={3}
                value={restaurantReview}
                onChangeText={setRestaurantReview}
              />
            </View>

            {/* 2. Delivery Boy Rating & Description */}
            <View style={styles.experienceBox}>
              <Text style={styles.experienceTitle}>
                Rate Delivery Partner ({pendingOrder.deliveryBoyName || 'Delivery Savior'})
              </Text>
              {renderInteractiveStars(deliveryBoyRating, setDeliveryBoyRating)}
              <TextInput
                style={styles.textInput}
                placeholder="Write your review for the delivery partner..."
                placeholderTextColor="#999999"
                multiline
                numberOfLines={3}
                value={deliveryBoyReview}
                onChangeText={setDeliveryBoyReview}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmitReview}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Review</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Section Title for Given Reviews */}
        {displayReviews.length > 0 && (
          <Text style={styles.sectionHeaderTitle}>Your Given Reviews</Text>
        )}

        {/* Reviews List */}
        {displayReviews.length === 0 && !pendingOrder ? (
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
                {/* Header Title */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.orderTitle}>Order #{review.orderId}</Text>
                  <Text style={styles.dateText}>{formatDate(review.createdAt)}</Text>
                </View>

                {restaurantName ? (
                  <Text style={[styles.restaurantNameTag, { marginBottom: 10 }]}>{restaurantName}</Text>
                ) : null}

                {/* Restaurant Experience Box */}
                <View style={styles.experienceBox}>
                  <Text style={styles.experienceTitle}>Restaurant Experience</Text>
                  {renderStars(review.restaurantRating)}
                  {review.restaurantReview && review.restaurantReview.trim() ? (
                    <Text style={styles.reviewCommentText}>
                      {`"${review.restaurantReview.trim()}"`}
                    </Text>
                  ) : null}
                </View>

                {/* Delivery Experience Box */}
                <View style={styles.experienceBox}>
                  <Text style={styles.experienceTitle}>Delivery Experience</Text>
                  {renderStars(review.deliveryBoyRating)}
                  {review.deliveryBoyReview && review.deliveryBoyReview.trim() ? (
                    <Text style={styles.reviewCommentText}>
                      {`"${review.deliveryBoyReview.trim()}"`}
                    </Text>
                  ) : null}
                </View>

                {/* Full Items & Price Breakdown Box */}
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

                    {/* Price Breakdown */}
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

