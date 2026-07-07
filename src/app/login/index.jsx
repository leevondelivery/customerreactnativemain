import { Feather, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { API_URL } from '../../config';
import { styles } from './login.styles';
import LoadingView from '../../components/LoadingView';

export default function LoginScreen() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Custom Alert States
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Check login status on mount
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const userid = await AsyncStorage.getItem('userid');
        if (userid) {
          router.replace('/restaurentlist');
        }
      } catch (error) {
        console.error('Error checking login status:', error);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkLoginStatus();
  }, [router]);

  const handleLogin = async () => {
    if (!mobile || !password) {
      setErrorMessage('Please fill in all fields');
      setShowErrorModal(true);
      return;
    }

    setLoading(true);
    try {
      console.log(`Attempting login at: ${API_URL}/login`);
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: mobile, password }),
      });

      const data = await response.json();
      console.log('Login response:', data);

      if (response.ok && data.success) {
        const user = data.user;
        const logintime = new Date().toLocaleString();

        // Save session in AsyncStorage
        await AsyncStorage.setItem('userid', user._id || 'N/A');
        await AsyncStorage.setItem('phone', user.phone || 'N/A');
        await AsyncStorage.setItem('name', user.name || 'N/A');
        await AsyncStorage.setItem('email', user.email || 'N/A');
        await AsyncStorage.setItem('logintime', logintime);
        await AsyncStorage.setItem('coins', String(user.coins ?? 0));
        await AsyncStorage.setItem('dateOfBirth', String(user.dateOfBirth ?? ''));

        router.replace('/restaurentlist');
      } else {
        setErrorMessage(data.message || 'Mobile number and password is incorrect');
        setShowErrorModal(true);
      }
    } catch (error) {
      setErrorMessage('Could not connect to backend server. Make sure the server is running.');
      setShowErrorModal(true);
      console.error('Login request error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return <LoadingView />;
  }

  return (
    <View style={styles.container}>
      {/* Root Split Background */}
      <View style={styles.leftBg} />
      <View style={styles.rightBg} />

      {/* Custom Error Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showErrorModal}
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconContainer}>
              <FontAwesome name="times" size={36} color="white" />
            </View>
            <Text style={styles.modalText}>{errorMessage}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.modalButtonText}>
                {errorMessage === 'User not found' ? 'Create Account' : 'Try Again'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlayContainer}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Logo Pill */}
          <View style={[styles.brandCard, styles.shadow]}>
            <Text style={styles.brandText}>LEEVON</Text>
          </View>

          {/* Inputs Section */}
          <View style={styles.formContainer}>
            {/* Mobile Number Input */}
            <View style={[styles.inputPill, styles.shadow]}>
              <Feather name="user" size={18} color="#9C9C9C" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Mobile number"
                placeholderTextColor="#9C9C9C"
                keyboardType="phone-pad"
                value={mobile}
                onChangeText={setMobile}
                autoCapitalize="none"
              />
            </View>

            {/* Password Input */}
            <View style={[styles.inputPill, styles.shadow]}>
              <Feather name="lock" size={18} color="#E05A47" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: '#E05A47' }]}
                placeholder="Password"
                placeholderTextColor="#E05A47"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.buttonPill, styles.shadow]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
