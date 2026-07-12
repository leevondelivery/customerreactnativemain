import React, { useEffect, useState, useRef } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Linking,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Feather, FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';

import { useTabBar } from '../_layout';
import { styles } from '../../styles/profile.styles';
import LoadingView from '../../components/LoadingView';
import { fetchProfileData, resetProfile } from '../../store/restaurantsSlice';
import { resetLocationState } from '../../store/locationSlice';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { showTabBar, hideTabBar } = useTabBar();
  const lastOffsetY = useRef(0);

  const profileLoading = useSelector((state) => state.restaurants.profileLoading);
  const profileLoaded = useSelector((state) => state.restaurants.profileLoaded);

  const [user, setUser] = useState({
    name: 'Gsvinith',
    phone: '6300733511',
    coins: '1890',
    dateOfBirth: '',
  });
  const [loading, setLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [shineValue] = useState(() => new Animated.Value(-180));

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
    Animated.loop(
      Animated.sequence([
        Animated.timing(shineValue, {
          toValue: 480,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.delay(1200),
      ])
    ).start();
  }, [shineValue]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const name = await AsyncStorage.getItem('name');
        const phone = await AsyncStorage.getItem('phone');
        const coins = await AsyncStorage.getItem('coins');
        const dateOfBirth = await AsyncStorage.getItem('dateOfBirth');
        const userid = await AsyncStorage.getItem('userid');
        
        setUser({
          name: name && name.toLowerCase() !== 'n/a' ? name : 'Customer',
          phone: phone && phone.toLowerCase() !== 'n/a' ? phone : '',
          coins: coins !== null && coins.toLowerCase() !== 'n/a' ? coins : '0',
          dateOfBirth: dateOfBirth && dateOfBirth.toLowerCase() !== 'n/a' ? dateOfBirth : '',
        });

        if (userid && !profileLoaded) {
          dispatch(fetchProfileData(userid));
        }
      } catch (e) {
        console.error('Error fetching user data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [dispatch, profileLoaded]);

  const handleLogout = async () => {
    try {
      // Sign out from Firebase
      if (auth().currentUser) {
        await auth().signOut();
      }
    } catch (e) {
      console.log('Firebase signout error:', e.message);
    }

    try {
      // Sign out from Google (clears cached Google account selection)
      await GoogleSignin.signOut();
    } catch (e) {
      console.log('Google signout error:', e.message);
    }

    try {
      await AsyncStorage.clear();
      dispatch(resetLocationState());
      dispatch(resetProfile());
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isAppLoading = loading || profileLoading;

  if (isAppLoading) {
    return <LoadingView />;
  }

  // Get first letter of user name for the avatar
  const avatarLetter = user.name ? user.name.charAt(0).toUpperCase() : 'G';

  // Action buttons configuration (no actions for now)
  const menuButtons = [
    {
      label: 'My Profile',
      icon: <Feather name="edit" size={20} color="#000000" />,
      isLogout: false,
    },
    {
      label: 'My Orders',
      icon: <Feather name="package" size={20} color="#000000" />,
      isLogout: false,
    },
    {
      label: 'My Reviews',
      icon: <Feather name="star" size={20} color="#000000" />,
      isLogout: false,
    },
    {
      label: 'Contact Us',
      icon: <Feather name="mail" size={20} color="#000000" />,
      isLogout: false,
    },
    {
      label: 'Privacy Policy',
      icon: <Feather name="shield" size={20} color="#000000" />,
      isLogout: false,
    },
    {
      label: 'Terms & Conditions',
      icon: <Feather name="file-text" size={20} color="#000000" />,
      isLogout: false,
    },
    {
      label: 'Logout',
      icon: <Feather name="log-out" size={20} color="#D32F2F" />,
      isLogout: true,
    },
  ];

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
          <TouchableOpacity style={[styles.backButton, styles.shadow]} onPress={() => router.back()} activeOpacity={0.8}>
            <Feather name="chevron-left" size={24} color="#000000" />
          </TouchableOpacity>

          <View style={[styles.headerTitleCard, styles.shadow]}>
            <Feather name="settings" size={18} color="#000000" />
            <Text style={styles.headerTitleText}>Profile</Text>
          </View>

          <View style={styles.placeholderRight} />
        </View>

        {/* User Card */}
        <View style={[styles.userInfoCard, styles.shadow]}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <View style={styles.userTextContainer}>
            <Text style={styles.userName}>{user.name}</Text>
            <View style={styles.phoneRow}>
              <FontAwesome name="phone" size={14} color="#C2932E" />
              <Text style={styles.phoneText}>{user.phone}</Text>
            </View>
          </View>
        </View>

        {/* Available Coins Banner */}
        <View style={[styles.coinsCard, styles.shadow]}>
          <View style={styles.coinsCircle}>
            <FontAwesome5 name="coins" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.coinsContent}>
            <Text style={styles.coinsLabel}>AVAILABLE COINS</Text>
            <Text style={styles.coinsValue}>{user.coins}</Text>
          </View>
          <Animated.View
            style={[
              styles.shineOverlay,
              {
                transform: [
                  { translateX: shineValue },
                  { rotate: '30deg' }
                ]
              }
            ]}
          />
        </View>

        {/* Menu Buttons Container */}
        <View style={[styles.buttonsContainer, styles.shadow]}>
          {menuButtons.map((btn, index) => (
            <TouchableOpacity
              key={index}
              style={[btn.isLogout ? styles.buttonPillLogout : styles.buttonPill, styles.shadow]}
              activeOpacity={0.85}
              onPress={() => {
                if (btn.isLogout) {
                  setShowLogoutModal(true);
                } else if (btn.label === 'My Profile') {
                  router.push('/profile/mydetails');
                } else if (btn.label === 'My Orders') {
                  router.push('/profile/myorders');
                } else if (btn.label === 'My Reviews') {
                  router.push('/profile/myreviews');
                } else if (btn.label === 'Privacy Policy') {
                  Linking.openURL('https://leevon-delivery.vercel.app/privacy').catch(err => console.error('Failed to open Privacy Policy URL:', err));
                } else if (btn.label === 'Terms & Conditions') {
                  Linking.openURL('https://tandccustomer.vercel.app/').catch(err => console.error('Failed to open Terms URL:', err));
                } else {
                  // No action for now as requested
                }
              }}
            >
              <View style={styles.buttonLeft}>
                {btn.isLogout ? (
                  <Feather name="log-out" size={20} color="#FFFFFF" />
                ) : (
                  btn.icon
                )}
                <Text style={btn.isLogout ? styles.buttonTextLogout : styles.buttonText}>
                  {btn.label}
                </Text>
              </View>
              <FontAwesome name="caret-right" size={16} color={btn.isLogout ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Delete Account Section */}
        <View style={styles.deleteSection}>
          <Text style={styles.deleteLabelText}>Need to close your account?</Text>
          <TouchableOpacity
            style={[styles.deleteButton, styles.shadow]}
            activeOpacity={0.85}
            onPress={() => {
              // No action for now as requested
            }}
          >
            <Text style={styles.deleteButtonText}>Permanently Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Custom Logout Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showLogoutModal}
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconContainer}>
              <Feather name="log-out" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.modalText}>Are you sure you want to logout?</Text>
            <View style={styles.modalButtonsContainer}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirmButton,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => {
                  setShowLogoutModal(false);
                  handleLogout();
                }}
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </Pressable>
              
              <Pressable
                style={({ pressed }) => [
                  styles.modalCancelButton,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
