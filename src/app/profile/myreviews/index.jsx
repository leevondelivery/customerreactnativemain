import { Feather, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  BackHandler,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { API_URL } from '../../../config';
import { fetchUserReviews, fetchProfileData } from '../../../store/restaurantsSlice';
import { styles } from '../../../styles/myreviews.styles';
import { useTabBar } from '../../_layout';

export default function MyReviewsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { showTabBar, hideTabBar } = useTabBar();
  const lastOffsetY = useRef(0);

  const handleBack = useCallback(() => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/profile');
      }
    } catch (_e) {
      router.replace('/profile');
    }
    return true;
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      showTabBar(true);
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
      return () => subscription.remove();
    }, [showTabBar, handleBack])
  );

  const reviews = useSelector((state) => state.restaurants.reviews || []);
  const completedOrders = useSelector((state) => state.restaurants.orders || []);
  const profileLoaded = useSelector((state) => state.restaurants.profileLoaded);
  const profileLoadedUserId = useSelector((state) => state.restaurants.profileLoadedUserId);
  const profileLoading = useSelector((state) => state.restaurants.profileLoading);

  const [currentUserId, setCurrentUserId] = useState(() => profileLoadedUserId || '');
  const [screenLoading, setScreenLoading] = useState(() => !profileLoaded && (!reviews || reviews.length === 0));
  const [refreshing, setRefreshing] = useState(false);

  const handleScroll = (event) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    const direction = currentOffset > lastOffsetY.current ? 'down' : 'up';
    if (Math.abs(currentOffset - lastOffsetY.current) > 15) {
      if (direction === 'down' && currentOffset > 60) hideTabBar();
      else if (direction === 'up') showTabBar();
      lastOffsetY.current = currentOffset;
    }
  };

  // Always check current logged-in user and fetch their specific reviews in the background
  const loadUserReviews = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) setRefreshing(true);
    try {
      const userid = await AsyncStorage.getItem('userid');
      if (userid) {
        const uidStr = String(userid).trim();
        setCurrentUserId(uidStr);
        setScreenLoading(false);
        // Fetch fresh reviews and orders in background
        dispatch(fetchProfileData(uidStr)).finally(() => {
          setRefreshing(false);
          setScreenLoading(false);
        });
      } else {
        setCurrentUserId('');
        setScreenLoading(false);
        setRefreshing(false);
      }
    } catch (err) {
      console.error('[MyReviews] Error fetching reviews:', err);
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadUserReviews(false);
    }, [loadUserReviews])
  );

  // Helper to safely extract Order ID from a review object
  const getOrderIdFromReview = (r) => {
    if (!r) return '';
    const id = r.orderId || r.order_id || r.orderID || r.orderIdStr || r.orderDetails?.[0]?.orderId || r.order?._id || r.order?.orderId || '';
    const str = String(id).trim();
    if (!str || str === 'undefined' || str === 'null' || str === 'N/A') return '';
    return str;
  };

  // Pre-index completed orders into a Map for instant O(1) lookups
  const completedOrdersMap = useMemo(() => {
    const map = new Map();
    if (Array.isArray(completedOrders)) {
      for (let i = 0; i < completedOrders.length; i++) {
        const o = completedOrders[i];
        if (!o) continue;
        const oId = String(o.orderId || o._id || o.id || '').replace(/^ord-/i, '').trim();
        if (oId) {
          map.set(oId, o);
        }
      }
    }
    return map;
  }, [completedOrders]);

  const displayReviews = useMemo(() => {
    if (!Array.isArray(reviews)) return [];
    const activeUid = currentUserId || profileLoadedUserId || '';
    return reviews.filter((r) => {
      if (!r) return false;
      const rUid = String(r.userId || r.user_id || r.userid || r.customerId || r.customer_id || '').trim();
      if (!rUid || !activeUid) return true; // keep if backend omits field in response
      return rUid === activeUid || rUid.toLowerCase() === activeUid.toLowerCase();
    }).sort((a, b) => {
      const dateA = new Date(a.createdAt || a.date || a.timestamp || 0);
      const dateB = new Date(b.createdAt || b.date || b.timestamp || 0);
      return dateB - dateA;
    });
  }, [reviews, currentUserId, profileLoadedUserId]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return String(dateStr).split(',')[0];
    } catch {
      return String(dateStr);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const maxStars = 5;
    const activeRating = Math.max(0, Math.min(maxStars, Math.round(Number(rating) || 0)));
    for (let i = 1; i <= maxStars; i++) {
      stars.push(
        <FontAwesome key={i} name={i <= activeRating ? 'star' : 'star-o'} size={16} color="#FFC107" />
      );
    }
    return <View style={styles.starsRow}>{stars}</View>;
  };

  const isInitialLoading = screenLoading && !profileLoaded && displayReviews.length === 0;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadUserReviews(true)}
            colors={['#1E3545']}
            tintColor="#1E3545"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, styles.shadow]}
            onPress={handleBack}
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

        {/* Reviews List or State */}
        {isInitialLoading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#1E3545" />
            <Text style={{ marginTop: 14, fontSize: 14, color: '#666666', fontWeight: '600' }}>
              Loading your reviews...
            </Text>
          </View>
        ) : displayReviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="message-square" size={48} color="#C8C7CC" />
            <Text style={styles.emptyText}>No reviews submitted yet</Text>
          </View>
        ) : (
          displayReviews.map((review, rIdx) => {
            if (!review) return null;
            const orderDetailsObj = review.orderDetails && Array.isArray(review.orderDetails) && review.orderDetails[0]
              ? review.orderDetails[0]
              : (review.orderDetails && typeof review.orderDetails === 'object' ? review.orderDetails : null);

            const rawOrderId = review.orderId || review.order_id || getOrderIdFromReview(review);
            const rawOrderIdClean = String(rawOrderId || '').replace(/^ord-/i, '').trim();

            const matchingCompletedOrder = rawOrderIdClean ? completedOrdersMap.get(rawOrderIdClean) || null : null;

            const restaurantName = review.restaurantName || orderDetailsObj?.restaurantName || matchingCompletedOrder?.restaurantName || matchingCompletedOrder?.name || 'Restaurant';

            const displayOrderId = rawOrderIdClean || 'N/A';

            const restRatingVal = Number(review.restaurantRating ?? review.rating ?? review.restRating ?? 0);
            const restReviewVal = String(review.restaurantReview ?? review.review ?? review.restReview ?? '').trim();
            const delivRatingVal = Number(review.deliveryBoyRating ?? review.deliveryRating ?? review.driverRating ?? 0);
            const delivReviewVal = String(review.deliveryBoyReview ?? review.deliveryReview ?? review.driverReview ?? '').trim();

            const hasRestaurantExperience = restRatingVal > 0 || restReviewVal.length > 0;
            const hasDeliveryExperience = delivRatingVal > 0 || delivReviewVal.length > 0;

            return (
              <View key={review._id || review.orderId || `review-${rIdx}`} style={styles.reviewCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.orderTitle}>Order ID - {displayOrderId}</Text>
                  <Text style={styles.dateText}>{formatDate(review.createdAt || review.date || review.timestamp)}</Text>
                </View>

                {restaurantName ? (
                  <Text style={[styles.restaurantNameTag, { marginBottom: 10 }]}>{restaurantName}</Text>
                ) : null}

                {/* Restaurant Experience (Shown only if given) */}
                {hasRestaurantExperience && (
                  <View style={styles.experienceBox}>
                    <Text style={styles.experienceTitle}>Restaurant Experience</Text>
                    {restRatingVal > 0 ? renderStars(restRatingVal) : null}
                    {restReviewVal ? (
                      <Text style={styles.reviewCommentText}>{restReviewVal}</Text>
                    ) : null}
                  </View>
                )}

                {/* Delivery Experience (Shown only if given) */}
                {hasDeliveryExperience && (
                  <View style={styles.experienceBox}>
                    <Text style={styles.experienceTitle}>Delivery Experience</Text>
                    {delivRatingVal > 0 ? renderStars(delivRatingVal) : null}
                    {delivReviewVal ? (
                      <Text style={styles.reviewCommentText}>{delivReviewVal}</Text>
                    ) : null}
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
