import { Feather, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Platform,
  StyleSheet,
  BackHandler,
} from 'react-native';

import { useTabBar } from '../../_layout';
import { API_URL } from '../../../config';
import { styles } from '../../../styles/mydetails.styles';
import LoadingView from '../../../components/LoadingView';

let auth = null;
try {
  if (Platform.OS !== 'web') {
    auth = require('@react-native-firebase/auth').default;
  }
} catch (e) {
  console.warn('Firebase auth import failed in profile details', e);
}

export default function MyDetailsScreen() {
  const router = useRouter();
  const { showTabBar, hideTabBar } = useTabBar();
  const lastOffsetY = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/profile');
        }
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [router])
  );

  const [user, setUser] = useState({
    name: '',
    phone: '',
    email: '',
    dateOfBirth: '',
  });
  const [loginType, setLoginType] = useState('phone');
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editDob, setEditDob] = useState('');
  const [updating, setUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Custom Calendar datepicker states
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(6); // 0-11
  const [calYear, setCalYear] = useState(1972);
  const [showMonthSelect, setShowMonthSelect] = useState(false);
  const [showYearSelect, setShowYearSelect] = useState(false);

  const [showPhoneOTPModal, setShowPhoneOTPModal] = useState(false);
  const [verificationPhone, setVerificationPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [confirmResult, setConfirmResult] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [showPhoneLinkedModal, setShowPhoneLinkedModal] = useState(false);
  const [showOTPSentModal, setShowOTPSentModal] = useState(false);
  const [isOTPResend, setIsOTPResend] = useState(false);
  const [showOTPVerifiedModal, setShowOTPVerifiedModal] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resendTimer]);

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
    const fetchUserData = async () => {
      try {
        const userid = await AsyncStorage.getItem('userid');
        if (!userid) {
          if (router.canDismiss()) {
            router.dismissAll();
          }
          router.replace('/login');
          return;
        }

        let name = await AsyncStorage.getItem('name');
        let phone = await AsyncStorage.getItem('phone');
        let email = await AsyncStorage.getItem('email');
        let dateOfBirth = await AsyncStorage.getItem('dateOfBirth');
        const cachedLoginType = await AsyncStorage.getItem('loginType');

        const detectedLoginType = cachedLoginType === 'google' ? 'google' : 'phone';
        setLoginType(detectedLoginType);

        // Fetch live user profile from MongoDB backend to ensure email and details are up to date
        try {
          const userRes = await fetch(`${API_URL}/user/${userid}`);
          const userData = await userRes.json();
          if (userRes.ok && userData.success && userData.user) {
            const dbUser = userData.user;
            const dbNameStr = dbUser.name !== undefined && dbUser.name !== null ? String(dbUser.name) : '';
            const dbPhoneStr = dbUser.phone !== undefined && dbUser.phone !== null ? String(dbUser.phone) : '';
            const dbEmailStr = dbUser.email !== undefined && dbUser.email !== null ? String(dbUser.email) : '';
            const dbDobStr = dbUser.dateOfBirth !== undefined && dbUser.dateOfBirth !== null ? String(dbUser.dateOfBirth) : '';

            if (dbNameStr && dbNameStr.toLowerCase() !== 'n/a') {
              name = dbNameStr;
              await AsyncStorage.setItem('name', name);
            }
            if (dbPhoneStr && dbPhoneStr.toLowerCase() !== 'n/a') {
              const isDbTemp = dbPhoneStr.startsWith('google_temp_') || dbPhoneStr.startsWith('temp_google_');
              if (!isDbTemp) {
                phone = dbPhoneStr;
                await AsyncStorage.setItem('phone', phone);
              }
            }
            if (dbEmailStr && dbEmailStr.toLowerCase() !== 'n/a') {
              email = dbEmailStr;
              await AsyncStorage.setItem('email', email);
            }
            if (dbDobStr && dbDobStr.toLowerCase() !== 'n/a') {
              dateOfBirth = dbDobStr;
              await AsyncStorage.setItem('dateOfBirth', dateOfBirth);
            }
          }
        } catch (apiErr) {
          console.warn('[MyDetails] Error fetching live profile from backend:', apiErr);
        }

        // Extract date component (YYYY-MM-DD) from ISO format if present
        const dobStr = dateOfBirth !== null && dateOfBirth !== undefined ? String(dateOfBirth) : '';
        let formattedDob = '2003-01-04';
        if (dobStr && dobStr.toLowerCase() !== 'n/a') {
          formattedDob = dobStr.includes('T') ? dobStr.split('T')[0] : dobStr;
        }

        const safePhoneStr = phone !== null && phone !== undefined ? String(phone) : '';
        const isTemp = safePhoneStr && (safePhoneStr.startsWith('google_temp_') || safePhoneStr.startsWith('temp_google_'));

        const safeNameStr = name !== null && name !== undefined ? String(name) : '';
        const safeEmailStr = email !== null && email !== undefined ? String(email) : '';

        setUser({
          name: safeNameStr && safeNameStr.toLowerCase() !== 'n/a' ? safeNameStr : 'Customer',
          phone: safePhoneStr && safePhoneStr.toLowerCase() !== 'n/a' && !isTemp ? safePhoneStr : '',
          email: safeEmailStr && safeEmailStr.toLowerCase() !== 'n/a' ? safeEmailStr : '',
          dateOfBirth: formattedDob,
        });
      } catch (e) {
        console.error('Error fetching my details:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, []);

  const handleOpenEdit = () => {
    setEditEmail(user.email);
    setEditDob(user.dateOfBirth);
    setErrorMsg('');

    // Parse current DOB for calendar initialization
    const userDobStr = typeof user.dateOfBirth === 'string' ? user.dateOfBirth : String(user.dateOfBirth || '');
    const dobParts = userDobStr.split('-');
    if (dobParts.length === 3) {
      const year = parseInt(dobParts[0], 10);
      const month = parseInt(dobParts[1], 10) - 1; // 0-indexed month
      if (!isNaN(year)) setCalYear(year);
      if (!isNaN(month) && month >= 0 && month <= 11) setCalMonth(month);
    } else {
      setCalMonth(6); // default July
      setCalYear(1972);
    }

    setShowCalendar(false);
    setShowEditModal(true);
  };

  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'error',
  });

  const showAlert = (title, message, type = 'error') => {
    setCustomAlert({
      visible: true,
      title,
      message,
      type,
    });
  };

  const handleOpenPhoneModal = () => {
    setVerificationPhone(user.phone !== 'N/A' ? user.phone : '');
    setOtpCode('');
    setConfirmResult(null);
    setResendTimer(0);
    setShowPhoneOTPModal(true);
  };

  const handleSendOTP = async (isResend = false) => {
    if (!verificationPhone || verificationPhone.trim().length < 10) {
      showAlert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.', 'warning');
      return;
    }

    setOtpLoading(true);
    try {
      const cleanFirstPhone = verificationPhone.trim().slice(-10);
      const activeUserId = await AsyncStorage.getItem('userid');

      // Check if phone number already exists in database
      console.log('[Phone Auth Profile] Checking phone uniqueness for:', cleanFirstPhone);
      const checkRes = await fetch(`${API_URL}/check-phone/${cleanFirstPhone}?excludeUserId=${activeUserId || ''}`);
      const checkData = await checkRes.json();
      if (checkRes.ok && checkData.success && checkData.exists) {
        setShowPhoneLinkedModal(true);
        setOtpLoading(false);
        return;
      }

      if (Platform.OS === 'web') {
        showAlert('Not Supported', 'SMS verification is not supported in the web browser.', 'info');
        setOtpLoading(false);
        return;
      }

      const formattedPhone = `+91${cleanFirstPhone}`;
      console.log('[Phone Auth Profile] Requesting OTP for:', formattedPhone);

      try {
        if (auth && typeof auth === 'function' && auth().signInWithPhoneNumber) {
          const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
          setConfirmResult(confirmation);
          setIsOTPResend(isResend);
          setShowOTPSentModal(true);
          setResendTimer(30);
        } else {
          throw new Error('Firebase Phone Auth service unavailable');
        }
      } catch (smsError) {
        console.error('[Phone Auth Profile] Firebase SMS failed:', smsError);
        setConfirmResult(null);
        showAlert('OTP Send Failed', smsError.message || 'SMS service failed to send verification code. Please check your phone number and try again.', 'error');
      }
    } catch (error) {
      console.error('[Phone Auth Profile] Send OTP Error:', error);
      showAlert('Verification Error', 'Could not verify phone number. Please try again.', 'error');
    } finally {
      setOtpLoading(false);
    }
  };

  const saveVerifiedPhoneToBackend = async (cleanPhone, isVerified) => {
    const activeUserId = await AsyncStorage.getItem('userid');
    if (!activeUserId) throw new Error('User ID not found');

    const response = await fetch(`${API_URL}/user/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userid: activeUserId,
        phone: cleanPhone,
        isPhoneVerified: isVerified
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to update phone number.');
    }

    await AsyncStorage.setItem('phone', cleanPhone);
    await AsyncStorage.setItem('isPhoneVerified', String(isVerified));

    setUser(prev => ({
      ...prev,
      phone: cleanPhone
    }));

    setShowPhoneOTPModal(false);
    setShowOTPVerifiedModal(true);
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.trim().length < 6) {
      showAlert('Invalid OTP Code', 'Please enter the full 6-digit verification code.', 'warning');
      return;
    }

    if (!confirmResult) {
      showAlert('Session Expired', 'Verification session expired. Please click Resend OTP.', 'warning');
      return;
    }

    setOtpLoading(true);
    let verified = false;

    try {
      console.log('[Phone Auth Profile] Confirming OTP code:', otpCode);
      await confirmResult.confirm(otpCode.trim());
      console.log('[Phone Auth Profile] Verification successful!');
      verified = true;
    } catch (otpError) {
      console.error('[Phone Auth Profile] OTP verification error:', otpError);
      showAlert('Verification Failed', 'The code you entered is invalid or expired. Please enter the exact 6-digit OTP received via SMS.', 'error');
      setOtpLoading(false);
      return;
    }

    if (verified) {
      try {
        const cleanPhone = verificationPhone.trim().slice(-10);
        await saveVerifiedPhoneToBackend(cleanPhone, true);
      } catch (dbError) {
        console.error('[Phone Auth Profile] Backend database update error:', dbError);
        setShowPhoneLinkedModal(true);
        setOtpLoading(false);
      }
    }
  };


  const handleUpdateProfile = async () => {
    setErrorMsg('');

    if (loginType === 'google') {
      if (!editDob.trim()) {
        setErrorMsg('Date of birth is required');
        return;
      }
      const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dobRegex.test(editDob.trim())) {
        setErrorMsg('Please use YYYY-MM-DD format (e.g. 2003-01-04)');
        return;
      }
    }

    setUpdating(true);
    try {
      const userid = await AsyncStorage.getItem('userid');
      if (!userid) {
        setErrorMsg('User session expired. Please log in again.');
        setUpdating(false);
        return;
      }

      const updatePayload = {
        userid,
        ...(loginType === 'google' ? { dateOfBirth: editDob.trim() } : {}),
      };

      const response = await fetch(`${API_URL}/user/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        await AsyncStorage.setItem('dateOfBirth', editDob.trim());

        setUser(prev => ({
          ...prev,
          dateOfBirth: editDob.trim(),
        }));

        setShowEditModal(false);
      } else {
        setErrorMsg(data.message || 'Failed to update profile.');
      }
    } catch (e) {
      console.error('Update profile error:', e);
      setErrorMsg('Could not connect to backend server. Make sure it is running.');
    } finally {
      setUpdating(false);
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = [];
  for (let y = 1940; y <= new Date().getFullYear(); y++) {
    years.push(y);
  }

  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const getDaysInMonth = (year, month) => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotalDays = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        day: prevTotalDays - i,
        isCurrentMonth: false,
        month: month === 0 ? 11 : month - 1,
        year: month === 0 ? year - 1 : year,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        month,
        year,
      });
    }

    // Next month padding days to complete grid (42 cells)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        month: month === 11 ? 0 : month + 1,
        year: month === 11 ? year + 1 : year,
      });
    }

    return days;
  };

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(prev => prev - 1);
    } else {
      setCalMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(prev => prev + 1);
    } else {
      setCalMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (dayObj) => {
    const formattedMonth = String(dayObj.month + 1).padStart(2, '0');
    const formattedDay = String(dayObj.day).padStart(2, '0');
    const selectedDate = `${dayObj.year}-${formattedMonth}-${formattedDay}`;
    setEditDob(selectedDate);
    setShowCalendar(false);
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
            <Feather name="user" size={18} color="#000000" />
            <Text style={styles.headerTitleText}>My Profile</Text>
          </View>

          <View style={styles.placeholderRight} />
        </View>

        {/* Details Container */}
        <View style={[styles.detailsContainer, styles.shadow]}>
          {/* Row 1: Username */}
          <View style={styles.detailRow}>
            <Feather name="user" size={20} color="#000000" />
            <Text style={styles.detailText}>{user.name}</Text>
          </View>

          {/* Row 2: Phone */}
          <View style={[styles.detailRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Feather name="phone" size={20} color="#000000" />
              <Text style={user.phone ? styles.detailText : [styles.detailText, { color: '#8E8E93', fontStyle: 'italic', fontWeight: '500' }]}>
                {user.phone || 'No phone number'}
              </Text>
            </View>
            {!user.phone && (
              <TouchableOpacity
                style={{
                  backgroundColor: '#FF9800',
                  borderRadius: 15,
                  paddingVertical: 6,
                  paddingHorizontal: 16,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                activeOpacity={0.8}
                onPress={handleOpenPhoneModal}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' }}>Verify</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Row 3: Email */}
          {!!user.email && (
            <View style={styles.detailRow}>
              <Feather name="mail" size={20} color="#000000" />
              <Text style={styles.detailText}>{user.email}</Text>
            </View>
          )}

          {/* Row 4: Date of Birth (Only for Google login accounts) */}
          {loginType === 'google' && (
            <View style={styles.detailRow}>
              <Feather name="calendar" size={20} color="#000000" />
              <Text style={styles.detailText}>{user.dateOfBirth}</Text>
            </View>
          )}

          {/* Row 5: Edit Profile Trigger */}
          <TouchableOpacity style={styles.editRow} activeOpacity={0.8} onPress={handleOpenEdit}>
            <FontAwesome5 name="user-edit" size={18} color="#000000" />
            <Text style={styles.editText}>Edit my profile</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showEditModal}
        onRequestClose={() => {
          if (!updating) setShowEditModal(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>

            {/* Email Field (Non-editable read-only) */}
            {!!user.email && (
              <View style={styles.inputContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <Text style={{ fontSize: 11, color: '#8E8E93', fontWeight: '600' }}>Read-only</Text>
                </View>
                <TextInput
                  style={[styles.textInput, { backgroundColor: '#F0F0F0', color: '#7E7C77', borderColor: '#E0E0E0' }]}
                  value={editEmail}
                  placeholder="Email address"
                  placeholderTextColor="#A19E95"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={false}
                />
              </View>
            )}

            {/* DOB Field (Read-only for Google accounts) */}
            {loginType === 'google' && (
              <View style={styles.inputContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.inputLabel}>Date of Birth</Text>
                  <Text style={{ fontSize: 11, color: '#8E8E93', fontWeight: '600' }}>Read-only</Text>
                </View>
                <TextInput
                  style={[styles.textInput, { backgroundColor: '#F0F0F0', color: '#7E7C77', borderColor: '#E0E0E0' }]}
                  value={editDob || 'N/A'}
                  editable={false}
                />
              </View>
            )}

            {/* Error Message */}
            {errorMsg ? (
              <Text style={styles.errorText}>{errorMsg}</Text>
            ) : null}

            {/* Buttons */}
            <View style={styles.modalButtonsContainer}>
              {updating ? (
                <ActivityIndicator size="small" color="#E05A47" style={styles.updatingIndicator} />
              ) : (
                <>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalConfirmButton,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={handleUpdateProfile}
                  >
                    <Text style={styles.modalConfirmText}>Save</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.modalCancelButton,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => setShowEditModal(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Month Dropdown Select Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showMonthSelect}
        onRequestClose={() => setShowMonthSelect(false)}
      >
        <TouchableOpacity
          style={styles.dropdownBackdrop}
          activeOpacity={1}
          onPress={() => setShowMonthSelect(false)}
        >
          <View style={styles.dropdownCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {months.map((m, idx) => (
                <TouchableOpacity
                  key={m}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setCalMonth(idx);
                    setShowMonthSelect(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Year Dropdown Select Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showYearSelect}
        onRequestClose={() => setShowYearSelect(false)}
      >
        <TouchableOpacity
          style={styles.dropdownBackdrop}
          activeOpacity={1}
          onPress={() => setShowYearSelect(false)}
        >
          <View style={styles.dropdownCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {years.slice().reverse().map((y) => (
                <TouchableOpacity
                  key={y}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setCalYear(y);
                    setShowYearSelect(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Phone Number OTP Verification Modal */}
      <Modal
        visible={showPhoneOTPModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!otpLoading) setShowPhoneOTPModal(false);
        }}
      >
        <View style={localStyles.alertBackdrop}>
          <View style={[localStyles.alertCard, { backgroundColor: '#F9F9F6', padding: 24 }]}>
            <View style={[localStyles.alertIconContainer, { backgroundColor: '#1E3545', marginBottom: 15 }]}>
              <Feather name="phone" size={28} color="#FFFFFF" />
            </View>

            {!confirmResult ? (
              // Step 1: Input Phone Number
              <>
                <Text style={localStyles.alertTitle}>Verify Phone Number</Text>
                <Text style={localStyles.alertMessage}>
                  Please enter your 10-digit mobile number to complete verification.
                </Text>
                
                <View style={[localStyles.addressInput, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: verificationPhone.trim().length === 10 ? '#2ECC71' : '#DCD3C5', paddingHorizontal: 14, marginBottom: 4, width: '100%', height: 50, borderRadius: 25 }]}>
                  <Text style={{ fontSize: 16, color: '#1E3545', fontWeight: 'bold', marginRight: 8 }}>+91</Text>
                  <TextInput
                    style={{ flex: 1, fontSize: 16, color: '#1A1A1A', fontWeight: '600', padding: 0 }}
                    placeholder="Enter Mobile Number"
                    placeholderTextColor="#A19E95"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={verificationPhone}
                    onChangeText={setVerificationPhone}
                    editable={!otpLoading}
                  />
                </View>

                <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingHorizontal: 6 }}>
                  <Text style={{ fontSize: 12, color: verificationPhone.trim().length === 10 ? '#2ECC71' : '#8E8E93', fontWeight: '600' }}>
                    {verificationPhone.trim().length === 10 ? '✓ Valid 10-digit number' : 'Must be 10 digits'}
                  </Text>
                  <Text style={{ fontSize: 12, color: verificationPhone.trim().length === 10 ? '#2ECC71' : '#7E7C77', fontWeight: 'bold' }}>
                    {verificationPhone.trim().length}/10
                  </Text>
                </View>

                <TouchableOpacity
                  style={[localStyles.alertButton, otpLoading && { opacity: 0.6 }]}
                  onPress={() => handleSendOTP(false)}
                  disabled={otpLoading}
                >
                  {otpLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={localStyles.alertButtonText}>Send OTP</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ marginTop: 15 }}
                  onPress={() => setShowPhoneOTPModal(false)}
                  disabled={otpLoading}
                >
                  <Text style={{ color: '#E05A47', fontWeight: '700', fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Step 2: Input OTP Code
              <>
                <Text style={localStyles.alertTitle}>Enter OTP</Text>
                <Text style={localStyles.alertMessage}>
                  We sent a 6-digit verification code to +91 {verificationPhone.trim().slice(-10)}.
                </Text>
                
                <TextInput
                  style={[localStyles.addressInput, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCD3C5', textAlign: 'center', fontSize: 20, letterSpacing: 5, fontWeight: 'bold', marginBottom: 20, width: '100%', height: 50, borderRadius: 25 }]}
                  placeholder="------"
                  placeholderTextColor="#A19E95"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  editable={!otpLoading}
                />

                <TouchableOpacity
                  style={[localStyles.alertButton, otpLoading && { opacity: 0.6 }]}
                  onPress={handleVerifyOTP}
                  disabled={otpLoading}
                >
                  {otpLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={localStyles.alertButtonText}>Verify & Save</Text>
                  )}
                </TouchableOpacity>

                {resendTimer > 0 ? (
                  <Text style={{ marginTop: 15, color: '#7E7C77', fontSize: 13, fontWeight: '600' }}>
                    Resend code in {resendTimer}s
                  </Text>
                ) : (
                  <TouchableOpacity
                    style={{ marginTop: 15 }}
                    onPress={() => handleSendOTP(true)}
                    disabled={otpLoading}
                  >
                    <Text style={{ color: '#1E3545', fontWeight: '700', fontSize: 14 }}>Resend OTP</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={{ marginTop: 12 }}
                  onPress={() => setConfirmResult(null)}
                  disabled={otpLoading}
                >
                  <Text style={{ color: '#E05A47', fontWeight: '700', fontSize: 14 }}>Back</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
      {/* Phone Number Already Linked Modal */}
      <Modal
        visible={showPhoneLinkedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPhoneLinkedModal(false)}
      >
        <View style={localStyles.alertBackdrop}>
          <View style={localStyles.linkedModalCard}>
            {/* Top accent bar */}
            <View style={localStyles.linkedModalAccentBar} />

            {/* Icon */}
            <View style={localStyles.linkedModalIconWrap}>
              <FontAwesome5 name="link" size={26} color="#FFFFFF" />
            </View>

            {/* Title */}
            <Text style={localStyles.linkedModalTitle}>Number Already Linked</Text>

            {/* Divider */}
            <View style={localStyles.linkedModalDivider} />

            {/* Message */}
            <Text style={localStyles.linkedModalMessage}>
              This phone number is already associated with another account. Please use a different number to continue.
            </Text>

            {/* OK Button */}
            <TouchableOpacity
              style={localStyles.linkedModalButton}
              onPress={() => setShowPhoneLinkedModal(false)}
              activeOpacity={0.85}
            >
              <Text style={localStyles.linkedModalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* OTP Sent Successfully Modal */}
      <Modal
        visible={showOTPSentModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOTPSentModal(false)}
      >
        <View style={localStyles.alertBackdrop}>
          <View style={localStyles.otpSentCard}>
            {/* Top accent bar */}
            <View style={localStyles.otpSentAccentBar} />

            {/* Icon */}
            <View style={localStyles.otpSentIconWrap}>
              <Feather name="check" size={30} color="#FFFFFF" />
            </View>

            {/* Title */}
            <Text style={localStyles.otpSentTitle}>
              {isOTPResend ? 'OTP Resent!' : 'OTP Sent!'}
            </Text>

            {/* Divider */}
            <View style={localStyles.otpSentDivider} />

            {/* Message */}
            <Text style={localStyles.otpSentMessage}>
              {isOTPResend
                ? 'A new OTP has been resent to your mobile number.'
                : 'A 6-digit OTP has been sent to your mobile number. Please check your messages.'}
            </Text>

            {/* OK Button */}
            <TouchableOpacity
              style={localStyles.otpSentButton}
              onPress={() => setShowOTPSentModal(false)}
              activeOpacity={0.85}
            >
              <Text style={localStyles.otpSentButtonText}>OK, Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* OTP Verified Successfully Modal */}
      <Modal
        visible={showOTPVerifiedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOTPVerifiedModal(false)}
      >
        <View style={localStyles.alertBackdrop}>
          <View style={localStyles.verifiedModalCard}>
            {/* Top accent bar */}
            <View style={localStyles.verifiedModalAccentBar} />

            {/* Icon */}
            <View style={localStyles.verifiedModalIconWrap}>
              <Feather name="shield" size={28} color="#FFFFFF" />
            </View>

            {/* Title */}
            <Text style={localStyles.verifiedModalTitle}>Verified Successfully!</Text>

            {/* Divider */}
            <View style={localStyles.verifiedModalDivider} />

            {/* Message */}
            <Text style={localStyles.verifiedModalMessage}>
              Your phone number has been verified and linked to your account.
            </Text>

            {/* OK Button */}
            <TouchableOpacity
              style={localStyles.verifiedModalButton}
              onPress={() => setShowOTPVerifiedModal(false)}
              activeOpacity={0.85}
            >
              <Text style={localStyles.verifiedModalButtonText}>Awesome!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Custom Alert Popup Modal */}
      <Modal
        visible={customAlert.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
      >
        <View style={localStyles.alertBackdrop}>
          <View style={localStyles.customAlertCard}>
            {/* Top accent bar */}
            <View
              style={[
                localStyles.customAlertAccentBar,
                {
                  backgroundColor:
                    customAlert.type === 'warning'
                      ? '#FF9800'
                      : customAlert.type === 'info'
                      ? '#1E3545'
                      : '#E05A47',
                },
              ]}
            />

            {/* Icon Wrap */}
            <View
              style={[
                localStyles.customAlertIconWrap,
                {
                  backgroundColor:
                    customAlert.type === 'warning'
                      ? '#FFF3E0'
                      : customAlert.type === 'info'
                      ? '#E8F4F9'
                      : '#FDF2F2',
                },
              ]}
            >
              <Feather
                name={
                  customAlert.type === 'warning'
                    ? 'alert-triangle'
                    : customAlert.type === 'info'
                    ? 'info'
                    : 'alert-circle'
                }
                size={30}
                color={
                  customAlert.type === 'warning'
                    ? '#E65100'
                    : customAlert.type === 'info'
                    ? '#1E3545'
                    : '#E05A47'
                }
              />
            </View>

            {/* Title */}
            <Text style={localStyles.customAlertTitle}>{customAlert.title}</Text>

            {/* Divider */}
            <View style={localStyles.customAlertDivider} />

            {/* Message */}
            <Text style={localStyles.customAlertMessage}>{customAlert.message}</Text>

            {/* Action Button */}
            <TouchableOpacity
              style={[
                localStyles.customAlertButton,
                {
                  backgroundColor:
                    customAlert.type === 'warning'
                      ? '#E65100'
                      : customAlert.type === 'info'
                      ? '#1E3545'
                      : '#E05A47',
                },
              ]}
              onPress={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
              activeOpacity={0.85}
            >
              <Text style={localStyles.customAlertButtonText}>Understand & Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  /* ── Custom Alert Popup Modal Styles ── */
  customAlertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    width: '84%',
    maxWidth: 330,
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  customAlertAccentBar: {
    width: '100%',
    height: 5,
  },
  customAlertIconWrap: {
    marginTop: 22,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  customAlertTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1E3545',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  customAlertDivider: {
    width: '78%',
    height: 1,
    backgroundColor: '#EBEBEB',
    marginBottom: 14,
  },
  customAlertMessage: {
    fontSize: 14,
    color: '#5A6E7F',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 22,
    marginBottom: 22,
  },
  customAlertButton: {
    marginBottom: 20,
    borderRadius: 50,
    paddingVertical: 13,
    paddingHorizontal: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  customAlertButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  alertBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  alertCard: {
    backgroundColor: '#F9F9F6',
    borderRadius: 24,
    padding: 24,
    width: '85%',
    maxWidth: 320,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  alertIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1E3545',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E3545',
    marginBottom: 8,
    textAlign: 'center'
  },
  alertMessage: {
    fontSize: 14,
    color: '#7E7C77',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20
  },
  alertButton: {
    backgroundColor: '#FF9800',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  alertButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  addressInput: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#DCD3C5',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },

  /* ── Phone Already Linked Modal ── */
  linkedModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '82%',
    maxWidth: 320,
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  linkedModalAccentBar: {
    width: '100%',
    height: 5,
    backgroundColor: '#E05A47',
  },
  linkedModalIconWrap: {
    marginTop: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E05A47',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#E05A47',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  linkedModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E3545',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  linkedModalDivider: {
    width: '80%',
    height: 1,
    backgroundColor: '#EBEBEB',
    marginBottom: 14,
  },
  linkedModalMessage: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  linkedModalButton: {
    marginBottom: 20,
    backgroundColor: '#E05A47',
    borderRadius: 50,
    paddingVertical: 13,
    paddingHorizontal: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E05A47',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  linkedModalButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  /* ── OTP Sent Successfully Modal ── */
  otpSentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '82%',
    maxWidth: 320,
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  otpSentAccentBar: {
    width: '100%',
    height: 5,
    backgroundColor: '#2ECC71',
  },
  otpSentIconWrap: {
    marginTop: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2ECC71',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#2ECC71',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  otpSentTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E3545',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  otpSentDivider: {
    width: '80%',
    height: 1,
    backgroundColor: '#EBEBEB',
    marginBottom: 14,
  },
  otpSentMessage: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  otpSentButton: {
    marginBottom: 20,
    backgroundColor: '#2ECC71',
    borderRadius: 50,
    paddingVertical: 13,
    paddingHorizontal: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2ECC71',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  otpSentButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  /* ── OTP Verified Successfully Modal ── */
  verifiedModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '82%',
    maxWidth: 320,
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  verifiedModalAccentBar: {
    width: '100%',
    height: 5,
    backgroundColor: '#1E3545',
  },
  verifiedModalIconWrap: {
    marginTop: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E3545',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#1E3545',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  verifiedModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E3545',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  verifiedModalDivider: {
    width: '80%',
    height: 1,
    backgroundColor: '#EBEBEB',
    marginBottom: 14,
  },
  verifiedModalMessage: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  verifiedModalButton: {
    marginBottom: 20,
    backgroundColor: '#1E3545',
    borderRadius: 50,
    paddingVertical: 13,
    paddingHorizontal: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E3545',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  verifiedModalButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
