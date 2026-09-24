import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, Animated, AppState, Dimensions, Easing, Modal, PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View, StatusBar as RNStatusBar } from 'react-native';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../config';
import { store } from '../store/store';
import { fetchControlsStatus } from '../store/controlsSlice';
// Native-only modules: lazily required to avoid crashes when native binary
// does not include these modules (e.g. Expo Go, or missing native linking).
let GoogleSignin = null;
let messaging = null;
let Notifications = null;

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
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (e) {
    console.warn('[Layout] expo-notifications native module not available:', e.message);
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

  // AppState tracking for pausing background tasks & instant wakeup resume
  const appStateRef = useRef(AppState.currentState);

  // Hide the floating tab bar on login and root index redirection screens
  const isLoginPage = pathname === '/login' || pathname === '/' || pathname === '';

  const tabs = [
    {
      route: '/restaurentlist',
      icon: (isActive) => <FontAwesome name="home" size={20} color="#000000" />,
    },
    {
      route: '/orderstatus',
      icon: (isActive) => <MaterialIcons name="directions-bike" size={22} color="#000000" />,
    },
    {
      route: '/cart',
      icon: (isActive) => <FontAwesome name="shopping-bag" size={20} color="#000000" />,
    },
    {
      route: '/profile',
      icon: (isActive) => <FontAwesome name="gear" size={20} color="#000000" />,
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
  const prevHasActiveOrder = useRef(false);
  const lastActiveOrderRef = useRef(null);

  const checkActiveOrder = useCallback(async () => {
    try {
      const userid = await AsyncStorage.getItem('userid');
      if (!userid) {
        setHasActiveOrder(false);
        return;
      }
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;

      const response = await fetch(`${API_URL}/orderstatus/user/${userid}`, {
        signal: controller ? controller.signal : undefined,
      });
      if (timeoutId) clearTimeout(timeoutId);

      const data = await response.json();
      if (response.ok && data.success && data.orderStatus) {
        const sStr = (data.orderStatus.status || data.orderStatus.orderStatus || '').toLowerCase().trim();
        const isRej = sStr.includes('reject') || sStr.includes('cancel') || sStr.includes('declin') || sStr.includes('failed');

        if (isRej) {
          setHasActiveOrder(false);
          prevHasActiveOrder.current = false;
          lastActiveOrderRef.current = null;
          AsyncStorage.setItem(`has_active_order_${userid}`, 'false').catch(() => {});
          AsyncStorage.removeItem(`active_order_data_${userid}`).catch(() => {});
          const rejData = {
            orderId: data.orderStatus.orderId || data.orderStatus.orderID || data.orderStatus.order_id || data.orderStatus._id || '',
            restaurantName: data.orderStatus.restaurantName || data.orderStatus.restaurant_name || data.orderStatus.restName || 'Restaurant',
            timestamp: Date.now(),
          };
          AsyncStorage.setItem(`recent_rejected_order_${userid}`, JSON.stringify(rejData)).catch(() => {});
        } else {
          setHasActiveOrder(true);
          prevHasActiveOrder.current = true;
          lastActiveOrderRef.current = data.orderStatus;
          AsyncStorage.setItem(`has_active_order_${userid}`, 'true').catch(() => {});
          AsyncStorage.setItem(`active_order_data_${userid}`, JSON.stringify(data.orderStatus)).catch(() => {});
          AsyncStorage.removeItem(`recent_rejected_order_${userid}`).catch(() => {});
        }
      } else {
        AsyncStorage.setItem(`has_active_order_${userid}`, 'false').catch(() => {});
        AsyncStorage.removeItem(`active_order_data_${userid}`).catch(() => {});
        setHasActiveOrder(false);
        prevHasActiveOrder.current = false;
        lastActiveOrderRef.current = null;
      }
    } catch (e) {
      console.warn('Error checking active order in layout:', e.message);
      // Keep previous hasActiveOrder state on network error to prevent red dot badge flickering
    }
  }, []);

  useEffect(() => {
    const initActiveOrderState = async () => {
      try {
        const userid = await AsyncStorage.getItem('userid');
        if (userid) {
          const cachedActiveOrder = await AsyncStorage.getItem(`has_active_order_${userid}`);
          if (cachedActiveOrder === 'true') {
            setHasActiveOrder(true);
            prevHasActiveOrder.current = true;
          }
        }
      } catch (e) {}
    };
    initActiveOrderState();
  }, []);

  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedModalMessage, setBlockedModalMessage] = useState('');

  const updateCartCount = useCallback(async () => {
    try {
      const cartData = await AsyncStorage.getItem('cart');
      const items = cartData ? JSON.parse(cartData) : [];
      const totalQty = Array.isArray(items) ? items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0;
      setCartCount((prev) => (prev !== totalQty ? totalQty : prev));
    } catch (e) {
      console.error('Error fetching cart count:', e);
    }
  }, []);

  const syncSessionAndData = useCallback(async () => {
    const userid = await AsyncStorage.getItem('userid');
    if (!userid) return;

    // 1. Sync live user coins & profile details to local storage (with 3.5s timeout)
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;
      const userRes = await fetch(`${API_URL}/user/${userid}`, {
        signal: controller ? controller.signal : undefined,
      });
      if (timeoutId) clearTimeout(timeoutId);

      const userData = await userRes.json();
      const isBlockedUser =
        userRes.status === 403 ||
        userData.isBlocked ||
        (userData.user && (userData.user.isBlocked || userData.user.blickstatus === false || userData.user.status === 'blocked'));

      if (isBlockedUser) {
        console.warn('[Layout] User is blocked by admin. Logging out user...');
        await AsyncStorage.clear();
        setBlockedModalMessage(
          userData.message || 'Your account has been blocked by admin. Please contact support.'
        );
        setShowBlockedModal(true);
        router.replace('/login');
        return;
      }

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

    // 2. Pre-cache global feesConfig into AsyncStorage (with 3.5s timeout)
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;
      const feesRes = await fetch(`${API_URL}/fees-config`, {
        signal: controller ? controller.signal : undefined,
      });
      if (timeoutId) clearTimeout(timeoutId);

      const feesData = await feesRes.json();
      if (feesRes.ok && feesData.success && feesData.config) {
        await AsyncStorage.setItem('fees_config', JSON.stringify(feesData.config));
      }
    } catch (feesErr) {
      console.warn('[Layout] Fees config sync error:', feesErr.message);
    }
  }, [router]);

  // Mark first launch without wiping user authentication
  useEffect(() => {
    const checkFreshInstall = async () => {
      try {
        const hasLaunched = await AsyncStorage.getItem('app_has_launched_once');
        if (!hasLaunched) {
          await AsyncStorage.setItem('app_has_launched_once', 'true');
        }
      } catch (e) {
        console.warn('[App] Fresh install check error:', e);
      }
    };
    checkFreshInstall();
  }, []);

  // Global Authentication, Session Verification & Data Pre-Caching (Real-time polling every 4s & AppState focus)
  useEffect(() => {
    syncSessionAndData();

    const intervalId = setInterval(() => {
      syncSessionAndData();
    }, 4000);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        syncSessionAndData();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [syncSessionAndData]);

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

          // Create high priority notification channel for Android status bar heads-up banners
          if (Notifications && Notifications.setNotificationChannelAsync) {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'Default Notifications',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#FF231F7C',
              sound: 'default',
            });
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

    // Listen for foreground notifications and display device-level status bar notifications
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      console.log('[FCM] Foreground notification received:', remoteMessage);

      const title =
        remoteMessage.notification?.title ||
        remoteMessage.data?.title ||
        remoteMessage.data?.heading ||
        'Leevon Delivery';

      const body =
        remoteMessage.notification?.body ||
        remoteMessage.data?.body ||
        remoteMessage.data?.message ||
        '';

      if (Notifications && Notifications.scheduleNotificationAsync) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              data: remoteMessage.data || {},
              sound: 'default',
              ...(Platform.OS === 'android'
                ? {
                    channelId: 'default',
                    priority: Notifications.AndroidNotificationPriority?.MAX || 'max',
                    color: '#2B783E',
                  }
                : {}),
            },
            trigger: null, // Display immediately in status bar
          });
        } catch (notifErr) {
          console.warn('[FCM] Error scheduling status bar notification:', notifErr);
        }
      }
    });

    return unsubscribe;
  }, []);

  // Sync active order and cart badge on initial load & run light intervals while app is ACTIVE
  useEffect(() => {
    checkActiveOrder();
    updateCartCount();

    const orderInterval = setInterval(() => {
      if (appStateRef.current === 'active') {
        checkActiveOrder();
      }
    }, 10000);

    const cartInterval = setInterval(() => {
      if (appStateRef.current === 'active') {
        updateCartCount();
      }
    }, 3000);

    return () => {
      clearInterval(orderInterval);
      clearInterval(cartInterval);
    };
  }, [checkActiveOrder, updateCartCount]);

  // Handle AppState changes (waking up after 3 hours / idle state)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[Layout] App resumed from background. Syncing active order & cart badge instantly...');
        checkActiveOrder();
        updateCartCount();
        syncSessionAndData();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [checkActiveOrder, updateCartCount, syncSessionAndData]);

  const showTabBar = useCallback((force = false) => {
    if (isTabBarVisible.current && !force) return;
    isTabBarVisible.current = true;
    Animated.timing(translateY, {
      toValue: 0,
      duration: 130,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const hideTabBar = useCallback(() => {
    if (!isTabBarVisible.current) return;
    isTabBarVisible.current = false;
    Animated.timing(translateY, {
      toValue: 120, // offset down off-screen
      duration: 130,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  // Bring navbar back into view automatically on page routing changes
  useEffect(() => {
    showTabBar(true);
  }, [pathname, showTabBar]);

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <TabBarContext.Provider value={{ showTabBar, hideTabBar }}>
          <MainLayoutContent
            isLoginPage={isLoginPage}
            tabs={tabs}
            pathname={pathname}
            router={router}
            tabBarWidth={tabBarWidth}
            setTabBarWidth={setTabBarWidth}
            translateX={translateX}
            translateY={translateY}
            cartCount={cartCount}
            hasActiveOrder={hasActiveOrder}
            showBlockedModal={showBlockedModal}
            setShowBlockedModal={setShowBlockedModal}
            blockedModalMessage={blockedModalMessage}
          />
        </TabBarContext.Provider>
      </SafeAreaProvider>
    </Provider>
  );
}

function MainLayoutContent({
  isLoginPage,
  tabs,
  pathname,
  router,
  tabBarWidth,
  setTabBarWidth,
  translateX,
  translateY,
  cartCount,
  hasActiveOrder,
  showBlockedModal,
  setShowBlockedModal,
  blockedModalMessage,
}) {
  // Hide bottom tab bar only on login page
  const shouldShowTabBar = !isLoginPage;

  // Poll confirmPayButton + maintenanceMode from MongoDB every 5 seconds (inside Provider)
  const dispatch = useDispatch();
  const maintenanceMode = useSelector((state) => state.controls?.maintenanceMode);
  // Show maintenance screen when maintenanceMode is true (enabled in Office) on all pages except login
  const showMaintenance = !isLoginPage && maintenanceMode === true;

  useEffect(() => {
    dispatch(fetchControlsStatus());
    const controlsInterval = setInterval(() => {
      dispatch(fetchControlsStatus());
    }, 60 * 1000); // poll every 60 seconds
    return () => clearInterval(controlsInterval);
  }, [dispatch]);

  useEffect(() => {
    RNStatusBar.setBarStyle('dark-content', true);
    if (Platform.OS === 'android') {
      RNStatusBar.setBackgroundColor('transparent', true);
      RNStatusBar.setTranslucent(true);
    }
  }, [pathname]);

  return (
    <View style={styles.rootContainer}>
      <StatusBar style="dark" backgroundColor="transparent" translucent={true} animated={true} />
      <RNStatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} animated={true} />
      <View style={styles.contentArea}>
        <Slot />
      </View>
      {shouldShowTabBar && (
        <FloatingTabBar
          tabs={tabs}
          pathname={pathname}
          router={router}
          tabBarWidth={tabBarWidth}
          setTabBarWidth={setTabBarWidth}
          translateX={translateX}
          translateY={translateY}
          cartCount={cartCount}
          hasActiveOrder={hasActiveOrder}
        />
      )}

      {/* Maintenance Mode — full-screen blocking overlay, no dismiss buttons */}
      <Modal
        visible={showMaintenance}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => { /* intentionally left empty — cannot be dismissed */ }}
      >
        <View style={styles.maintenanceContainer}>
          <View style={styles.maintenanceIconWrap}>
            <Text style={styles.maintenanceExclaim}>!</Text>
          </View>
          <Text style={styles.maintenanceTitle}>Application is under{`\n`}maintanace</Text>
          <Text style={styles.maintenanceSubtitle}>
            {"We'll be back shortly.\nThank you for your patience!"}
          </Text>
          <View style={styles.maintenanceDots}>
            <View style={[styles.maintenanceDot, { opacity: 1 }]} />
            <View style={[styles.maintenanceDot, { opacity: 0.5 }]} />
            <View style={[styles.maintenanceDot, { opacity: 0.2 }]} />
          </View>
        </View>
      </Modal>

      {/* Account Blocked Custom Modal Popup */}
      <Modal
        visible={showBlockedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowBlockedModal(false);
          router.replace('/login');
        }}
      >
        <View style={blockedStyles.modalBackdrop}>
          <View style={blockedStyles.modalCard}>
            <View style={blockedStyles.modalIconContainer}>
              <FontAwesome name="ban" size={38} color="#FFFFFF" />
            </View>
            <Text style={blockedStyles.modalTitle}>Account Blocked</Text>
            <Text style={blockedStyles.modalText}>
              {blockedModalMessage || 'Your account has been blocked by admin. Please contact support.'}
            </Text>
            <TouchableOpacity
              style={blockedStyles.modalButton}
              activeOpacity={0.8}
              onPress={() => {
                setShowBlockedModal(false);
                router.replace('/login');
              }}
            >
              <Text style={blockedStyles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function AnimatedBackgroundCircle({ left, isActive }) {
  const [opacityAnim] = useState(() => new Animated.Value(isActive ? 0 : 1));

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: isActive ? 0 : 1,
      duration: 220,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start();
  }, [isActive, opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.inactiveCircleBackground,
        {
          left,
          opacity: opacityAnim,
        },
      ]}
    />
  );
}

function AnimatedTabItem({
  tab,
  isActive,
  onPress,
  cartCount,
  hasActiveOrder,
}) {
  const isCartTab = tab.route === '/cart';
  const isOrderStatusTab = tab.route === '/orderstatus';

  const [activeAnim] = useState(() => new Animated.Value(isActive ? 1 : 0));
  const [pressScale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.spring(activeAnim, {
      toValue: isActive ? 1 : 0,
      tension: 130,
      friction: 13,
      useNativeDriver: true,
    }).start();
  }, [isActive, activeAnim]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.88,
      tension: 280,
      friction: 14,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      tension: 180,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const translateY = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -15],
  });

  const scale = Animated.multiply(
    pressScale,
    activeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.15],
    })
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={styles.tabTouchArea}
    >
      <Animated.View
        style={{
          transform: [{ translateY }, { scale }],
          position: 'relative',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {tab.icon(isActive)}
        {isCartTab && cartCount > 0 && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{cartCount}</Text>
          </View>
        )}
        {isOrderStatusTab && hasActiveOrder && (
          <View style={styles.dotBadge} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

function FloatingTabBar({
  tabs,
  pathname,
  router,
  tabBarWidth,
  setTabBarWidth,
  translateX,
  translateY,
  cartCount,
  hasActiveOrder,
}) {
  const insets = useSafeAreaInsets();
  const dynamicBottom = Math.max(insets.bottom + 12, Platform.OS === 'ios' ? 34 : 24);

  // Optimistic active route state for instant visual feedback on tab touch
  const [activeRoute, setActiveRoute] = useState(pathname);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [bubbleMorph] = useState(() => new Animated.Value(0));
  const prevIndexRef = useRef(0);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setActiveRoute(pathname);
  }

  // Animate tab indicator circle smoothly with organic stretch physics
  useEffect(() => {
    let activeIndex = 0;
    if (activeRoute.startsWith('/restaurentlist')) activeIndex = 0;
    else if (activeRoute.startsWith('/orderstatus')) activeIndex = 1;
    else if (activeRoute.startsWith('/cart')) activeIndex = 2;
    else if (activeRoute.startsWith('/profile')) activeIndex = 3;

    if (tabBarWidth > 0) {
      const tabWidth = tabBarWidth / 4;
      const circleWidth = 60;
      const targetValue = activeIndex * tabWidth + (tabWidth - circleWidth) / 2;
      const distance = Math.abs(activeIndex - prevIndexRef.current);
      prevIndexRef.current = activeIndex;

      // Organic fluid stretch morph when transitioning between tabs
      if (distance > 0) {
        bubbleMorph.setValue(1);
        Animated.spring(bubbleMorph, {
          toValue: 0,
          tension: 140,
          friction: 12,
          useNativeDriver: true,
        }).start();
      }

      Animated.spring(translateX, {
        toValue: targetValue,
        tension: 130,
        friction: 13,
        useNativeDriver: true,
      }).start();
    }
  }, [activeRoute, tabBarWidth, translateX, bubbleMorph]);

  const handleTabPress = useCallback(
    (tabRoute) => {
      const cleanCurrent = (activeRoute || '').replace(/\/index$/, '').replace(/\/$/, '');
      const cleanTarget = (tabRoute || '').replace(/\/index$/, '').replace(/\/$/, '');
      const isAlreadyOnTab = cleanCurrent === cleanTarget;

      if (isAlreadyOnTab) return;

      // 1. Instant UI update: move white circle & highlight tab icon immediately
      setActiveRoute(tabRoute);

      // 2. Immediate route navigation
      router.replace(tabRoute);
    },
    [activeRoute, router]
  );

  const bubbleScaleX = bubbleMorph.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const bubbleScaleY = bubbleMorph.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.92],
  });

  return (
    <Animated.View
      style={[
        styles.tabBarContainer,
        styles.shadow,
        {
          bottom: dynamicBottom,
          transform: [{ translateY }],
        },
      ]}
      onLayout={(e) => {
        const newWidth = e.nativeEvent.layout.width;
        if (newWidth > 0 && Math.abs(newWidth - tabBarWidth) > 2) {
          setTabBarWidth(newWidth);
        }
      }}
    >
      {/* Soft Background circles with smooth fade transitions */}
      {tabs.map((tab, idx) => {
        const isActive = activeRoute.startsWith(tab.route);
        const leftPos = idx * (tabBarWidth / 4) + (tabBarWidth / 4 - 44) / 2;
        return (
          <AnimatedBackgroundCircle
            key={`bg-circle-${tab.route}`}
            left={leftPos}
            isActive={isActive}
          />
        );
      })}

      {/* Animated Sliding White Background Circle with organic squash & stretch */}
      {tabBarWidth > 0 && (
        <Animated.View
          style={[
            styles.activeTabCircle,
            styles.activeShadow,
            {
              position: 'absolute',
              left: 0,
              transform: [
                { translateX },
                { translateY: -15 },
                { scaleX: bubbleScaleX },
                { scaleY: bubbleScaleY },
              ],
            },
          ]}
        />
      )}

      {/* Animated Interactive Tab Items */}
      {tabs.map((tab) => {
        const isActive = activeRoute.startsWith(tab.route);

        return (
          <AnimatedTabItem
            key={tab.route}
            tab={tab}
            isActive={isActive}
            onPress={() => handleTabPress(tab.route)}
            cartCount={cartCount}
            hasActiveOrder={hasActiveOrder}
          />
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  maintenanceContainer: {
    flex: 1,
    backgroundColor: '#F9F9F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  maintenanceIconWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#E05A47',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    ...Platform.select({
      ios: { shadowColor: '#E05A47', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20 },
      android: { elevation: 12 },
    }),
  },
  maintenanceExclaim: {
    fontSize: 62,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 70,
    includeFontPadding: false,
  },
  maintenanceTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 16,
    lineHeight: 34,
  },
  maintenanceSubtitle: {
    fontSize: 15,
    color: '#7E7C77',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
    marginBottom: 40,
  },
  maintenanceDots: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  maintenanceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E05A47',
  },
  rootContainer: {
    flex: 1,
    backgroundColor: '#F9F9F6',
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#F9F9F6',
  },
  tabBarContainer: {
    position: 'absolute',
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

const blockedStyles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#F9F8F3', // creamy soft off-white/beige background
    borderRadius: 36,
    width: '85%',
    maxWidth: 320,
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
    }),
  },
  modalIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F34D4D', // bright red badge
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#F34D4D',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      default: {
        shadowColor: '#F34D4D',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
    }),
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#555555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  modalButton: {
    backgroundColor: '#000000',
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
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
    }),
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
