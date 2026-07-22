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
import { styles } from '../../styles/login.styles';
import LoadingView from '../../components/LoadingView';
// Native-only modules: lazily required to avoid crashes when not linked
let GoogleSignin = null;
let auth = null;
let GoogleAuthProvider = null;
if (Platform.OS !== 'web') {
  try {
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  } catch (e) {
    console.warn('[Login] GoogleSignin native module not available:', e.message);
  }
  try {
    const firebaseAuth = require('@react-native-firebase/auth');
    auth = firebaseAuth.default;
    GoogleAuthProvider = firebaseAuth.GoogleAuthProvider;
  } catch (e) {
    console.warn('[Login] Firebase Auth native module not available:', e.message);
  }
}

export default function LoginScreen() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');

  // Forgot Password Modal States
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordPhone, setForgotPasswordPhone] = useState('');
  const [forgotPasswordOtp, setForgotPasswordOtp] = useState('');
  const [forgotPasswordConfirmResult, setForgotPasswordConfirmResult] = useState(null);
  const [forgotPasswordNewPassword, setForgotPasswordNewPassword] = useState('');
  const [forgotPasswordConfirmPassword, setForgotPasswordConfirmPassword] = useState('');
  const [forgotPasswordStep, setForgotPasswordStep] = useState(1); // 1 = send OTP, 2 = reset password
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [showForgotPasswordNewPassword, setShowForgotPasswordNewPassword] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState('');


  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      console.log('[Google Login] Checking play services...');
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      console.log('[Google Login] Requesting user account...');
      // Sign out from any existing session first to force the Google Account Chooser
      try {
        await GoogleSignin.signOut();
      } catch (signOutError) {
        console.log('[Google Login] Error signing out before sign in:', signOutError);
      }
      
      await GoogleSignin.signIn();
      
      console.log('[Google Login] Fetching access and ID tokens...');
      const tokens = await GoogleSignin.getTokens();
      const idToken = tokens.idToken;
      const accessToken = tokens.accessToken;
      
      console.log('[Google Login] Firebase authenticating credential...');
      const googleCredential = GoogleAuthProvider.credential(idToken, accessToken);
      const userCredential = await auth().signInWithCredential(googleCredential);
      
      console.log('[Google Login] Fetching Firebase ID token...');
      const firebaseIdToken = await userCredential.user.getIdToken();
      
      console.log('[Google Login] Syncing with backend at:', `${API_URL}/login/google`);
      const response = await fetch(`${API_URL}/login/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken: firebaseIdToken }),
      });

      const data = await response.json();
      console.log('[Google Login] Backend response:', data);

      if (response.ok && data.success) {
        const user = data.user;
        const logintime = String(Date.now());

        // Save session in AsyncStorage
        await AsyncStorage.setItem('userid', user._id || 'N/A');
        await AsyncStorage.setItem('phone', user.phone || 'N/A');
        await AsyncStorage.setItem('isPhoneVerified', String(user.isPhoneVerified ?? 'false'));
        
        // Use user.name from backend, fallback to firebase displayName, fallback to 'N/A'
        const displayName = user.name && user.name.toLowerCase() !== 'n/a'
          ? user.name
          : (userCredential.user.displayName && userCredential.user.displayName.toLowerCase() !== 'n/a'
              ? userCredential.user.displayName
              : 'N/A');
        await AsyncStorage.setItem('name', displayName);

        // Use user.email from backend, fallback to firebase email, fallback to 'N/A'
        const displayEmail = user.email && user.email.toLowerCase() !== 'n/a'
          ? user.email
          : (userCredential.user.email && userCredential.user.email.toLowerCase() !== 'n/a'
              ? userCredential.user.email
              : 'N/A');
        await AsyncStorage.setItem('email', displayEmail);
        await AsyncStorage.setItem('logintime', logintime);
        await AsyncStorage.setItem('coins', String(user.coins ?? 0));
        await AsyncStorage.setItem('dateOfBirth', String(user.dateOfBirth ?? ''));

        router.replace('/restaurentlist');
      } else {
        setErrorMessage(data.message || 'Failed to sync account with backend.');
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('[Google Login] Flow error:', error);
      setErrorMessage('Google Sign-in failed. Please verify your Google account or connection.');
      setShowErrorModal(true);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Check login status on mount
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        // Daily Fields Verification (Once per day when the app starts)
        const todayStr = new Date().toDateString();
        const lastCheckStr = await AsyncStorage.getItem('lastDailyFieldsCheck');

        if (lastCheckStr !== todayStr) {
          const storedUserId = await AsyncStorage.getItem('userid');
          if (storedUserId) {
            const phone = await AsyncStorage.getItem('phone');
            const name = await AsyncStorage.getItem('name');
            const email = await AsyncStorage.getItem('email');
            const logintime = await AsyncStorage.getItem('logintime');
            const isPhoneVerified = await AsyncStorage.getItem('isPhoneVerified');

            if (!phone || !name || !email || !logintime || !isPhoneVerified) {
              console.log('[Session] Daily check: Required session fields are missing. Clearing storage.');
              await AsyncStorage.clear();
            } else {
              await AsyncStorage.setItem('lastDailyFieldsCheck', todayStr);
            }
          }
        }

        // Check if session has expired (exceeded 15 days)
        const logintimeStr = await AsyncStorage.getItem('logintime');
        if (logintimeStr) {
          let loginTimeMs = parseInt(logintimeStr, 10);
          if (isNaN(loginTimeMs)) {
            // Fallback for old legacy logintime format (toLocaleString string)
            loginTimeMs = Date.parse(logintimeStr);
          }

          if (!isNaN(loginTimeMs)) {
            const fifteenDaysInMs = 15 * 24 * 60 * 60 * 1000;
            if (Date.now() - loginTimeMs > fifteenDaysInMs) {
              console.log('[Session] Session expired (> 15 days). Clearing credentials.');
              await AsyncStorage.clear();
            } else {
              // Session is active and valid. Extend it for another 15 days.
              await AsyncStorage.setItem('logintime', String(Date.now()));
            }
          } else {
            console.log('[Session] Invalid session timestamp. Clearing credentials.');
            await AsyncStorage.clear();
          }
        }

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
        const logintime = String(Date.now());

        // Save session in AsyncStorage
        await AsyncStorage.setItem('userid', user._id || 'N/A');
        await AsyncStorage.setItem('phone', user.phone || 'N/A');
        await AsyncStorage.setItem('isPhoneVerified', String(user.isPhoneVerified ?? 'false'));
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

  const handleSignUp = async () => {
    if (!mobile || !password || !confirmPassword || !name) {
      setErrorMessage('Please fill in all fields');
      setShowErrorModal(true);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      setShowErrorModal(true);
      return;
    }

    setLoading(true);
    try {
      console.log(`Attempting signup at: ${API_URL}/signup`);
      const response = await fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: mobile, password, name }),
      });

      const data = await response.json();
      console.log('Signup response:', data);

      if (response.ok && data.success) {
        setPassword('');
        setConfirmPassword('');
        setIsSignUp(false);
        setErrorMessage('Account created successfully! Please enter your password to log in.');
        setShowErrorModal(true);
      } else {
        setErrorMessage(data.message || 'Signup failed. Please try again.');
        setShowErrorModal(true);
      }
    } catch (error) {
      setErrorMessage('Could not connect to backend server. Make sure the server is running.');
      setShowErrorModal(true);
      console.error('Signup request error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendForgotPasswordOTP = async () => {
    setForgotPasswordError('');
    if (!forgotPasswordPhone || forgotPasswordPhone.trim().length < 10) {
      setForgotPasswordError('Please enter a valid 10-digit mobile number');
      return;
    }

    setForgotPasswordLoading(true);
    try {
      console.log(`Checking if phone exists: ${API_URL}/forgot-password/check-phone`);
      const checkResponse = await fetch(`${API_URL}/forgot-password/check-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: forgotPasswordPhone.trim() }),
      });

      const checkData = await checkResponse.json();
      if (!checkResponse.ok || !checkData.success) {
        setForgotPasswordError(checkData.message || 'User not found. Please register or check your number.');
        setForgotPasswordLoading(false);
        return;
      }

      // User exists, request Firebase OTP
      const formattedPhone = `+91${forgotPasswordPhone.trim().slice(-10)}`;
      console.log(`[Forgot Password] Triggering Firebase OTP for: ${formattedPhone}`);
      const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
      
      setForgotPasswordConfirmResult(confirmation);
      setForgotPasswordStep(2);
    } catch (error) {
      console.error('[Forgot Password] OTP request error:', error);
      if (error.code === 'auth/too-many-requests' || error.message?.includes('blocked')) {
        setForgotPasswordError('Too many request attempts. Please try again later.');
      } else {
        setForgotPasswordError('Failed to send OTP. Please check your network or try again.');
      }
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleResetForgotPassword = async () => {
    setForgotPasswordError('');
    if (!forgotPasswordOtp || !forgotPasswordNewPassword || !forgotPasswordConfirmPassword) {
      setForgotPasswordError('Please fill in all fields');
      return;
    }

    if (forgotPasswordNewPassword !== forgotPasswordConfirmPassword) {
      setForgotPasswordError('Passwords do not match');
      return;
    }

    setForgotPasswordLoading(true);
    try {
      console.log('[Forgot Password] Confirming OTP code:', forgotPasswordOtp);
      await forgotPasswordConfirmResult.confirm(forgotPasswordOtp);
      console.log('[Forgot Password] Firebase OTP verified successfully! Resetting password...');

      const response = await fetch(`${API_URL}/forgot-password/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: forgotPasswordPhone.trim(),
          newPassword: forgotPasswordNewPassword,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setShowForgotPasswordModal(false);
        setForgotPasswordPhone('');
        setForgotPasswordOtp('');
        setForgotPasswordConfirmResult(null);
        setForgotPasswordNewPassword('');
        setForgotPasswordConfirmPassword('');
        setForgotPasswordStep(1);
        setErrorMessage('Password reset successfully! Please login with your new password.');
        setShowErrorModal(true);
      } else {
        setForgotPasswordError(data.message || 'Password reset failed.');
      }
    } catch (error) {
      console.error('[Forgot Password] Reset error:', error);
      if (error.code === 'auth/invalid-verification-code') {
        setForgotPasswordError('Invalid OTP code. Please try again.');
      } else {
        setForgotPasswordError(error.message || 'Could not connect to backend server. Make sure the server is running.');
      }
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleCloseForgotPasswordModal = () => {
    setShowForgotPasswordModal(false);
    setForgotPasswordPhone('');
    setForgotPasswordOtp('');
    setForgotPasswordConfirmResult(null);
    setForgotPasswordNewPassword('');
    setForgotPasswordConfirmPassword('');
    setForgotPasswordStep(1);
    setForgotPasswordError('');
  };

  if (checkingAuth || loading || googleLoading) {
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
            <View style={[
              styles.modalIconContainer,
              errorMessage.includes('successfully') && { backgroundColor: '#4CAF50', shadowColor: '#4CAF50' }
            ]}>
              <FontAwesome
                name={errorMessage.includes('successfully') ? "check" : "times"}
                size={36}
                color="white"
              />
            </View>
            <Text style={styles.modalText}>{errorMessage}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => {
                setShowErrorModal(false);
                if (errorMessage === 'User not found') {
                  setIsSignUp(true);
                }
              }}
            >
              <Text style={styles.modalButtonText}>
                {errorMessage === 'User not found' 
                  ? 'Create Account' 
                  : (errorMessage.includes('successfully') ? 'OK' : 'Try Again')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Forgot Password Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showForgotPasswordModal}
        onRequestClose={handleCloseForgotPasswordModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 350, paddingTop: 30 }]}>
            <Text style={[styles.modalText, { fontSize: 20, marginBottom: 20 }]}>
              {forgotPasswordStep === 1 ? 'Forgot Password' : 'Reset Password'}
            </Text>

            {forgotPasswordStep === 1 ? (
              // Step 1: Request OTP Form
              <View style={{ width: '100%', gap: 15, marginBottom: 20 }}>
                <Text style={{ color: '#7E7C77', fontSize: 13, textAlign: 'center', marginBottom: 5 }}>
                  Enter your mobile number to receive a verification OTP
                </Text>

                {/* Mobile number input inside modal */}
                <View style={[styles.inputPill, styles.shadow, { height: 50, borderWidth: 1, borderColor: '#DCD3C5' }]}>
                  <Feather name="phone" size={16} color="#9C9C9C" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { fontSize: 14 }]}
                    placeholder="Mobile number"
                    placeholderTextColor="#9C9C9C"
                    keyboardType="phone-pad"
                    value={forgotPasswordPhone}
                    onChangeText={(text) => setForgotPasswordPhone(text.replace(/[^0-9]/g, ''))}
                    maxLength={10}
                    autoCapitalize="none"
                  />
                </View>
              </View>
            ) : (
              // Step 2: OTP Verification & New Password Form
              <View style={{ width: '100%', gap: 15, marginBottom: 20 }}>
                <Text style={{ color: '#7E7C77', fontSize: 13, textAlign: 'center', marginBottom: 5 }}>
                  Enter the 6-digit OTP code sent to your number and choose a new password
                </Text>

                {/* OTP input */}
                <View style={[styles.inputPill, styles.shadow, { height: 50, borderWidth: 1, borderColor: '#DCD3C5' }]}>
                  <Feather name="shield" size={16} color="#9C9C9C" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { fontSize: 14 }]}
                    placeholder="6-digit OTP"
                    placeholderTextColor="#9C9C9C"
                    keyboardType="number-pad"
                    value={forgotPasswordOtp}
                    onChangeText={setForgotPasswordOtp}
                    maxLength={6}
                    autoCapitalize="none"
                  />
                </View>

                {/* New Password input */}
                <View style={[styles.inputPill, styles.shadow, { height: 50, borderWidth: 1, borderColor: '#DCD3C5' }]}>
                  <Feather name="lock" size={16} color="#E05A47" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: '#E05A47', fontSize: 14 }]}
                    placeholder="New Password"
                    placeholderTextColor="#E05A47"
                    secureTextEntry={!showForgotPasswordNewPassword}
                    value={forgotPasswordNewPassword}
                    onChangeText={setForgotPasswordNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowForgotPasswordNewPassword(!showForgotPasswordNewPassword)} style={{ padding: 4 }}>
                    <Feather name={showForgotPasswordNewPassword ? "eye" : "eye-off"} size={16} color="#E05A47" />
                  </TouchableOpacity>
                </View>

                {/* Confirm New Password input */}
                <View style={[styles.inputPill, styles.shadow, { height: 50, borderWidth: 1, borderColor: '#DCD3C5' }]}>
                  <Feather name="lock" size={16} color="#E05A47" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: '#E05A47', fontSize: 14 }]}
                    placeholder="Confirm New Password"
                    placeholderTextColor="#E05A47"
                    secureTextEntry={!showForgotPasswordNewPassword}
                    value={forgotPasswordConfirmPassword}
                    onChangeText={setForgotPasswordConfirmPassword}
                    autoCapitalize="none"
                  />
                </View>
              </View>
            )}

            {/* Error Message inside Modal */}
            {forgotPasswordError ? (
              <Text style={{ color: '#F34D4D', fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 12, width: '100%', paddingHorizontal: 10 }}>
                {forgotPasswordError}
              </Text>
            ) : null}

            {/* Action Buttons */}
            <View style={{ width: '100%', alignItems: 'center', gap: 10 }}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  pressed && { opacity: 0.85 },
                  { width: '100%' }
                ]}
                onPress={forgotPasswordStep === 1 ? handleSendForgotPasswordOTP : handleResetForgotPassword}
                disabled={forgotPasswordLoading}
              >
                {forgotPasswordLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonText}>
                    {forgotPasswordStep === 1 ? 'Send OTP' : 'Reset Password'}
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  { paddingVertical: 10, width: '100%', alignItems: 'center' },
                  pressed && { opacity: 0.7 }
                ]}
                onPress={handleCloseForgotPasswordModal}
              >
                <Text style={{ color: '#7E7C77', fontWeight: 'bold', fontSize: 14 }}>
                  Cancel
                </Text>
              </Pressable>
            </View>
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
            {/* Full Name Input (Sign Up Only) */}
            {isSignUp && (
              <View style={[styles.inputPill, styles.shadow]}>
                <Feather name="user" size={18} color="#9C9C9C" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="#9C9C9C"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}

            {/* Mobile Number Input */}
            <View style={[styles.inputPill, styles.shadow]}>
              <Feather name="phone" size={18} color="#9C9C9C" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Mobile number"
                placeholderTextColor="#9C9C9C"
                keyboardType="phone-pad"
                value={mobile}
                onChangeText={(text) => setMobile(text.replace(/[^0-9]/g, ''))}
                maxLength={10}
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
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                <Feather name={showPassword ? "eye" : "eye-off"} size={18} color="#E05A47" />
              </TouchableOpacity>
            </View>

            {/* Confirm Password Input (Sign Up Only) */}
            {isSignUp && (
              <View style={[styles.inputPill, styles.shadow]}>
                <Feather name="lock" size={18} color="#E05A47" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: '#E05A47' }]}
                  placeholder="Confirm Password"
                  placeholderTextColor="#E05A47"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                />
              </View>
            )}



            {/* Sign Up / Login / Forgot Password Toggle Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              {!isSignUp && (
                <TouchableOpacity
                  onPress={() => {
                    setForgotPasswordStep(1);
                    setForgotPasswordPhone(mobile); // Prefill if they typed a mobile number
                    setForgotPasswordOtp('');
                    setForgotPasswordConfirmResult(null);
                    setForgotPasswordNewPassword('');
                    setForgotPasswordConfirmPassword('');
                    setForgotPasswordError('');
                    setShowForgotPasswordModal(true);
                  }}
                  style={{ paddingVertical: 4 }}
                >
                  <Text style={{ color: '#000000', fontWeight: '700', fontSize: 13 }}>
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                onPress={() => setIsSignUp(!isSignUp)}
                style={{ paddingVertical: 4, flex: 1, alignItems: 'flex-end' }}
              >
                <Text style={{ color: '#000000', fontWeight: 'bold', fontSize: 13 }}>
                  {isSignUp ? 'Already have an account? Login' : 'Create an Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Login / Sign Up Button */}
          <TouchableOpacity
            style={[styles.buttonPill, styles.shadow]}
            onPress={isSignUp ? handleSignUp : handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.buttonText}>{isSignUp ? 'Sign Up' : 'Login'}</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', width: '85%', marginVertical: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#7E7C77' }} />
            <Text style={{ marginHorizontal: 12, color: '#7E7C77', fontSize: 13, fontWeight: '700' }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#7E7C77' }} />
          </View>

          {/* Google Login Button */}
          <TouchableOpacity
            style={[
              styles.buttonPill,
              styles.shadow,
              {
                backgroundColor: '#FFFFFF',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 30,
              }
            ]}
            onPress={handleGoogleLogin}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <>
                <FontAwesome name="google" size={18} color="#DB4437" />
                <Text style={[styles.buttonText, { fontSize: 16 }]}>
                  {isSignUp ? 'Sign up with Google' : 'Continue with Google'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
