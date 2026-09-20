import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  BackHandler,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { useTabBar } from '../../_layout';
import { styles } from '../../../styles/myorders.styles';
import LoadingView from '../../../components/LoadingView';
import { fetchProfileData } from '../../../store/restaurantsSlice';

const generateInvoiceHtml = (order, customerInfo = {}) => {
  const restaurantName = order.restaurantName || 'Leevon Partner Restaurant';
  const orderId = order.orderId || order._id || 'N/A';
  const dateStr = order.orderDate || order.completedAt || order.createdAt || new Date().toISOString();
  const formattedDate = new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const items = order.items || [];
  const subTotal = order.subTotal ?? order.subtotal ?? order.totalPrice ?? 0;
  const deliveryFee = order.deliveryFee ?? order.delivery_fee ?? order.deliveryCharges ?? 0;
  const gst = order.gst ?? order.tax ?? 0;
  const platformFee = order.platformFee ?? order.platform_fee ?? 0;
  const packagingFee = order.packagingFee ?? order.packaging_fee ?? order.packagingCharge ?? 0;
  const surgeFee = order.surgeFee ?? order.surge_fee ?? 0;
  const discountAmount = order.discountAmount ?? order.discount ?? 0;
  const couponDiscount = Number(order.couponDiscount !== undefined ? order.couponDiscount : (order.couponCode ? discountAmount : 0)) || 0;
  const tieredDiscount = Number(order.tieredDiscount || order.restaurantTieredDiscount || 0);
  const tieredDiscountLabel = order.tieredDiscountLabel || (tieredDiscount > 0 ? 'Instant Bill Savings' : '');
  const totalSavings = Number(order.totalSavings !== undefined ? order.totalSavings : ((couponDiscount + tieredDiscount) || discountAmount || 0)) || 0;
  const grandTotal = order.grandTotal ?? order.totalPrice ?? order.total ?? 0;

  const customerName = customerInfo.name || 'Customer';
  const customerPhone = customerInfo.phone || 'N/A';
  const deliveryAddress = order.deliveryAddress || customerInfo.address || 'Kurnool, Andhra Pradesh';

  const itemsTableRows = items.map((item, idx) => {
    const isFree = Boolean(item.isFreeItem || item.isFree || item.cost === 0 || item.price === 0);
    const bogoTag = item.bogoTag || (isFree ? '1+1 FREE' : (item.isBogo ? '1+1 Offer' : ''));
    const itemName = item.name || item.itemName || 'Food Item';
    const tagText = bogoTag ? ` <span style="font-size: 11px; color: #047857; font-weight: 600;">(${bogoTag})</span>` : '';
    const itemCost = Number(item.cost !== undefined ? item.cost : (item.price || 0));
    const qty = Number(item.quantity || item.qty || 1);
    const unitPrice = isFree ? 'FREE (₹0.00)' : `₹${itemCost.toFixed(2)}`;
    const lineTotal = isFree ? '₹0.00' : `₹${(itemCost * qty).toFixed(2)}`;

    return `
    <tr ${isFree ? 'style="background-color: #F0FDF4;"' : ''}>
      <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: center;">${idx + 1}</td>
      <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; font-weight: 600;">${itemName}${tagText}</td>
      <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: center;">${qty}</td>
      <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: right;">${unitPrice}</td>
      <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: 600;">${lineTotal}</td>
    </tr>
  `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Tax Invoice - ${orderId}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1F2937;
            background: #FFFFFF;
            margin: 0;
            padding: 24px;
          }
          .invoice-box {
            max-width: 800px;
            margin: auto;
            padding: 24px;
            border: 1px solid #E5E7EB;
            border-radius: 12px;
          }
          .header-table {
            width: 100%;
            margin-bottom: 20px;
          }
          .brand-title {
            font-size: 24px;
            font-weight: 800;
            color: #1E3545;
            margin: 0;
          }
          .brand-sub {
            font-size: 12px;
            color: #6B7280;
            margin-top: 4px;
          }
          .invoice-title {
            font-size: 20px;
            font-weight: 700;
            color: #0284C7;
            text-align: right;
          }
          .details-table {
            width: 100%;
            margin-bottom: 24px;
            background: #F9FAFB;
            border-radius: 8px;
            padding: 14px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
          }
          .items-table th {
            background: #F3F4F6;
            padding: 10px;
            text-align: left;
            font-size: 12px;
            text-transform: uppercase;
            color: #4B5563;
          }
          .summary-table {
            width: 320px;
            margin-left: auto;
            margin-bottom: 24px;
          }
          .summary-table td {
            padding: 6px 12px;
          }
          .total-row {
            font-weight: 800;
            font-size: 16px;
            color: #1E3545;
            border-top: 2px solid #E5E7EB;
          }
          .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 700;
            background: #DEF7EC;
            color: #03543F;
          }
          @media print {
            body { padding: 0; }
            .invoice-box { border: none; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <table class="header-table">
            <tr>
              <td>
                <h1 class="brand-title">LEEVON DELIVERY</h1>
                <div class="brand-sub">Kurnool, Andhra Pradesh | Customer Support: +91 7207610235</div>
              </td>
              <td style="text-align: right;">
                <div class="invoice-title">TAX INVOICE</div>
                <div style="font-size: 12px; color: #6B7280; margin-top: 4px;">Invoice #: <b>INV-${orderId}</b></div>
                <div style="font-size: 12px; color: #6B7280;">Date: ${formattedDate}</div>
              </td>
            </tr>
          </table>

          <table class="details-table">
            <tr>
              <td style="width: 50%; vertical-align: top;">
                <div style="font-size: 11px; color: #6B7280; text-transform: uppercase; font-weight: 700;">Customer Details</div>
                <div style="font-size: 14px; font-weight: 700; color: #1F2937; margin-top: 2px;">${customerName}</div>
                <div style="font-size: 12px; color: #4B5563;">Phone: ${customerPhone}</div>
                <div style="font-size: 12px; color: #4B5563;">Address: ${deliveryAddress}</div>
              </td>
              <td style="width: 50%; vertical-align: top; text-align: right;">
                <div style="font-size: 11px; color: #6B7280; text-transform: uppercase; font-weight: 700;">Restaurant Details</div>
                <div style="font-size: 14px; font-weight: 700; color: #1F2937; margin-top: 2px;">${restaurantName}</div>
                <div style="font-size: 12px; color: #4B5563; margin-top: 4px;">
                  Payment Status: <span class="badge">PAID</span>
                </div>
              </td>
            </tr>
          </table>

          <table class="items-table">
            <thead>
              <tr>
                <th style="text-align: center; width: 40px;">#</th>
                <th>Item Description</th>
                <th style="text-align: center; width: 60px;">Qty</th>
                <th style="text-align: right; width: 100px;">Price</th>
                <th style="text-align: right; width: 100px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsTableRows}
            </tbody>
          </table>

          <table class="summary-table">
            <tr>
              <td style="color: #6B7280;">Sub Total:</td>
              <td style="text-align: right; font-weight: 600;">₹${Number(subTotal).toFixed(2)}</td>
            </tr>
            ${deliveryFee ? `
            <tr>
              <td style="color: #6B7280;">Delivery Fee:</td>
              <td style="text-align: right; font-weight: 600;">₹${Number(deliveryFee).toFixed(2)}</td>
            </tr>` : ''}
            ${packagingFee && Number(packagingFee) > 0 ? `
            <tr>
              <td style="color: #6B7280;">Packaging Charges:</td>
              <td style="text-align: right; font-weight: 600;">₹${Number(packagingFee).toFixed(2)}</td>
            </tr>` : ''}
            ${surgeFee ? `
            <tr>
              <td style="color: #EF4444;">Surge Fee:</td>
              <td style="text-align: right; font-weight: 600; color: #EF4444;">₹${Number(surgeFee).toFixed(2)}</td>
            </tr>` : ''}
            ${gst ? (() => {
               const gNum = Number(gst) || 0;
               const foodGstVal = order.foodGst !== undefined ? Number(order.foodGst) : ((Number(subTotal || order.totalPrice) || 0) * 0.05);
               const delFeeVal = Number(deliveryFee) || 0;
               const deliveryGstVal = order.deliveryGst !== undefined ? Number(order.deliveryGst) : (delFeeVal * 0.18);
               const fHalf = (foodGstVal / 2).toFixed(2);
               const dHalf = (deliveryGstVal / 2).toFixed(2);
               return `
             <tr>
               <td style="color: #1F2937; font-weight: 700;">GST & Taxes (Total):</td>
               <td style="text-align: right; font-weight: 700; color: #1F2937;">₹${gNum.toFixed(2)}</td>
             </tr>
             <tr>
               <td style="color: #4B5563; font-weight: 600; font-size: 12px; padding-left: 8px;">Food GST (5%):</td>
               <td style="text-align: right; font-size: 12px; color: #4B5563; font-weight: 600;">₹${foodGstVal.toFixed(2)}</td>
             </tr>
             <tr>
               <td style="color: #9CA3AF; font-size: 11px; padding-left: 18px;">CGST (2.5%):</td>
               <td style="text-align: right; font-size: 11px; color: #6B7280;">₹${fHalf}</td>
             </tr>
             <tr>
               <td style="color: #9CA3AF; font-size: 11px; padding-left: 18px;">SGST (2.5%):</td>
               <td style="text-align: right; font-size: 11px; color: #6B7280;">₹${fHalf}</td>
             </tr>
             ${deliveryGstVal > 0 ? `
             <tr>
               <td style="color: #4B5563; font-weight: 600; font-size: 12px; padding-left: 8px;">Delivery Services GST (18%):</td>
               <td style="text-align: right; font-size: 12px; color: #4B5563; font-weight: 600;">₹${deliveryGstVal.toFixed(2)}</td>
             </tr>
             <tr>
               <td style="color: #9CA3AF; font-size: 11px; padding-left: 18px;">CGST (9.0%):</td>
               <td style="text-align: right; font-size: 11px; color: #6B7280;">₹${dHalf}</td>
             </tr>
             <tr>
               <td style="color: #9CA3AF; font-size: 11px; padding-left: 18px;">SGST (9.0%):</td>
               <td style="text-align: right; font-size: 11px; color: #6B7280;">₹${dHalf}</td>
             </tr>` : ''}`;
             })() : ''}
            ${tieredDiscount > 0 ? `
            <tr>
              <td style="color: #047857;">Instant Bill Savings${tieredDiscountLabel ? ` (${tieredDiscountLabel})` : ''}:</td>
              <td style="text-align: right; font-weight: 600; color: #047857;">- ₹${tieredDiscount.toFixed(2)}</td>
            </tr>` : ''}
            ${couponDiscount > 0 ? `
            <tr>
              <td style="color: #047857;">Coupon Discount${order.couponCode ? ` (${order.couponCode})` : ''}:</td>
              <td style="text-align: right; font-weight: 600; color: #047857;">- ₹${couponDiscount.toFixed(2)}</td>
            </tr>` : ''}
            ${(!tieredDiscount && !couponDiscount && discountAmount > 0) ? `
            <tr>
              <td style="color: #047857;">Discount:</td>
              <td style="text-align: right; font-weight: 600; color: #047857;">- ₹${Number(discountAmount).toFixed(2)}</td>
            </tr>` : ''}
            <tr class="total-row">
              <td>Grand Total:</td>
              <td style="text-align: right;">₹${Number(grandTotal).toFixed(2)}</td>
            </tr>
            ${totalSavings > 0 ? `
            <tr>
              <td style="color: #065F46; font-weight: 700; border-top: 1px dashed #D1D5DB; padding-top: 6px;">Total Savings on Order:</td>
              <td style="text-align: right; font-weight: 700; color: #065F46; border-top: 1px dashed #D1D5DB; padding-top: 6px;">- ₹${totalSavings.toFixed(2)}</td>
            </tr>` : ''}
            <tr class="total-row">
              <td>Grand Total:</td>
              <td style="text-align: right;">₹${Number(grandTotal).toFixed(2)}</td>
            </tr>
          </table>

          <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; text-align: center; font-size: 12px; color: #9CA3AF;">
            Thank you for ordering with <b>Leevon Delivery</b>! For support, visit www.leevondelivery.in
          </div>
        </div>
      </body>
    </html>
  `;
};

export default function MyOrdersScreen() {
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
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
      return () => subscription.remove();
    }, [handleBack])
  );

  const orders = useSelector((state) => state.restaurants.orders || []);
  const profileLoaded = useSelector((state) => state.restaurants.profileLoaded);
  const profileLoadedUserId = useSelector((state) => state.restaurants.profileLoadedUserId);
  const profileLoading = useSelector((state) => state.restaurants.profileLoading);

  const [currentUserId, setCurrentUserId] = useState('');
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printingOrderId, setPrintingOrderId] = useState(null);

  // Invoice Preview Modal states
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [customerInfo, setCustomerInfo] = useState({ name: 'Customer', phone: '' });

  const handleOpenPreview = async (order) => {
    try {
      const name = (await AsyncStorage.getItem('name')) || 'Customer';
      const phone = (await AsyncStorage.getItem('phone')) || '';
      setCustomerInfo({ name, phone });
      setPreviewOrder(order);
      setPreviewModalVisible(true);
    } catch (e) {
      console.warn('Error fetching customer info for invoice preview:', e);
      setPreviewOrder(order);
      setPreviewModalVisible(true);
    }
  };

  const handlePrintInvoice = async (order) => {
    if (!order) return;
    try {
      setPrintingOrderId(order._id);
      const name = customerInfo.name || (await AsyncStorage.getItem('name')) || 'Customer';
      const phone = customerInfo.phone || (await AsyncStorage.getItem('phone')) || '';
      const html = generateInvoiceHtml(order, { name, phone });

      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 500);
        } else {
          Alert.alert('Pop-up Blocked', 'Please allow pop-ups for this site to print your invoice.');
        }
      } else {
        let Print = null;
        let Sharing = null;
        try {
          Print = require('expo-print');
          Sharing = require('expo-sharing');
        } catch (e) {
          console.warn('Native expo-print module not available:', e);
        }

        if (Print && typeof Print.printToFileAsync === 'function') {
          const { uri } = await Print.printToFileAsync({ html });
          console.log('[Invoice] Generated PDF file URI:', uri);
          if (Sharing && typeof Sharing.isAvailableAsync === 'function' && await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              UTI: '.pdf',
              mimeType: 'application/pdf',
              dialogTitle: `Invoice_${order.orderId || 'Leevon'}`,
            });
          } else {
            await Print.printAsync({ html });
          }
        } else if (Print && typeof Print.printAsync === 'function') {
          await Print.printAsync({ html });
        } else {
          Alert.alert('Printing Not Supported', 'PDF printing is not supported on this build environment.');
        }
      }
    } catch (err) {
      console.error('Failed to generate/print invoice:', err);
      Alert.alert('Invoice Error', 'Failed to generate invoice PDF. Please try again.');
    } finally {
      setPrintingOrderId(null);
    }
  };

  // Always check current logged-in user and fetch their specific orders
  const loadUserOrders = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) setRefreshing(true);
    try {
      const userid = await AsyncStorage.getItem('userid');
      if (userid) {
        const uidStr = String(userid).trim();
        setCurrentUserId(uidStr);
        // Unblock UI immediately on frame 0
        setScreenLoading(false);
        // Fetch fresh orders in background
        dispatch(fetchProfileData(uidStr)).finally(() => {
          setRefreshing(false);
        });
      } else {
        setCurrentUserId('');
        setScreenLoading(false);
        setRefreshing(false);
      }
    } catch (err) {
      console.error('[MyOrders] Error fetching orders:', err);
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadUserOrders(false);
    }, [loadUserOrders])
  );

  const displayOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    const activeUid = currentUserId || profileLoadedUserId || '';
    return orders.filter((o) => {
      if (!o) return false;
      const oUid = String(o.userId || o.user_id || o.userid || o.customerId || o.customer_id || '').trim();
      if (!oUid || !activeUid) return true; // keep if backend omits field in response
      return oUid === activeUid;
    });
  }, [orders, currentUserId, profileLoadedUserId]);

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
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
      return String(dateStr).split(',')[0];
    } catch {
      return String(dateStr);
    }
  };

  const isInitialLoading = (!profileLoaded || profileLoading || screenLoading) && displayOrders.length === 0;

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
            onRefresh={() => loadUserOrders(true)}
            colors={['#1E3545']}
            tintColor="#1E3545"
          />
        }
      >
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, styles.shadow]} onPress={handleBack} activeOpacity={0.8}>
            <Feather name="chevron-left" size={24} color="#000000" />
          </TouchableOpacity>

          <View style={[styles.headerTitleCard, styles.shadow]}>
            <Feather name="package" size={18} color="#000000" />
            <Text style={styles.headerTitleText}>My Orders</Text>
          </View>

          <View style={styles.placeholderRight} />
        </View>

        {/* Orders List or Loader */}
        {isInitialLoading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#1E3545" />
            <Text style={{ marginTop: 14, fontSize: 14, color: '#666666', fontWeight: '600' }}>
              Loading your orders...
            </Text>
          </View>
        ) : displayOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="inbox" size={48} color="#C8C7CC" />
            <Text style={styles.emptyText}>No completed orders yet</Text>
          </View>
        ) : (
          displayOrders.map((order) => (
            <View key={order._id || order.orderId} style={[styles.orderCard, styles.shadow]}>
              {/* Header */}
              <View style={styles.orderCardHeader}>
                <Text style={styles.restaurantName} numberOfLines={1}>
                  {order.restaurantName || 'Restaurant'}
                </Text>
                <Text style={styles.grandTotal}>
                  ₹{order.grandTotal ?? order.totalPrice ?? order.total ?? 0}
                </Text>
              </View>

              {/* Order ID */}
              <Text style={styles.orderIdText}>
                Order ID: {order.orderId || order._id || 'N/A'}
              </Text>

              <View style={styles.separator} />

              {/* Items List */}
              <Text style={styles.itemsTitle}>Items</Text>
              {order.items && order.items.map((item, idx) => {
                const isFree = Boolean(item.isFreeItem || item.isFree || item.cost === 0 || item.price === 0);
                const bogoTag = item.bogoTag || (isFree ? '1+1 FREE' : (item.isBogo ? '1+1 Offer' : null));
                const iName = item.name || item.itemName || 'Food Item';
                const iQty = item.quantity || item.qty || 1;
                const iPrice = Number(item.cost !== undefined ? item.cost : (item.price || 0));
                return (
                  <View key={item._id || idx} style={styles.itemRow}>
                    <Text style={[styles.itemName, isFree ? { color: '#15803D', fontWeight: '700' } : null]} numberOfLines={1}>
                      {iName}{bogoTag ? ` (${bogoTag})` : ''}
                    </Text>
                    <Text style={styles.itemQty}>
                      x{iQty}
                    </Text>
                    <Text style={[styles.itemPrice, isFree ? { color: '#15803D', fontWeight: '700' } : null]}>
                      {isFree ? 'FREE (₹0.00)' : `₹${(iPrice * iQty).toFixed(0)}`}
                    </Text>
                  </View>
                );
              })}

              {/* Footer */}
              <View style={styles.orderFooter}>
                <View style={styles.statusContainer}>
                  <Feather name="check-circle" size={14} color="#15803D" />
                  <Text style={styles.statusText}>{order.status || 'Completed'}</Text>
                </View>
                <Text style={styles.dateText}>
                  {formatDate(order.orderDate || order.completedAt || order.createdAt)}
                </Text>
              </View>

              {/* Print Invoice Action Button (Triggers Preview Modal) */}
              <View style={styles.printInvoiceContainer}>
                <TouchableOpacity
                  style={[styles.printInvoiceButton, printingOrderId === order._id && { opacity: 0.6 }]}
                  onPress={() => handleOpenPreview(order)}
                  activeOpacity={0.85}
                  disabled={printingOrderId === order._id}
                >
                  {printingOrderId === order._id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="file-text" size={15} color="#FFFFFF" />
                      <Text style={styles.printInvoiceButtonText}>Invoice Preview</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Invoice Preview Modal */}
      <Modal
        visible={previewModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tax Invoice Preview</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setPreviewModalVisible(false)}
                activeOpacity={0.7}
              >
                <Feather name="x" size={18} color="#4B5563" />
              </TouchableOpacity>
            </View>

            {previewOrder && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
                <View style={styles.invoicePaper}>
                  {/* Brand & Invoice Header */}
                  <View style={styles.invoiceHeader}>
                    <Text style={styles.brandTitle}>LEEVON DELIVERY</Text>
                    <Text style={styles.taxInvoiceSubtitle}>Tax Invoice</Text>
                  </View>

                  {/* Invoice Details */}
                  <View style={styles.invoiceMetaRow}>
                    <Text style={styles.invoiceMetaLabel}>Invoice #:</Text>
                    <Text style={styles.invoiceMetaValue}>INV-{previewOrder.orderId || previewOrder._id || 'N/A'}</Text>
                  </View>
                  <View style={styles.invoiceMetaRow}>
                    <Text style={styles.invoiceMetaLabel}>Date & Time:</Text>
                    <Text style={styles.invoiceMetaValue}>
                      {new Date(previewOrder.orderDate || previewOrder.completedAt || previewOrder.createdAt || Date.now()).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={styles.invoiceMetaRow}>
                    <Text style={styles.invoiceMetaLabel}>Restaurant:</Text>
                    <Text style={styles.invoiceMetaValue}>{previewOrder.restaurantName || 'Leevon Partner'}</Text>
                  </View>
                  <View style={styles.invoiceMetaRow}>
                    <Text style={styles.invoiceMetaLabel}>Billed To:</Text>
                    <Text style={styles.invoiceMetaValue}>{customerInfo.name || 'Customer'} ({customerInfo.phone || 'N/A'})</Text>
                  </View>

                  {/* Items List */}
                  <Text style={styles.previewSectionTitle}>Items Ordered</Text>
                  {previewOrder.items && previewOrder.items.length > 0 ? (
                    previewOrder.items.map((item, idx) => {
                      const isFree = Boolean(item.isFreeItem || item.isFree || item.cost === 0 || item.price === 0);
                      const bogoTag = item.bogoTag || (isFree ? '1+1 FREE' : (item.isBogo ? '1+1 Offer' : null));
                      const iName = item.name || item.itemName || 'Item';
                      const iQty = item.quantity || item.qty || 1;
                      const iPrice = Number(item.cost !== undefined ? item.cost : (item.price || 0));
                      return (
                        <View key={item._id || idx} style={styles.previewItemRow}>
                          <Text style={[styles.previewItemName, isFree ? { color: '#15803D', fontWeight: '700' } : null]} numberOfLines={1}>
                            {iName}{bogoTag ? ` (${bogoTag})` : ''}
                          </Text>
                          <Text style={styles.previewItemQty}>x{iQty}</Text>
                          <Text style={[styles.previewItemPrice, isFree ? { color: '#15803D', fontWeight: '700' } : null]}>
                            {isFree ? 'FREE (₹0.00)' : `₹${(iPrice * iQty).toFixed(0)}`}
                          </Text>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Standard items list</Text>
                  )}

                  {/* Price Breakdown */}
                  <Text style={styles.previewSectionTitle}>Payment Summary</Text>

                  {previewOrder.subTotal || previewOrder.subtotal ? (
                    <View style={styles.previewPriceRow}>
                      <Text style={styles.previewPriceLabel}>Sub Total</Text>
                      <Text style={styles.previewPriceValue}>₹{previewOrder.subTotal ?? previewOrder.subtotal}</Text>
                    </View>
                  ) : null}

                  {previewOrder.deliveryFee || previewOrder.deliveryCharges ? (
                    <View style={styles.previewPriceRow}>
                      <Text style={styles.previewPriceLabel}>Delivery Fee</Text>
                      <Text style={styles.previewPriceValue}>₹{previewOrder.deliveryFee ?? previewOrder.deliveryCharges}</Text>
                    </View>
                  ) : null}

                  {previewOrder.surgeFee && Number(previewOrder.surgeFee) > 0 ? (
                    <View style={styles.previewPriceRow}>
                      <Text style={[styles.previewPriceLabel, { color: '#EF4444' }]}>⚡ Surge Fee</Text>
                      <Text style={[styles.previewPriceValue, { color: '#EF4444' }]}>₹{previewOrder.surgeFee}</Text>
                    </View>
                  ) : null}

                  {previewOrder.packagingFee && Number(previewOrder.packagingFee) > 0 ? (
                    <View style={styles.previewPriceRow}>
                      <Text style={styles.previewPriceLabel}>Packaging Charges</Text>
                      <Text style={styles.previewPriceValue}>₹{Number(previewOrder.packagingFee).toFixed(2)}</Text>
                    </View>
                  ) : null}

                  {(previewOrder.gst || previewOrder.tax) ? (() => {
                    const gNum = Number(previewOrder.gst ?? previewOrder.tax) || 0;
                    const foodGstVal = previewOrder.foodGst !== undefined ? Number(previewOrder.foodGst) : ((Number(previewOrder.totalPrice) || 0) * 0.05);
                    const delFeeVal = Number(previewOrder.deliveryFee) || 0;
                    const deliveryGstVal = previewOrder.deliveryGst !== undefined ? Number(previewOrder.deliveryGst) : (delFeeVal * 0.18);
                    const fHalf = (foodGstVal / 2).toFixed(2);
                    const dHalf = (deliveryGstVal / 2).toFixed(2);
                    return (
                      <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginVertical: 4, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <View style={styles.previewPriceRow}>
                          <Text style={[styles.previewPriceLabel, { fontWeight: '700', color: '#1E293B' }]}>GST & Taxes (Total)</Text>
                          <Text style={[styles.previewPriceValue, { fontWeight: '700', color: '#1E293B' }]}>₹{gNum.toFixed(2)}</Text>
                        </View>

                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 4, marginBottom: 2 }}>
                          Food GST (5%): ₹{foodGstVal.toFixed(2)}
                        </Text>
                        <View style={[styles.previewPriceRow, { paddingLeft: 12, marginVertical: 1 }]}>
                          <Text style={[styles.previewPriceLabel, { fontSize: 11, color: '#64748B' }]}>CGST (2.5%)</Text>
                          <Text style={[styles.previewPriceValue, { fontSize: 11, color: '#64748B' }]}>₹{fHalf}</Text>
                        </View>
                        <View style={[styles.previewPriceRow, { paddingLeft: 12, marginVertical: 1 }]}>
                          <Text style={[styles.previewPriceLabel, { fontSize: 11, color: '#64748B' }]}>SGST (2.5%)</Text>
                          <Text style={[styles.previewPriceValue, { fontSize: 11, color: '#64748B' }]}>₹{fHalf}</Text>
                        </View>

                        {deliveryGstVal > 0 && (
                          <>
                            <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 }} />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 2 }}>
                              Delivery Services GST (18%): ₹{deliveryGstVal.toFixed(2)}
                            </Text>
                            <View style={[styles.previewPriceRow, { paddingLeft: 12, marginVertical: 1 }]}>
                              <Text style={[styles.previewPriceLabel, { fontSize: 11, color: '#64748B' }]}>CGST (9.0%)</Text>
                              <Text style={[styles.previewPriceValue, { fontSize: 11, color: '#64748B' }]}>₹{dHalf}</Text>
                            </View>
                            <View style={[styles.previewPriceRow, { paddingLeft: 12, marginVertical: 1 }]}>
                              <Text style={[styles.previewPriceLabel, { fontSize: 11, color: '#64748B' }]}>SGST (9.0%)</Text>
                              <Text style={[styles.previewPriceValue, { fontSize: 11, color: '#64748B' }]}>₹{dHalf}</Text>
                            </View>
                          </>
                        )}
                      </View>
                    );
                  })() : null}

                  {(() => {
                    const prevDiscount = previewOrder.discountAmount ?? previewOrder.discount ?? 0;
                    const prevCouponDiscount = Number(previewOrder.couponDiscount !== undefined ? previewOrder.couponDiscount : (previewOrder.couponCode ? prevDiscount : 0)) || 0;
                    const prevTieredDiscount = Number(previewOrder.tieredDiscount || previewOrder.restaurantTieredDiscount || 0);
                    const prevTieredLabel = previewOrder.tieredDiscountLabel || (prevTieredDiscount > 0 ? 'Instant Bill Savings' : '');
                    const prevTotalSavings = Number(previewOrder.totalSavings !== undefined ? previewOrder.totalSavings : ((prevCouponDiscount + prevTieredDiscount) || prevDiscount || 0)) || 0;

                    return (
                      <>
                        {prevTieredDiscount > 0 ? (
                          <View style={styles.previewPriceRow}>
                            <Text style={[styles.previewPriceLabel, { color: '#16A34A' }]}>
                              Instant Bill Savings{prevTieredLabel ? ` (${prevTieredLabel})` : ''}
                            </Text>
                            <Text style={[styles.previewPriceValue, { color: '#16A34A' }]}>-₹{prevTieredDiscount.toFixed(2)}</Text>
                          </View>
                        ) : null}

                        {prevCouponDiscount > 0 ? (
                          <View style={styles.previewPriceRow}>
                            <Text style={[styles.previewPriceLabel, { color: '#16A34A' }]}>
                              Coupon Discount{previewOrder.couponCode ? ` (${previewOrder.couponCode})` : ''}
                            </Text>
                            <Text style={[styles.previewPriceValue, { color: '#16A34A' }]}>-₹{prevCouponDiscount.toFixed(2)}</Text>
                          </View>
                        ) : null}

                        {(!prevTieredDiscount && !prevCouponDiscount && prevDiscount > 0) ? (
                          <View style={styles.previewPriceRow}>
                            <Text style={[styles.previewPriceLabel, { color: '#16A34A' }]}>Discount</Text>
                            <Text style={[styles.previewPriceValue, { color: '#16A34A' }]}>-₹{Number(prevDiscount).toFixed(2)}</Text>
                          </View>
                        ) : null}

                        <View style={styles.previewTotalRow}>
                          <Text style={styles.previewTotalLabel}>Total Paid</Text>
                          <Text style={styles.previewTotalValue}>₹{previewOrder.grandTotal || previewOrder.totalPrice || 0}</Text>
                        </View>

                        {prevTotalSavings > 0 ? (
                          <View style={[styles.previewPriceRow, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#E5E7EB' }]}>
                            <Text style={[styles.previewPriceLabel, { color: '#15803D', fontWeight: '700' }]}>Total Savings on Order</Text>
                            <Text style={[styles.previewPriceValue, { color: '#15803D', fontWeight: '700' }]}>-₹{prevTotalSavings.toFixed(2)}</Text>
                          </View>
                        ) : null}
                      </>
                    );
                  })()}
                </View>
              </ScrollView>
            )}

            {/* Modal Action Buttons */}
            <View style={styles.modalFooterActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setPreviewModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelModalBtnText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmPrintBtn, printingOrderId === previewOrder?._id && { opacity: 0.6 }]}
                onPress={() => {
                  handlePrintInvoice(previewOrder);
                }}
                activeOpacity={0.85}
                disabled={printingOrderId === previewOrder?._id}
              >
                {printingOrderId === previewOrder?._id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="printer" size={16} color="#FFFFFF" />
                    <Text style={styles.confirmPrintBtnText}>Print / Save PDF</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
