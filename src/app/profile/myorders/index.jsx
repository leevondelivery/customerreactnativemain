import { Feather } from '@expo/vector-icons';
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
import { styles } from './myorders.styles';
import LoadingView from '../../../components/LoadingView';
import { fetchProfileData } from '../../../store/restaurantsSlice';

export default function MyOrdersScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { showTabBar, hideTabBar } = useTabBar();
  const lastOffsetY = useRef(0);

  const orders = useSelector((state) => state.restaurants.orders || []);
  const profileLoaded = useSelector((state) => state.restaurants.profileLoaded);

  const [loading, setLoading] = useState(!profileLoaded);

  useEffect(() => {
    const checkAndFetch = async () => {
      if (!profileLoaded) {
        try {
          const userid = await AsyncStorage.getItem('userid');
          if (userid) {
            await dispatch(fetchProfileData(userid)).unwrap();
          }
        } catch (err) {
          console.error('Error fetching orders in background:', err);
        } finally {
          setLoading(false);
        }
      }
    };
    checkAndFetch();
  }, [profileLoaded, dispatch]);

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

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
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
          <TouchableOpacity style={[styles.backButton, styles.shadow]} onPress={() => router.replace('/profile')} activeOpacity={0.8}>
            <Feather name="chevron-left" size={24} color="#000000" />
          </TouchableOpacity>

          <View style={[styles.headerTitleCard, styles.shadow]}>
            <Feather name="package" size={18} color="#000000" />
            <Text style={styles.headerTitleText}>My Orders</Text>
          </View>

          <View style={styles.placeholderRight} />
        </View>

        {/* Orders List */}
        {orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="inbox" size={48} color="#C8C7CC" />
            <Text style={styles.emptyText}>No completed orders yet</Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order._id} style={[styles.orderCard, styles.shadow]}>
              {/* Header */}
              <View style={styles.orderCardHeader}>
                <Text style={styles.restaurantName} numberOfLines={1}>
                  {order.restaurantName || 'Restaurant'}
                </Text>
                <Text style={styles.grandTotal}>
                  ₹{order.grandTotal}
                </Text>
              </View>

              {/* Order ID */}
              <Text style={styles.orderIdText}>
                Order ID: {order.orderId}
              </Text>

              <View style={styles.separator} />

              {/* Items List */}
              <Text style={styles.itemsTitle}>Items</Text>
              {order.items && order.items.map((item, idx) => (
                <View key={item._id || idx} style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemQty}>
                    x{item.quantity}
                  </Text>
                  <Text style={styles.itemPrice}>
                    ₹{item.price * item.quantity}
                  </Text>
                </View>
              ))}

              {/* Footer */}
              <View style={styles.orderFooter}>
                <View style={styles.statusContainer}>
                  <Feather name="check-circle" size={14} color="#15803D" />
                  <Text style={styles.statusText}>Completed</Text>
                </View>
                <Text style={styles.dateText}>
                  {formatDate(order.orderDate || order.completedAt)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
