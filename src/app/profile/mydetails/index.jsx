import { Feather, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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

  const [user, setUser] = useState({
    name: 'Gsvinith',
    phone: '6300733511',
    email: 'gs@gmail.com',
    dateOfBirth: '2003-01-04',
  });
  const [loading, setLoading] = useState(false);
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
  const [firstInputPhone, setFirstInputPhone] = useState('');
  const [isBypassMode, setIsBypassMode] = useState(false);
  const resendCountRef = useRef(0);
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
        const name = await AsyncStorage.getItem('name');
        const phone = await AsyncStorage.getItem('phone');
        const email = await AsyncStorage.getItem('email');
        const dateOfBirth = await AsyncStorage.getItem('dateOfBirth');

        // Extract date component (YYYY-MM-DD) from ISO format if present
        let formattedDob = '2003-01-04';
        if (dateOfBirth && dateOfBirth.toLowerCase() !== 'n/a') {
          formattedDob = dateOfBirth.includes('T') ? dateOfBirth.split('T')[0] : dateOfBirth;
        }

        const isTemp = phone && (phone.startsWith('google_temp_') || phone.startsWith('temp_google_'));
        setUser({
          name: name && name.toLowerCase() !== 'n/a' ? name : 'Customer',
          phone: phone && phone.toLowerCase() !== 'n/a' && !isTemp ? phone : '',
          email: email && email.toLowerCase() !== 'n/a' ? email : '',
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
    const dobParts = user.dateOfBirth.split('-');
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

  const showAlert = (title, message) => {
    Alert.alert(title, message, [{ text: 'OK' }]);
  };

  const handleOpenPhoneVerification = () => {
    setVerificationPhone('');
    setOtpCode('');
    setConfirmResult(null);
    setResendTimer(0);
    setIsBypassMode(false);
    resendCountRef.current = 0;
    setShowPhoneOTPModal(true);
  };

  const handleSendOTP = async (isResend = false) => {
    if (!verificationPhone || verificationPhone.trim().length < 10) {
      showAlert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
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
        showAlert('Phone Number Linked', 'Phone number already linked to another account.');
        setOtpLoading(false);
        return;
      }

      if (Platform.OS === 'web') {
        showAlert('Not Supported', 'SMS verification is not supported in the web browser.');
        setOtpLoading(false);
        return;
      }

      const formattedPhone = `+91${cleanFirstPhone}`;
      console.log('[Phone Auth Profile] Requesting OTP for:', formattedPhone);

      // Save the first input phone number
      setFirstInputPhone(cleanFirstPhone);

      const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
      setConfirmResult(confirmation);
      showAlert('OTP Sent', isResend ? 'OTP Resent Successfully!' : 'OTP Sent Successfully!');
      setResendTimer(30);

      if (isResend) {
        resendCountRef.current += 1;
        if (resendCountRef.current >= 2) {
          setIsBypassMode(true);
          setVerificationPhone(''); // Clear it so they must re-enter to confirm!
        }
      }
    } catch (error) {
      console.error('[Phone Auth Profile] Send OTP Error:', error);
      if (error.code === 'auth/too-many-requests' || error.message?.includes('blocked')) {
        showAlert('Temporarily Blocked', 'Too many requests. Switching to verbal confirmation.');
        const cleanFirstPhone = verificationPhone.trim().slice(-10);
        setFirstInputPhone(cleanFirstPhone);
        setIsBypassMode(true);
        setVerificationPhone(''); // Clear it so they must re-enter to confirm!
      } else {
        // If they click resend and it fails due to network/etc., check if resend count reached 2
        if (isResend) {
          resendCountRef.current += 1;
          if (resendCountRef.current >= 2) {
            showAlert('Switching to Verbal Confirmation', 'SMS service is not responding. Please confirm your number.');
            const cleanFirstPhone = verificationPhone.trim().slice(-10);
            setFirstInputPhone(cleanFirstPhone);
            setIsBypassMode(true);
            setVerificationPhone(''); // Clear it so they must re-enter to confirm!
          } else {
            showAlert('OTP Send Failed', 'Failed to send OTP. Please check your network or try again.');
          }
        } else {
          showAlert('OTP Send Failed', 'Failed to send OTP. Please check your network or try again.');
        }
      }
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
    showAlert('Success', 'Phone number linked and verified successfully!');
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 6) {
      showAlert('Invalid OTP', 'Please enter the 6-digit verification code.');
      return;
    }

    setOtpLoading(true);
    let verified = false;

    try {
      console.log('[Phone Auth Profile] Confirming OTP code:', otpCode);
      await confirmResult.confirm(otpCode);
      console.log('[Phone Auth Profile] Verification successful!');
      verified = true;
    } catch (otpError) {
      console.error('[Phone Auth Profile] OTP verification error:', otpError);
      showAlert('Verification Failed', 'The code you entered is invalid or expired. Please try again.');
      setOtpLoading(false);
      return;
    }

    if (verified) {
      try {
        const cleanPhone = verificationPhone.trim().slice(-10);
        await saveVerifiedPhoneToBackend(cleanPhone, true);
      } catch (dbError) {
        console.error('[Phone Auth Profile] Backend database update error:', dbError);
        showAlert('Phone Number Linked', 'Phone number already linked to another account.');
        setOtpLoading(false);
      }
    }
  };

  const handleBypassSubmit = async () => {
    if (!verificationPhone || verificationPhone.trim().length < 10) {
      showAlert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setOtpLoading(true);
    try {
      const cleanPhone = verificationPhone.trim().slice(-10);
      const activeUserId = await AsyncStorage.getItem('userid');

      // Check phone uniqueness
      console.log('[Phone Auth Profile] Bypass checking phone uniqueness for:', cleanPhone);
      const checkRes = await fetch(`${API_URL}/check-phone/${cleanPhone}?excludeUserId=${activeUserId || ''}`);
      const checkData = await checkRes.json();
      if (checkRes.ok && checkData.success && checkData.exists) {
        showAlert('Phone Number Linked', 'Phone number already linked to another account.');
        setOtpLoading(false);
        return;
      }

      // Verify both phone numbers are the same
      if (cleanPhone !== firstInputPhone) {
        showAlert('Verification Error', 'The phone number entered does not match the first number you entered. Please verify your number.');
        setOtpLoading(false);
        return;
      }

      console.log('[Phone Auth Profile] Bypassing OTP, saving number as unverified:', cleanPhone);
      await saveVerifiedPhoneToBackend(cleanPhone, false);
    } catch (error) {
      console.error('[Phone Auth Profile] Bypass submit error:', error);
      showAlert('Error saving number', 'Failed to save your phone number. Please try again.');
      setOtpLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    setErrorMsg('');

    // Validations
    if (!editEmail.trim()) {
      setErrorMsg('Email is required');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editEmail.trim())) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    if (!editDob.trim()) {
      setErrorMsg('Date of birth is required');
      return;
    }
    const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dobRegex.test(editDob.trim())) {
      setErrorMsg('Please use YYYY-MM-DD format (e.g. 2003-01-04)');
      return;
    }

    setUpdating(true);
    try {
      const userid = await AsyncStorage.getItem('userid');
      if (!userid) {
        setErrorMsg('User session expired. Please log in again.');
        setUpdating(false);
        return;
      }

      const response = await fetch(`${API_URL}/user/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userid,
          email: editEmail.trim(),
          dateOfBirth: editDob.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        // Save to cache
        await AsyncStorage.setItem('email', editEmail.trim());
        await AsyncStorage.setItem('dateOfBirth', editDob.trim());

        // Update state
        setUser(prev => ({
          ...prev,
          email: editEmail.trim(),
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
                onPress={handleOpenPhoneVerification}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' }}>Verify</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Row 3: Email */}
          <View style={styles.detailRow}>
            <Feather name="mail" size={20} color="#000000" />
            <Text style={styles.detailText}>{user.email}</Text>
          </View>

          {/* Row 4: Date of Birth */}
          <View style={styles.detailRow}>
            <Feather name="calendar" size={20} color="#000000" />
            <Text style={styles.detailText}>{user.dateOfBirth}</Text>
          </View>

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

            {/* Email Field */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.textInput}
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="gs@gmail.com"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!updating}
              />
            </View>

            {/* DOB Field */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Date of Birth</Text>
              <TouchableOpacity
                style={[styles.textInput, styles.dobInputButton]}
                activeOpacity={0.8}
                disabled={updating}
                onPress={() => setShowCalendar(prev => !prev)}
              >
                <Text style={editDob ? styles.dobInputText : styles.dobInputTextPlaceholder}>
                  {editDob || 'Select Date'}
                </Text>
                <Feather name="calendar" size={18} color="#C2932E" />
              </TouchableOpacity>

              {/* Inline Custom Calendar Dropdown */}
              {showCalendar && (
                <View style={styles.calendarCard}>
                  {/* Month/Year Title and Chevron Navigation */}
                  <View style={styles.calendarHeader}>
                    <TouchableOpacity
                      style={styles.calendarHeaderBtn}
                      onPress={handlePrevMonth}
                    >
                      <Feather name="chevron-left" size={20} color="#8E8E93" />
                    </TouchableOpacity>

                    <Text style={styles.calendarHeaderTitle}>
                      {months[calMonth]} {calYear}
                    </Text>

                    <TouchableOpacity
                      style={styles.calendarHeaderBtn}
                      onPress={handleNextMonth}
                    >
                      <Feather name="chevron-right" size={20} color="#8E8E93" />
                    </TouchableOpacity>
                  </View>

                  {/* Dropdown triggers for Month and Year */}
                  <View style={styles.calendarSelectors}>
                    {/* Month Dropdown Badge */}
                    <TouchableOpacity
                      style={styles.selectorBadge}
                      onPress={() => setShowMonthSelect(true)}
                    >
                      <Text style={styles.selectorText}>{months[calMonth]}</Text>
                      <Feather name="chevron-down" size={14} color="#000000" />
                    </TouchableOpacity>

                    {/* Year Dropdown Badge */}
                    <TouchableOpacity
                      style={styles.selectorBadge}
                      onPress={() => setShowYearSelect(true)}
                    >
                      <Text style={styles.selectorText}>{calYear}</Text>
                      <Feather name="chevron-down" size={14} color="#000000" />
                    </TouchableOpacity>
                  </View>

                  {/* Weekdays Row */}
                  <View style={styles.weekdaysRow}>
                    {weekdays.map((wd) => (
                      <Text key={wd} style={styles.weekdayText}>
                        {wd}
                      </Text>
                    ))}
                  </View>

                  {/* Date Grid */}
                  <View style={styles.daysGrid}>
                    {getDaysInMonth(calYear, calMonth).map((dayObj, index) => {
                      const isSelected = editDob === `${dayObj.year}-${String(dayObj.month + 1).padStart(2, '0')}-${String(dayObj.day).padStart(2, '0')}`;
                      return (
                        <TouchableOpacity
                          key={index}
                          style={styles.dayCell}
                          onPress={() => handleSelectDay(dayObj)}
                          activeOpacity={0.8}
                        >
                          <View style={isSelected && dayObj.isCurrentMonth ? styles.activeDayCircle : null}>
                            <Text
                              style={[
                                styles.dayText,
                                !dayObj.isCurrentMonth && styles.dayTextInactive,
                                isSelected && dayObj.isCurrentMonth && styles.dayTextSelected,
                              ]}
                            >
                              {dayObj.day}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

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

            {!confirmResult && !isBypassMode ? (
              // Step 1: Input Phone Number
              <>
                <Text style={localStyles.alertTitle}>Verify Phone Number</Text>
                <Text style={localStyles.alertMessage}>
                  Please enter your 10-digit mobile number to complete verification.
                </Text>
                
                <View style={[localStyles.addressInput, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCD3C5', paddingHorizontal: 12, marginBottom: 20, width: '100%', height: 50, borderRadius: 25 }]}>
                  <Text style={{ fontSize: 16, color: '#7E7C77', fontWeight: 'bold', marginRight: 5 }}>+91</Text>
                  <TextInput
                    style={{ flex: 1, fontSize: 16, color: '#1A1A1A', padding: 0 }}
                    placeholder="Enter Mobile Number"
                    placeholderTextColor="#A19E95"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={verificationPhone}
                    onChangeText={setVerificationPhone}
                    disabled={otpLoading}
                  />
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
            ) : isBypassMode ? (
              // Bypass Mode: Input Number directly (manual verbal confirmation)
              <>
                <Text style={localStyles.alertTitle}>Confirm Phone Number</Text>
                <Text style={[localStyles.alertMessage, { color: '#B78103', fontWeight: '600', marginBottom: 12 }]}>
                  SMS services are delayed. Please confirm your 10-digit number below. We will call you to verify your profile details.
                </Text>

                {/* First Input: Already Entered Number (Disabled/ReadOnly) */}
                <Text style={{ fontSize: 13, color: '#7E7C77', fontWeight: 'bold', alignSelf: 'flex-start', marginBottom: 5 }}>Original Number Entered:</Text>
                <View style={[localStyles.addressInput, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFEFEF', borderWidth: 1, borderColor: '#DCD3C5', paddingHorizontal: 12, marginBottom: 12, opacity: 0.8, width: '100%', height: 50, borderRadius: 25 }]}>
                  <Text style={{ fontSize: 16, color: '#7E7C77', fontWeight: 'bold', marginRight: 5 }}>+91</Text>
                  <TextInput
                    style={{ flex: 1, fontSize: 16, color: '#7E7C77', padding: 0 }}
                    value={firstInputPhone}
                    editable={false}
                  />
                </View>

                {/* Second Input: Manually Entered Confirmation Number */}
                <Text style={{ fontSize: 13, color: '#7E7C77', fontWeight: 'bold', alignSelf: 'flex-start', marginBottom: 5 }}>Confirm Mobile Number:</Text>
                <View style={[localStyles.addressInput, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCD3C5', paddingHorizontal: 12, marginBottom: 20, width: '100%', height: 50, borderRadius: 25 }]}>
                  <Text style={{ fontSize: 16, color: '#7E7C77', fontWeight: 'bold', marginRight: 5 }}>+91</Text>
                  <TextInput
                    style={{ flex: 1, fontSize: 16, color: '#1A1A1A', padding: 0 }}
                    placeholder="Re-enter Mobile Number"
                    placeholderTextColor="#A19E95"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={verificationPhone}
                    onChangeText={setVerificationPhone}
                    disabled={otpLoading}
                  />
                </View>

                <TouchableOpacity
                  style={[localStyles.alertButton, { backgroundColor: '#B78103' }, otpLoading && { opacity: 0.6 }]}
                  onPress={handleBypassSubmit}
                  disabled={otpLoading}
                >
                  {otpLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={localStyles.alertButtonText}>Confirm & Save</Text>
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
                  disabled={otpLoading}
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
    </View>
  );
}

const localStyles = StyleSheet.create({
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
  }
});
