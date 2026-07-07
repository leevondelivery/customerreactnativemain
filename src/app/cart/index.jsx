import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import LoadingView from '../../components/LoadingView';
import { API_URL } from '../../config';

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
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Address flow states
  const [userid, setUserid] = useState(null);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [flatNo, setFlatNo] = useState('');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [selectedTag, setSelectedTag] = useState('Home'); // Home, Office, Apartment, Other
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState(null);
  const [showAllAddresses, setShowAllAddresses] = useState(false);
  const [customAlert, setCustomAlert] = useState({ visible: false, title: '', message: '' });

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

  const loadCart = async () => {
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
  };

  const fetchSavedAddresses = async (uid) => {
    const targetUid = uid || userid;
    if (!targetUid) return;
    try {
      const response = await fetch(`${API_URL}/user/${targetUid}/addresses`);
      const data = await response.json();
      if (data.success) {
        setSavedAddresses(data.addresses || []);
      }
    } catch (error) {
      console.error("Error fetching saved addresses:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCart();
      const loadUserAndAddresses = async () => {
        const uid = await AsyncStorage.getItem('userid');
        setUserid(uid);
        const userPhone = await AsyncStorage.getItem('phone');
        setPhone(userPhone || '');
        const userName = await AsyncStorage.getItem('name');
        setName(userName || '');
        const userEmail = await AsyncStorage.getItem('email');
        setEmail(userEmail || '');
        if (uid) {
          fetchSavedAddresses(uid);
        }
      };
      loadUserAndAddresses();
    }, [userid])
  );

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
    try {
      const response = await fetch(`${API_URL}/user/${userid}/addresses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flatNo,
          street,
          landmark,
          tag: selectedTag,
        }),
      });
      const data = await response.json();
      if (data.success) {
        triggerToast('ADDRESS SAVED SUCCESSFULLY!', 'success');
        setSavedAddresses(data.addresses || []);
        // Reset manual fields after save
        setFlatNo('');
        setStreet('');
        setLandmark('');
        setSelectedTag('Home');
        setSelectedSavedAddressId(null);
      } else {
        Alert.alert('Error', data.message || 'Failed to save address.');
      }
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Could not connect to backend server.');
    }
  };

  const handleDeleteAddress = async (addressId) => {
    if (!userid || !addressId) return;
    try {
      const response = await fetch(`${API_URL}/user/${userid}/addresses/${addressId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        setSavedAddresses(data.addresses || []);
        // If the selected address was deleted, reset selection and manual fields
        if (selectedSavedAddressId === addressId) {
          setSelectedSavedAddressId(null);
          setFlatNo('');
          setStreet('');
          setLandmark('');
          setSelectedTag('Home');
        }
        triggerToast('ADDRESS DELETED SUCCESSFULLY!', 'warning');
      } else {
        Alert.alert('Error', data.message || 'Failed to delete address.');
      }
    } catch (error) {
      console.error('Error deleting address:', error);
      Alert.alert('Error', 'Could not connect to backend.');
    }
  };

  const handlePrefillAddress = (addr) => {
    const addrId = addr.id || addr._id;
    if (selectedSavedAddressId === addrId) {
      setFlatNo('');
      setStreet('');
      setLandmark('');
      setSelectedTag('Home');
      setSelectedSavedAddressId(null);
    } else {
      setFlatNo(addr.flatNo || '');
      setStreet(addr.street || '');
      setLandmark(addr.landmark || '');
      setSelectedTag(addr.tag || addr.label || 'Home');
      setSelectedSavedAddressId(addrId);
    }
  };

  const handleConfirmOrder = async () => {
    if (!flatNo || !street) {
      showAlert('Delivery Address Required', 'Please select a saved address or enter a delivery address manually to proceed.');
      return;
    }

    const subTotal = calculateTotal();
    const gstAmount = subTotal * 0.05;
    const pFee = 2.00;
    const gTotal = subTotal + gstAmount + pFee;
    const coins = subTotal > 200 ? 10 + Math.floor((subTotal - 200) / 100) * 5 : 0;
    const restName = cartItems[0]?.restaurantName || 'Restaurant';
    const restId = cartItems[0]?.restId || '';

    const activeUserId = await AsyncStorage.getItem('userid');
    const activePhone = await AsyncStorage.getItem('phone');
    const activeName = await AsyncStorage.getItem('name');
    const activeEmail = await AsyncStorage.getItem('email');

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
                  deliveryAddressInfo: {
                    flatNo,
                    street,
                    landmark,
                    tag: selectedTag,
                  },
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
        const RazorpayCheckout = require('react-native-razorpay').default;

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
                  deliveryAddressInfo: {
                    flatNo,
                    street,
                    landmark,
                    tag: selectedTag,
                  },
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
    return cartItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
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
  const gst = total * 0.05; // 5% GST
  const platformFee = 2.00; // Constant platform fee
  const grandTotal = total + gst + platformFee;
  const coinsEarned = total > 200 ? 10 + Math.floor((total - 200) / 100) * 5 : 0;

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
                  <Text style={styles.itemPrice}>₹{(item.price * item.quantity).toFixed(2)}</Text>

                  {/* Red Trash Icon */}
                  <TouchableOpacity onPress={() => updateQuantity(item._id || item.itemId, -item.quantity)} activeOpacity={0.7}>
                    <MaterialIcons name="delete" size={24} color="#FF5E5E" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
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

          <View style={styles.divider} />

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Grand total</Text>
            <Text style={styles.grandTotalValue}>₹{grandTotal.toFixed(2)}</Text>
          </View>

          {coinsEarned > 0 && (
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

        {/* Action Buttons Row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.clearButton} onPress={clearCart} activeOpacity={0.85}>
            <Text style={styles.clearButtonText}>Clear all</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.checkoutButton, showDeliveryForm && styles.checkoutButtonDisabled]}
            onPress={handlePlaceOrder}
            disabled={showDeliveryForm}
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
              style={styles.saveAddressButton}
              onPress={handleSaveAddress}
              activeOpacity={0.85}
            >
              <Text style={styles.saveAddressButtonText}>Save Address</Text>
            </TouchableOpacity>

            {/* Saved Address Selection */}
            {savedAddresses.length > 0 && (
              <View style={styles.savedSection}>
                <Text style={styles.savedAddressesLabel}>Use a saved address:</Text>

                {(showAllAddresses ? savedAddresses : savedAddresses.slice(0, 1)).map((addr) => {
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

                {savedAddresses.length > 1 && (
                  <TouchableOpacity
                    style={styles.viewMoreButton}
                    onPress={() => setShowAllAddresses(!showAllAddresses)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.viewMoreButtonText}>
                      {showAllAddresses
                        ? 'Hide addresses ∧'
                        : `View ${savedAddresses.length - 1} more addresses ∨`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Confirm Order Button */}
            <TouchableOpacity
              style={styles.confirmOrderButton}
              onPress={handleConfirmOrder}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmOrderButtonText}>
                Confirm order and pay ₹{grandTotal.toFixed(2)}
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(249, 249, 246, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#1C5C36',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#F9F9F6',
    borderRadius: 28,
    padding: 30,
    width: '85%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  checkmarkOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#27AE60',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkmarkInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#1C5C36',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C5C36',
    textAlign: 'center',
    marginVertical: 12,
    lineHeight: 32,
    fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'serif',
  },
  modalDivider: {
    width: 40,
    height: 3,
    backgroundColor: '#27AE60',
    borderRadius: 1.5,
    marginBottom: 16,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  modalButton: {
    width: '100%',
    backgroundColor: '#1C5C36',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
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
    backgroundColor: '#008000',
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
  alertBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertCard: {
    backgroundColor: 'rgb(224, 214, 188)',
    borderRadius: 40,
    width: '85%',
    maxWidth: 320,
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
    }),
  },
  alertIconContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FF5E5E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#FF5E5E',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      default: {
        shadowColor: '#FF5E5E',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
    }),
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 12,
  },
  alertMessage: {
    fontSize: 14,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  alertButton: {
    backgroundColor: '#1E3545',
    borderRadius: 9999,
    paddingVertical: 14,
    width: '90%',
    maxWidth: 240,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
    }),
  },
  alertButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

