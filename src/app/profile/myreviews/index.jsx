import { Feather, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { useTabBar } from '../../_layout';
import { styles } from './myreviews.styles';
import LoadingView from '../../../components/LoadingView';
import { fetchProfileData } from '../../../store/restaurantsSlice';

export default function MyReviewsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { showTabBar, hideTabBar } = useTabBar();
  const lastOffsetY = useRef(0);

  const reviews = useSelector((state) => state.restaurants.reviews || []);
  const profileLoaded = useSelector((state) => state.restaurants.profileLoaded);

  const [loading, setLoading] = useState(!profileLoaded);

  const handleScroll = (event) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    const direction = currentOffset > lastOffsetY.current ? 'down' : 'up';

    if (Math.abs(currentOffset - lastOffsetY.current) > 15) {
      if (direction === 'down' && currentOffset > 60) {
        hideTabBar();
      } else if (direction === 'up') {
        showTabBar();
      }
      lastOffsetY.current = currentOffset;
    }
  };

  useEffect(() => {
    const checkAndFetch = async () => {
      if (!profileLoaded) {
        try {
          const userid = await AsyncStorage.getItem('userid');
          if (userid) {
            await dispatch(fetchProfileData(userid)).unwrap();
          }
        } catch (err) {
          console.error('Error fetching reviews in background:', err);
        } finally {
          setLoading(false);
        }
      }
    };
    checkAndFetch();
  }, [profileLoaded, dispatch]);

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
          name={i <= activeRating ? "star" : "star-o"}
          size={16}
          color="#FFC107" // gold star color matching screenshot
        />
      );
    }
    return <View style={styles.starsRow}>{stars}</View>;
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
          <TouchableOpacity style={[styles.backButton, styles.shadow]} onPress={() => router.replace('/profile')} activeOpacity={0.8}>
            <Feather name="chevron-left" size={24} color="#000000" />
          </TouchableOpacity>

          <View style={[styles.headerTitleCard, styles.shadow]}>
            <FontAwesome name="star" size={18} color="#FFC107" />
            <Text style={styles.headerTitleText}>My Reviews</Text>
          </View>

          <View style={styles.placeholderRight} />
        </View>

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="message-square" size={48} color="#C8C7CC" />
            <Text style={styles.emptyText}>No reviews submitted yet</Text>
          </View>
        ) : (
          reviews.map((review) => {
            // Retrieve matched items from lookup array
            const matchedItems = review.orderDetails && review.orderDetails[0] ? review.orderDetails[0].items : [];

            return (
              <View key={review._id} style={styles.reviewCard}>
                {/* Header Title */}
                <Text style={styles.orderTitle}>
                  Order #{review.orderId}
                </Text>
                <Text style={styles.dateText}>
                  {formatDate(review.createdAt)}
                </Text>

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

                {/* Separator line */}
                {matchedItems.length > 0 && <View style={styles.separator} />}

                {/* Order Items Badges */}
                {matchedItems.length > 0 && (
                  <View>
                    <Text style={styles.itemsTitle}>Items in this order:</Text>
                    <View style={styles.badgeContainer}>
                      {matchedItems.map((item, idx) => (
                        <View key={item._id || idx} style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {item.quantity} x {item.name}
                          </Text>
                        </View>
                      ))}
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
