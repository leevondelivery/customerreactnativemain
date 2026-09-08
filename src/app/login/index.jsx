import { Feather, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import LoadingView from '../../components/LoadingView';
import { API_URL, CONTACT_INFO } from '../../config';
import { styles } from '../../styles/login.styles';
// Native-only modules: lazily required to avoid crashes when not linked
let GoogleSignin = null;
let statusCodes = null;
let auth = null;
let GoogleAuthProvider = null;
if (Platform.OS !== 'web') {
  try {
    const googleSigninModule = require('@react-native-google-signin/google-signin');
    GoogleSignin = googleSigninModule.GoogleSignin;
    statusCodes = googleSigninModule.statusCodes;
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
  const [email, setEmail] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

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
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Signup OTP Modal States
  const [showSignupOtpModal, setShowSignupOtpModal] = useState(false);
  const [signupOtp, setSignupOtp] = useState('');
  const [signupConfirmResult, setSignupConfirmResult] = useState(null);
  const [signupOtpLoading, setSignupOtpLoading] = useState(false);
  const [signupOtpError, setSignupOtpError] = useState('');
  const [signupResendTimer, setSignupResendTimer] = useState(0);
  const otpInputRef = useRef(null);

  useEffect(() => {
    let interval = null;
    if (showSignupOtpModal && signupResendTimer > 0) {
      interval = setInterval(() => {
        setSignupResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showSignupOtpModal, signupResendTimer]);

  useEffect(() => {
    if (showSignupOtpModal) {
      const timer = setTimeout(() => {
        otpInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [showSignupOtpModal]);

  const handleResendSignupOTP = async () => {
    if (signupResendTimer > 0) return;
    setSignupOtpError('');
    setSignupResendTimer(30);
    const cleanPhone = mobile.trim().replace(/\D/g, '').slice(-10);
    const formattedPhone = `+91${cleanPhone}`;
    console.log(`[Signup OTP] Resending Firebase SMS OTP for: ${formattedPhone}`);
    try {
      if (auth && typeof auth === 'function') {
        const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
        setSignupConfirmResult(confirmation);
      } else {
        throw new Error('Firebase Auth service unavailable');
      }
    } catch (otpErr) {
      console.error('[Signup OTP] Firebase SMS resend failed:', otpErr);
      setSignupConfirmResult(null);
      setSignupOtpError(otpErr.message || 'Failed to resend OTP via Firebase. Please try again.');
    }
  };


  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      if (!GoogleSignin) {
        throw new Error('Google Sign-in native module is not available on this device or build.');
      }

      try {
        GoogleSignin.configure({
          webClientId: '549037342596-kkd837btqfu8dfprgtupmpprmiarc5e7.apps.googleusercontent.com',
          offlineAccess: true,
        });
      } catch (configErr) {
        console.warn('[Google Login] Configure warning:', configErr);
      }

      console.log('[Google Login] Checking play services...');
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      console.log('[Google Login] Requesting user account...');
      // Sign out from any existing session first to force the Google Account Chooser
      try {
        await GoogleSignin.signOut();
      } catch (signOutError) {
        console.log('[Google Login] Error signing out before sign in:', signOutError);
      }

      const signInResponse = await GoogleSignin.signIn();
      console.log('[Google Login] Sign in response received:', signInResponse);

      let idToken = signInResponse?.data?.idToken || signInResponse?.idToken;
      let accessToken = signInResponse?.data?.accessToken || signInResponse?.accessToken;

      if (!idToken || !accessToken) {
        try {
          console.log('[Google Login] Fetching tokens from Google Play Services...');
          const tokens = await GoogleSignin.getTokens();
          idToken = idToken || tokens?.idToken;
          accessToken = accessToken || tokens?.accessToken;
        } catch (tokenErr) {
          console.warn('[Google Login] Error fetching tokens via getTokens():', tokenErr);
        }
      }

      if (!idToken) {
        console.log('[Google Login] No ID token retrieved (sign-in cancelled or dismissed by user).');
        return;
      }

      console.log('[Google Login] Firebase authenticating credential...');
      if (!GoogleAuthProvider || typeof auth !== 'function') {
        throw new Error('Firebase Auth service is not available on this device.');
      }

      const googleCredential = accessToken 
        ? GoogleAuthProvider.credential(idToken, accessToken)
        : GoogleAuthProvider.credential(idToken);
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

      let data = {};
      try {
        data = await response.json();
      } catch (parseErr) {
        throw new Error('Server returned an invalid response. Please try again later.');
      }

      console.log('[Google Login] Backend response:', data);

      if (response.ok && data.success && data.user) {
        const user = data.user;
        const logintime = String(Date.now());

        const rawUserId = user._id || user.id || user.userId || '';
        await AsyncStorage.setItem('userid', String(rawUserId));
        await AsyncStorage.setItem('phone', String(user.phone ?? 'N/A'));
        await AsyncStorage.setItem('isPhoneVerified', String(user.isPhoneVerified ?? 'false'));

        // Use user.name from backend, fallback to firebase displayName, fallback to 'N/A'
        const rawBackendName = typeof user.name === 'string' ? user.name : String(user.name || '');
        const rawFirebaseName = userCredential.user?.displayName ? String(userCredential.user.displayName) : '';

        const displayName = rawBackendName && rawBackendName.toLowerCase() !== 'n/a'
          ? rawBackendName
          : (rawFirebaseName && rawFirebaseName.toLowerCase() !== 'n/a'
            ? rawFirebaseName
            : 'N/A');
        await AsyncStorage.setItem('name', String(displayName));

        // Use user.email from backend, fallback to firebase email, fallback to 'N/A'
        const rawBackendEmail = typeof user.email === 'string' ? user.email : String(user.email || '');
        const rawFirebaseEmail = userCredential.user?.email ? String(userCredential.user.email) : '';

        const displayEmail = rawBackendEmail && rawBackendEmail.toLowerCase() !== 'n/a'
          ? rawBackendEmail
          : (rawFirebaseEmail && rawFirebaseEmail.toLowerCase() !== 'n/a'
            ? rawFirebaseEmail
            : 'N/A');
        await AsyncStorage.setItem('email', String(displayEmail));
        await AsyncStorage.setItem('logintime', logintime);
        await AsyncStorage.setItem('loginType', 'google');
        await AsyncStorage.setItem('coins', String(user.coins ?? 0));
        await AsyncStorage.setItem('dateOfBirth', String(user.dateOfBirth ?? ''));

        // Pre-fetch active order status flag so tracker tab is ready on login
        if (rawUserId) {
          try {
            const orderRes = await fetch(`${API_URL}/orderstatus/user/${rawUserId}`);
            if (orderRes.ok) {
              const orderData = await orderRes.json();
              if (orderData.success && orderData.orderStatus) {
                const sStr = (orderData.orderStatus.status || orderData.orderStatus.orderStatus || '').toLowerCase().trim();
                const isRej = sStr.includes('reject') || sStr.includes('cancel') || sStr.includes('declin') || sStr.includes('failed');
                if (!isRej) {
                  await AsyncStorage.setItem(`has_active_order_${rawUserId}`, 'true');
                  await AsyncStorage.setItem(`active_order_data_${rawUserId}`, JSON.stringify(orderData.orderStatus));
                } else {
                  await AsyncStorage.setItem(`has_active_order_${rawUserId}`, 'false');
                  await AsyncStorage.removeItem(`active_order_data_${rawUserId}`);
                }
              } else {
                await AsyncStorage.setItem(`has_active_order_${rawUserId}`, 'false');
                await AsyncStorage.removeItem(`active_order_data_${rawUserId}`);
              }
            }
          } catch (e) {}
        }

        router.replace('/restaurentlist');
      } else {
        setErrorMessage(data.message || 'Failed to sync account with backend.');
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('[Google Login] Flow error:', error);

      const isCancelled =
        error?.code === '12501' ||
        error?.code === statusCodes?.SIGN_IN_CANCELLED ||
        error?.code === 'SIGN_IN_CANCELLED' ||
        (error?.message && (
          error.message.toLowerCase().includes('cancel') ||
          error.message.toLowerCase().includes('dismiss') ||
          error.message.toLowerCase().includes('12501') ||
          error.message.toLowerCase().includes('sign_in_cancelled') ||
          error.message.toLowerCase().includes('user canceled') ||
          error.message.toLowerCase().includes('user cancelled')
        ));

      if (isCancelled) {
        console.log('[Google Login] Google Sign-In was cancelled by the user.');
        return;
      }

      const detail = error.message || error.code || JSON.stringify(error);
      setErrorMessage(`Google Sign-in failed: ${detail}`);
      setShowErrorModal(true);
    } finally {
      setGoogleLoading(false);
    }
  };

 
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        // Daily Fields Verification (Once per day when the app starts)
        const todayStr = new Date().toDateString();
        const lastCheckStr = await AsyncStorage.getItem('lastDailyFieldsCheck');

        if (lastCheckStr !== todayStr) {
          const storedUserId = await AsyncStorage.getItem('userid');
          if (storedUserId) {
            const logintime = await AsyncStorage.getItem('logintime');

            if (!logintime) {
              console.log('[Session] Daily check: Required logintime missing. Clearing storage.');
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
          try {
            const userRes = await fetch(`${API_URL}/user/${userid}`);
            const userData = await userRes.json();
            if (
              userRes.status === 403 ||
              userData.isBlocked ||
              (userData.user && (userData.user.isBlocked || userData.user.blickstatus === false || userData.user.status === 'blocked'))
            ) {
              console.warn('[Login] Stored session user is blocked by admin. Clearing credentials.');
              await AsyncStorage.clear();
              setErrorMessage(userData.message || 'Your account has been blocked by admin. Please contact support.');
              setShowErrorModal(true);
              return;
            }
          } catch (e) {
            console.warn('[Login] Check user status on startup error:', e.message);
          }
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
        body: JSON.stringify({ phone: mobile.trim(), email: mobile.trim(), identifier: mobile.trim(), password }),
      });

      const data = await response.json();
      console.log('Login response:', data);

      if (response.ok && data.success) {
        const user = data.user;
        const logintime = String(Date.now());

        // Save session in AsyncStorage
        const rawUserId = user._id || user.id || user.userId || '';
        await AsyncStorage.setItem('userid', String(rawUserId));
        await AsyncStorage.setItem('phone', String(user.phone || 'N/A'));
        await AsyncStorage.setItem('isPhoneVerified', String(user.isPhoneVerified ?? 'false'));
        await AsyncStorage.setItem('name', String(user.name || 'N/A'));
        await AsyncStorage.setItem('email', String(user.email || 'N/A'));
        await AsyncStorage.setItem('logintime', logintime);
        await AsyncStorage.setItem('loginType', 'phone');
        await AsyncStorage.setItem('coins', String(user.coins ?? 0));
        await AsyncStorage.setItem('dateOfBirth', String(user.dateOfBirth ?? ''));

        // Pre-fetch active order status flag so tracker tab is ready on login
        if (rawUserId) {
          try {
            const orderRes = await fetch(`${API_URL}/orderstatus/user/${rawUserId}`);
            if (orderRes.ok) {
              const orderData = await orderRes.json();
              if (orderData.success && orderData.orderStatus) {
                const sStr = (orderData.orderStatus.status || orderData.orderStatus.orderStatus || '').toLowerCase().trim();
                const isRej = sStr.includes('reject') || sStr.includes('cancel') || sStr.includes('declin') || sStr.includes('failed');
                if (!isRej) {
                  await AsyncStorage.setItem(`has_active_order_${rawUserId}`, 'true');
                  await AsyncStorage.setItem(`active_order_data_${rawUserId}`, JSON.stringify(orderData.orderStatus));
                } else {
                  await AsyncStorage.setItem(`has_active_order_${rawUserId}`, 'false');
                  await AsyncStorage.removeItem(`active_order_data_${rawUserId}`);
                }
              } else {
                await AsyncStorage.setItem(`has_active_order_${rawUserId}`, 'false');
                await AsyncStorage.removeItem(`active_order_data_${rawUserId}`);
              }
            }
          } catch (e) {}
        }

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
    if (!mobile || !password || !confirmPassword || !name || !email) {
      setErrorMessage('Please fill in all fields');
      setShowErrorModal(true);
      return;
    }

    if (!acceptedTerms) {
      setErrorMessage('Please accept the Privacy Policy and Terms & Conditions to create an account.');
      setShowErrorModal(true);
      return;
    }

    const cleanPhone = mobile.trim().replace(/\D/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number');
      setShowErrorModal(true);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address');
      setShowErrorModal(true);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      setShowErrorModal(true);
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long');
      setShowErrorModal(true);
      return;
    }

    setLoading(true);
    try {
      // 1. Pre-check if phone number already exists in DB
      console.log(`Checking if phone exists: ${API_URL}/check-phone/${cleanPhone}`);
      const checkResponse = await fetch(`${API_URL}/check-phone/${cleanPhone}`);
      const checkData = await checkResponse.json();
      if (checkResponse.ok && checkData.success && checkData.exists) {
        setErrorMessage('An account with this phone number already exists. Please log in or reset password.');
        setShowErrorModal(true);
        setLoading(false);
        return;
      }

      // 2. Trigger Firebase SMS OTP
      const formattedPhone = `+91${cleanPhone}`;
      console.log(`[Signup OTP] Triggering Firebase SMS OTP for: ${formattedPhone}`);

      try {
        if (auth && typeof auth === 'function') {
          const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
          setSignupConfirmResult(confirmation);
          setSignupOtp('');
          setSignupOtpError('');
          setSignupResendTimer(30);
          setShowSignupOtpModal(true);
        } else {
          throw new Error('Firebase Auth service unavailable');
        }
      } catch (otpErr) {
        console.error('[Signup OTP] Firebase SMS failed:', otpErr);
        setSignupConfirmResult(null);
        setErrorMessage(otpErr.message || 'Failed to send SMS verification code via Firebase. Please verify your phone number and try again.');
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Signup pre-check error:', error);
      setErrorMessage('Could not connect to backend server. Make sure the server is running.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySignupOTP = async () => {
    setSignupOtpError('');
    if (!signupOtp || signupOtp.trim().length < 4) {
      setSignupOtpError('Please enter a valid OTP code');
      return;
    }

    if (!signupConfirmResult) {
      setSignupOtpError('Verification session expired or invalid. Please click Resend OTP.');
      return;
    }

    const cleanPhone = mobile.trim().replace(/\D/g, '').slice(-10);
    setSignupOtpLoading(true);

    try {
      console.log('[Signup OTP] Confirming Firebase OTP code:', signupOtp);
      await signupConfirmResult.confirm(signupOtp.trim());
      console.log('[Signup OTP] Phone number verified successfully via SMS!');

      console.log(`[Signup] Registering account in MongoDB at: ${API_URL}/signup`);
      const response = await fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          password,
          name: name.trim(),
          email: email.trim(),
          isPhoneVerified: true,
          termsAccepted: true,
          termsAcceptedAt: new Date().toISOString()
        }),
      });

      const data = await response.json();
      console.log('Signup response:', data);

      if (response.ok && data.success) {
        const user = data.user;
        const logintime = String(Date.now());
        const rawUserId = user._id || user.id || user.userId || '';

        await AsyncStorage.setItem('userid', String(rawUserId));
        await AsyncStorage.setItem('phone', String(user.phone || cleanPhone));
        await AsyncStorage.setItem('isPhoneVerified', 'true');
        await AsyncStorage.setItem('name', String(user.name || name.trim()));
        await AsyncStorage.setItem('email', String(user.email || email.trim()));
        await AsyncStorage.setItem('logintime', logintime);
        await AsyncStorage.setItem('loginType', 'phone');
        await AsyncStorage.setItem('coins', String(user.coins ?? 0));
        await AsyncStorage.setItem('dateOfBirth', String(user.dateOfBirth ?? ''));

        setShowSignupOtpModal(false);
        setPassword('');
        setConfirmPassword('');
        setName('');
        setEmail('');
        setAcceptedTerms(false);
        setIsSignUp(false);

        router.replace('/restaurentlist');
      } else {
        setSignupOtpError(data.message || 'Signup failed. Please try again.');
      }
    } catch (error) {
      console.error('[Signup OTP] Verification error:', error);
      if (error.code === 'auth/invalid-verification-code' || error.code === 'auth/invalid-code') {
        setSignupOtpError('Invalid OTP code. Please enter the exact 6-digit code received via SMS.');
      } else {
        setSignupOtpError(error.message || 'Failed to verify OTP or complete registration.');
      }
    } finally {
      setSignupOtpLoading(false);
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

      // User exists, attempt Firebase SMS OTP
      const formattedPhone = `+91${forgotPasswordPhone.trim().slice(-10)}`;
      console.log(`[Forgot Password] Triggering Firebase OTP for: ${formattedPhone}`);
      
      try {
        const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
        setForgotPasswordConfirmResult(confirmation);
        setForgotPasswordStep(2);
      } catch (otpErr) {
        console.error('[Forgot Password] Firebase SMS OTP failed:', otpErr);
        setForgotPasswordConfirmResult(null);
        setForgotPasswordError(otpErr.message || 'Failed to send SMS verification code via Firebase. Please check your number.');
      }
    } catch (error) {
      console.error('[Forgot Password] Check phone request error:', error);
      setForgotPasswordError('Failed to verify phone number. Please try again.');
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

    if (forgotPasswordNewPassword.length < 6) {
      setForgotPasswordError('New password must be at least 6 characters long');
      return;
    }

    if (!forgotPasswordConfirmResult) {
      setForgotPasswordError('Verification session expired or invalid. Please request a new OTP.');
      return;
    }

    setForgotPasswordLoading(true);
    try {
      console.log('[Forgot Password] Confirming Firebase OTP code:', forgotPasswordOtp);
      await forgotPasswordConfirmResult.confirm(forgotPasswordOtp.trim());
      console.log('[Forgot Password] Firebase OTP verified successfully!');

      console.log('[Forgot Password] Resetting password in backend...');
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
      if (error.code === 'auth/invalid-verification-code' || error.code === 'auth/invalid-code') {
        setForgotPasswordError('Invalid OTP code. Please check the code received via SMS and try again.');
      } else {
        setForgotPasswordError(error.message || 'Failed to verify OTP or reset password. Please try again.');
      }
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleCloseSignupOtpModal = useCallback(() => {
    Keyboard.dismiss();
    otpInputRef.current?.blur();
    setShowSignupOtpModal(false);
    setSignupOtp('');
    setSignupOtpError('');
  }, []);

  const handleCloseForgotPasswordModal = useCallback(() => {
    Keyboard.dismiss();
    setShowForgotPasswordModal(false);
    setForgotPasswordPhone('');
    setForgotPasswordOtp('');
    setForgotPasswordConfirmResult(null);
    setForgotPasswordNewPassword('');
    setForgotPasswordConfirmPassword('');
    setForgotPasswordStep(1);
    setForgotPasswordError('');
  }, []);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (showSignupOtpModal) {
          handleCloseSignupOtpModal();
          return true;
        }
        if (showForgotPasswordModal) {
          handleCloseForgotPasswordModal();
          return true;
        }
        if (showSupportModal) {
          Keyboard.dismiss();
          setShowSupportModal(false);
          return true;
        }
        if (showErrorModal) {
          Keyboard.dismiss();
          setShowErrorModal(false);
          return true;
        }
        if (isSignUp) {
          Keyboard.dismiss();
          setIsSignUp(false);
          return true;
        }
        BackHandler.exitApp();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [
      showSignupOtpModal,
      showForgotPasswordModal,
      showSupportModal,
      showErrorModal,
      isSignUp,
      handleCloseSignupOtpModal,
      handleCloseForgotPasswordModal,
    ])
  );

  if (checkingAuth || loading || googleLoading) {
    return <LoadingView />;
  }

  return (
    <View style={styles.container}>
      {/* Root Split Background */}
      <View style={styles.leftBg} />
      <View style={styles.rightBg} />

      {/* Signup OTP Verification Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSignupOtpModal}
        onRequestClose={handleCloseSignupOtpModal}
        onShow={() => {
          setTimeout(() => {
            otpInputRef.current?.focus();
          }, 150);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.otpModalCard}>
            {/* Top Close Button */}
            <TouchableOpacity
              style={styles.otpCloseIconButton}
              onPress={() => setShowSignupOtpModal(false)}
              activeOpacity={0.7}
            >
              <Feather name="x" size={18} color="#555555" />
            </TouchableOpacity>

            {/* Shield Icon Badge */}
            <View style={styles.otpIconBadge}>
              <Feather name="shield" size={30} color="#000000" />
            </View>

            {/* Modal Title */}
            <Text style={styles.otpModalTitle}>Verify Phone Number</Text>

            {/* Subtitle with mobile */}
            <Text style={styles.otpModalSubtitle}>
              Enter the 6-digit OTP sent to{'\n'}
              <Text style={styles.otpMobileHighlight}>+91 {mobile}</Text>
            </Text>

            {/* 6 Digit Visual OTP Boxes */}
            <View style={styles.otpWrapper}>
              <View
                style={styles.otpBoxesContainer}
                pointerEvents="none"
              >
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const char = (signupOtp || '')[idx] || '';
                  const isCurrent = (signupOtp || '').length === idx;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.otpBox,
                        char ? styles.otpBoxFilled : null,
                        isCurrent ? styles.otpBoxActive : null,
                      ]}
                    >
                      <Text style={styles.otpBoxChar}>{char}</Text>
                    </View>
                  );
                })}
              </View>
              <TextInput
                ref={otpInputRef}
                style={styles.otpInvisibleInput}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                value={signupOtp}
                onChangeText={(text) => {
                  setSignupOtp(text.replace(/[^0-9]/g, '').slice(0, 6));
                  if (signupOtpError) setSignupOtpError('');
                }}
                maxLength={6}
                autoFocus={true}
                caretHidden={true}
                cursorColor="transparent"
                selectionColor="transparent"
              />
            </View>

            {/* Error Message */}
            {signupOtpError ? (
              <View style={styles.otpErrorContainer}>
                <Feather name="alert-circle" size={14} color="#E05A47" style={{ marginRight: 6 }} />
                <Text style={styles.otpErrorText}>{signupOtpError}</Text>
              </View>
            ) : null}

            {/* Verify & Create Account Button */}
            <TouchableOpacity
              style={[
                styles.otpVerifyButton,
                styles.shadow,
                (!signupOtp || signupOtp.length < 4) && { opacity: 0.7 }
              ]}
              onPress={handleVerifySignupOTP}
              disabled={signupOtpLoading}
              activeOpacity={0.85}
            >
              {signupOtpLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.otpVerifyButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Resend OTP Row */}
            <View style={styles.otpResendRow}>
              <Text style={styles.otpResendLabel}>{"Didn't receive code? "}</Text>
              <TouchableOpacity
                onPress={handleResendSignupOTP}
                disabled={signupResendTimer > 0 || signupOtpLoading}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.otpResendButtonText,
                  signupResendTimer > 0 && styles.otpResendDisabledText
                ]}>
                  {signupResendTimer > 0 ? `Resend in ${signupResendTimer}s` : 'Resend OTP'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

      {/* Customer Support Card Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSupportModal}
        onRequestClose={() => setShowSupportModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.supportModalCard}>
            {/* Header with Title & X Close Button */}
            <View style={styles.supportHeaderRow}>
              <View style={styles.supportTitleContainer}>
                <Feather name="headphones" size={20} color="#E05A47" />
                <Text style={styles.supportTitleText}>Customer Support</Text>
              </View>
              <TouchableOpacity
                style={styles.supportCloseIconButton}
                onPress={() => setShowSupportModal(false)}
                activeOpacity={0.7}
              >
                <Feather name="x" size={18} color="#555555" />
              </TouchableOpacity>
            </View>

            <Text style={styles.supportSubText}>
              Have questions or need help logging in? Reach out to our support team directly.
            </Text>

            {/* Support Options */}
            <View style={styles.supportOptionsContainer}>
              {/* Phone Support */}
              <View style={styles.supportOptionCard}>
                <View style={styles.supportOptionLeft}>
                  <View style={[styles.supportIconCircle, { backgroundColor: '#E8F5E9' }]}>
                    <Feather name="phone-call" size={18} color="#2E7D32" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.supportOptionLabel}>PHONE SUPPORT</Text>
                    <Text style={styles.supportOptionValue}>{CONTACT_INFO.displayPhone}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.supportCallButton}
                  onPress={() => Linking.openURL(`tel:${CONTACT_INFO.phone}`)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.supportCallButtonText}>Call</Text>
                </TouchableOpacity>
              </View>

              {/* Email Support */}
              <View style={styles.supportOptionCard}>
                <View style={styles.supportOptionLeft}>
                  <View style={[styles.supportIconCircle, { backgroundColor: '#E3F2FD' }]}>
                    <Feather name="mail" size={18} color="#1877F2" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.supportOptionLabel}>EMAIL SUPPORT</Text>
                    <Text style={styles.supportOptionValue} numberOfLines={1}>
                      {CONTACT_INFO.email}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.supportEmailButton}
                  onPress={() => Linking.openURL(`mailto:${CONTACT_INFO.email}`)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.supportEmailButtonText}>Email</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* OK Close Button */}
            <Pressable
              style={({ pressed }) => [
                styles.supportOkButton,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setShowSupportModal(false)}
            >
              <Text style={styles.supportOkButtonText}>OK</Text>
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
                  Enter the OTP sent to your number and choose a new password
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

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, paddingVertical: 4 }}
                onPress={() => setShowSupportModal(true)}
                activeOpacity={0.7}
              >
                <Feather name="headphones" size={14} color="#E05A47" />
                <Text style={{ color: '#E05A47', fontWeight: 'bold', fontSize: 13 }}>
                  Need Support?
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlayContainer}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Logo Pill Card with Company Logo */}
          <View style={[styles.brandCard, styles.shadow]}>
            <Image
              source={require('../../../assets/images/company-logo.png')}
              style={styles.brandLogoImage}
              resizeMode="contain"
            />
            <Text style={styles.brandText}>Leevon Delivery</Text>
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

            {/* Email Address Input (Sign Up Only) */}
            {isSignUp && (
              <View style={[styles.inputPill, styles.shadow]}>
                <Feather name="mail" size={18} color="#9C9C9C" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="#9C9C9C"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
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

            {/* Terms and Conditions & Privacy Policy Acceptance Checkbox (Sign Up Only) */}
            {isSignUp && (
              <View style={styles.termsContainer}>
                <TouchableOpacity
                  style={styles.checkboxTouchable}
                  onPress={() => setAcceptedTerms(!acceptedTerms)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkboxBox, acceptedTerms && styles.checkboxBoxChecked]}>
                    {acceptedTerms && <Feather name="check" size={14} color="#FFFFFF" />}
                  </View>
                </TouchableOpacity>
                <View style={styles.termsTextContainer}>
                  <Text style={styles.termsText}>I agree to the </Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://leevon-delivery.vercel.app/privacy').catch(err => console.error('Failed to open Privacy Policy URL:', err))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.termsLink}>Privacy Policy</Text>
                  </TouchableOpacity>
                  <Text style={styles.termsText}> and </Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://tandccustomer.vercel.app/').catch(err => console.error('Failed to open Terms URL:', err))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.termsLink}>Terms & Conditions</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}



            {/* Sign Up / Login / Forgot Password Toggle Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 2 }}>
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
                  style={{ paddingVertical: 6 }}
                >
                  <Text style={{ color: '#000000', fontWeight: '700', fontSize: 13 }}>
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => setIsSignUp(!isSignUp)}
                style={{ paddingVertical: 6, marginLeft: 'auto' }}
              >
                <Text style={{ color: '#000000', fontWeight: 'bold', fontSize: 13 }}>
                  {isSignUp ? 'Already have an account? Login' : 'Create Account'}
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
              <Text style={styles.buttonText}>
                {isSignUp ? 'Create Account' : 'Login'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', width: '85%', marginVertical: 4 }}>
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
                gap: 10,
                paddingHorizontal: 24,
                paddingVertical: 12,
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
                <Text style={[styles.buttonText, { fontSize: 15 }]}>
                  {isSignUp ? 'Sign up with Google' : 'Continue with Google'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Need Support Button */}
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 6,
              marginBottom: 4,
              paddingVertical: 6,
              paddingHorizontal: 16,
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              borderRadius: 20,
            }}
            onPress={() => setShowSupportModal(true)}
            activeOpacity={0.75}
          >
            <Feather name="headphones" size={16} color="#000000" />
            <Text style={{ color: '#000000', fontWeight: 'bold', fontSize: 13 }}>
              Need Support?
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
