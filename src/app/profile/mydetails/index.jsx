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
} from 'react-native';

import { useTabBar } from '../../_layout';
import { API_URL } from '../../../config';
import { styles } from '../../../styles/mydetails.styles';
import LoadingView from '../../../components/LoadingView';

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

        setUser({
          name: name && name.toLowerCase() !== 'n/a' ? name : 'Customer',
          phone: phone && phone.toLowerCase() !== 'n/a' ? phone : '',
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
          <View style={styles.detailRow}>
            <Feather name="phone" size={20} color="#000000" />
            <Text style={styles.detailText}>{user.phone}</Text>
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
    </View>
  );
}
