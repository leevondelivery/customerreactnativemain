import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot, usePathname, useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View, Alert, PermissionsAndroid } from 'react-native';
import { Provider } from 'react-redux';
import { API_URL } from '../config';
import { store } from '../store/store';
// Native-only modules: lazily required to avoid crashes when native binary
// does not include these modules (e.g. Expo Go, or missing native linking).
let GoogleSignin = null;
let messaging = null;

if (Platform.OS !== 'web') {
  try {
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
    GoogleSignin.configure({
      webClientId: '549037342596-kkd837btqfu8dfprgtupmpprmiarc5e7.apps.googleusercontent.com',
    });
  } catch (e) {
    console.warn('[Layout] GoogleSignin native module not available:', e.message);
  }

  try {
    messaging = require('@react-native-firebase/messaging').default;
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('[FCM] Background message handled:', remoteMessage);
    });
  } catch (e) {
    console.warn('[Layout] Firebase Messaging native module not available:', e.message);
  }
}

// Create context for communicating scroll-hide commands from children pages
const TabBarContext = createContext({
  showTabBar: () => { },
  hideTabBar: () => { },
});

export const useTabBar = () => useContext(TabBarContext);

export default function Layout() {
  const pathname = usePathname();
  const router = useRouter();

  // Hide the floating tab bar on login and root index redirection screens
  const isLoginPage = pathname === '/login' || pathname === '/' || pathname === '';

  const tabs = [
    {
      route: '/restaurentlist',
      icon: (isActive) => <FontAwesome name="home" size={isActive ? 22 : 18} color="#000000" />,
    },
    {
      route: '/orderstatus',
      icon: (isActive) => <MaterialIcons name="directions-bike" size={isActive ? 22 : 18} color="#000000" />,
    },
    {
      route: '/cart',
      icon: (isActive) => <FontAwesome name="shopping-bag" size={isActive ? 22 : 18} color="#000000" />,
    },
    {
      route: '/profile',
      icon: (isActive) => <FontAwesome name="user" size={isActive ? 22 : 18} color="#000000" />,
    },
  ];

  const { width: windowWidth } = Dimensions.get('window');
  const defaultTabBarWidth = windowWidth - 48; // padding left/right 24
  const [tabBarWidth, setTabBarWidth] = useState(defaultTabBarWidth);

  // Position translateX based on active tab index
  const [translateX] = useState(() => new Animated.Value(0));

  // Position translateY for hide-on-scroll logic
  const [translateY] = useState(() => new Animated.Value(0));
  const isTabBarVisible = useRef(true);
  const [cartCount, setCartCount] = useState(0);
  const [hasActiveOrder, setHasActiveOrder] = useState(false);

  // Check active order status from backend (on mount, path change, and every 10 seconds)
  useEffect(() => {
    const checkActiveOrder = async () => {
      try {
        const userid = await AsyncStorage.getItem('userid');
        if (!userid) {
          setHasActiveOrder(false);
          return;
        }
        const response = await fetch(`${API_URL}/orderstatus/user/${userid}`);
        const data = await response.json();
        if (response.ok && data.success && data.orderStatus) {
          setHasActiveOrder(true);
        } else {
          setHasActiveOrder(false);
        }
      } catch (e) {
        console.warn('Error checking active order in layout:', e.message);
        setHasActiveOrder(false);
      }
    };

    checkActiveOrder();
    const interval = setInterval(checkActiveOrder, 10000);
    return () => clearInterval(interval);
  }, [pathname]);

  // Global Authentication, Session Verification & Data Pre-Caching
  useEffect(() => {
    const syncSessionAndData = async () => {
      if (pathname === '/login' || pathname === '/' || pathname === '') {
        return;
      }

      const userid = await AsyncStorage.getItem('userid');
      const phone = await AsyncStorage.getItem('phone');
      const name = await AsyncStorage.getItem('name');
      const email = await AsyncStorage.getItem('email');
      const logintime = await AsyncStorage.getItem('logintime');
      const isPhoneVerified = await AsyncStorage.getItem('isPhoneVerified');

      if (!userid || !phone || !name || !email || !logintime || !isPhoneVerified) {
        console.log('[Layout] Session verification failed: Missing required fields. Redirecting to login.');
        await AsyncStorage.clear();
        router.replace('/login');
        return;
      }

      // 1. Sync live user coins & profile details to local storage
      try {
        const userRes = await fetch(`${API_URL}/user/${userid}`);
        const userData = await userRes.json();
        if (userRes.ok && userData.success && userData.user) {
          const liveUser = userData.user;
          if (liveUser.coins !== undefined && liveUser.coins !== null) {
            await AsyncStorage.setItem('coins', String(liveUser.coins));
          }
          if (liveUser.phone && liveUser.phone !== 'N/A') {
            await AsyncStorage.setItem('phone', liveUser.phone);
          }
          if (liveUser.name && liveUser.name !== 'N/A') {
            await AsyncStorage.setItem('name', liveUser.name);
          }
          if (liveUser.email && liveUser.email !== 'N/A') {
            await AsyncStorage.setItem('email', liveUser.email);
          }
        }
      } catch (userErr) {
        console.warn('[Layout] User sync error:', userErr.message);
      }

      // 2. Pre-cache global feesConfig into AsyncStorage
      try {
        const feesRes = await fetch(`${API_URL}/fees-config`);
        const feesData = await feesRes.json();
        if (feesRes.ok && feesData.success && feesData.config) {
          await AsyncStorage.setItem('fees_config', JSON.stringify(feesData.config));
        }
      } catch (feesErr) {
        console.warn('[Layout] Fees config sync error:', feesErr.message);
      }
    };

    syncSessionAndData();
  }, [pathname, router]);

  // Inject CSS to hide browser-native password reveal/clear buttons on Web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.textContent = `
        input::-ms-reveal,
        input::-ms-clear,
        input::-webkit-contacts-auto-fill-button,
        input::-webkit-credentials-auto-fill-button {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Request FCM Push Notification Permission & Subscribe to Broadcast Topic
  useEffect(() => {
    if (Platform.OS === 'web' || !messaging) return;

    const initPushNotifications = async () => {
      try {
        let enabled = false;

        if (Platform.OS === 'android') {
          if (Platform.Version >= 33) {
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
            enabled = granted === PermissionsAndroid.RESULTS.GRANTED;
          } else {
            enabled = true; // Android 12 and below are granted on install
          }
        } else {
          const authStatus = await messaging().requestPermission();
          enabled =
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        }

        if (enabled) {
          console.log('[FCM] Permission granted. Subscribing to topic...');
          await messaging().subscribeToTopic('all_customers');
          console.log('[FCM] Subscribed to topic: all_customers');
        } else {
          console.log('[FCM] Permission denied.');
        }
      } catch (err) {
        console.warn('[FCM] Init error:', err);
      }
    };

    initPushNotifications();

    // Listen for foreground notifications
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      console.log('[FCM] Foreground notification received:', remoteMessage);
      Alert.alert(
        remoteMessage.notification?.title || 'Leevon Delivery',
        remoteMessage.notification?.body || ''
      );
    });

    return unsubscribe;
  }, []);

  // Poll AsyncStorage for cart updates to keep badge synced in real-time
  useEffect(() => {
    const updateCartCount = async () => {
      try {
        const cartData = await AsyncStorage.getItem('cart');
        if (cartData) {
          const items = JSON.parse(cartData);
          const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
          setCartCount(totalQty);
        } else {
          setCartCount(0);
        }
      } catch (e) {
        console.error('Error fetching cart count:', e);
      }
    };

    updateCartCount();
    const interval = setInterval(updateCartCount, 500);
    return () => clearInterval(interval);
  }, []);

  const showTabBar = useCallback(() => {
    if (isTabBarVisible.current) return;
    isTabBarVisible.current = true;
    Animated.timing(translateY, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const hideTabBar = useCallback(() => {
    if (!isTabBarVisible.current) return;
    isTabBarVisible.current = false;
    Animated.timing(translateY, {
      toValue: 120, // offset down off-screen
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  // Bring navbar back into view automatically on page routing changes
  useEffect(() => {
    showTabBar();
  }, [pathname, showTabBar]);

  useEffect(() => {
    let activeIndex = 0;
    if (pathname.startsWith('/restaurentlist')) activeIndex = 0;
    else if (pathname.startsWith('/orderstatus')) activeIndex = 1;
    else if (pathname.startsWith('/cart')) activeIndex = 2;
    else if (pathname.startsWith('/profile')) activeIndex = 3;

    const tabWidth = tabBarWidth / 4;
    const circleWidth = 60; // width of activeTabCircle
    const targetValue = activeIndex * tabWidth + (tabWidth - circleWidth) / 2;

    Animated.spring(translateX, {
      toValue: targetValue,
      tension: 60,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [pathname, tabBarWidth, translateX]);

  return (
    <Provider store={store}>
      <TabBarContext.Provider value={{ showTabBar, hideTabBar }}>
        <View style={styles.rootContainer}>
          <View style={styles.contentArea}>
            <Slot />
          </View>
          {!isLoginPage && (
            <Animated.View
              style={[
                styles.tabBarContainer,
                styles.shadow,
                {
                  transform: [{ translateY }],
                }
              ]}
              onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}
            >
              {/* Soft Background circles for all tabs to maintain consistent design look */}
              {tabs.map((tab, idx) => {
                const isActive = pathname.startsWith(tab.route);
                return (
                  <View
                    key={`bg-circle-${tab.route}`}
                    style={[
                      styles.inactiveCircleBackground,
                      { left: idx * (tabBarWidth / 4) + (tabBarWidth / 4 - 44) / 2 },
                      isActive && { opacity: 0 }
                    ]}
                  />
                );
              })}

              {/* Animated Sliding White Background Circle (floating on top of inactive circles) */}
              {tabBarWidth > 0 && (
                <Animated.View
                  style={[
                    styles.activeTabCircle,
                    styles.activeShadow,
                    {
                      position: 'absolute',
                      left: 0,
                      transform: [{ translateX }, { translateY: -15 }],
                    }
                  ]}
                />
              )}

              {/* Transparent Interactive Tab Items */}
              {tabs.map((tab) => {
                const isActive = pathname.startsWith(tab.route);
                const isCartTab = tab.route === '/cart';
                const isOrderStatusTab = tab.route === '/orderstatus';

                return (
                  <TouchableOpacity
                    key={tab.route}
                    onPress={() => router.push(tab.route)}
                    activeOpacity={0.9}
                    style={styles.tabTouchArea}
                  >
                    <View style={[isActive ? { transform: [{ translateY: -15 }] } : null, { position: 'relative' }]}>
                      {tab.icon(isActive)}
                      {isCartTab && cartCount > 0 && (
                        <View style={styles.badgeContainer}>
                          <Text style={styles.badgeText}>{cartCount}</Text>
                        </View>
                      )}
                      {isOrderStatusTab && hasActiveOrder && (
                        <View style={styles.dotBadge} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          )}
        </View>
      </TabBarContext.Provider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 24,
    left: 24,
    right: 24,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgb(224, 214, 188)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  tabTouchArea: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10, // Ensure icons render on top of sliding animated circle
  },
  inactiveCircleBackground: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.55)', // soft white background matching mockup styling
  },
  activeTabCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    zIndex: 5,
  },
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
    }),
  },
  activeShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
    }),
  },
  badgeContainer: {
    position: 'absolute',
    right: -8,
    top: -8,
    backgroundColor: '#FF5E5E', // Brand notification red color
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF', // White outline separation
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 10,
  },
  dotBadge: {
    position: 'absolute',
    right: -4,
    top: -4,
    backgroundColor: '#FF5E5E', // Brand notification red color
    borderRadius: 5,
    width: 10,
    height: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF', // White outline separation
  },
});
