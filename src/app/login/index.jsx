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
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth, { GoogleAuthProvider } from '@react-native-firebase/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Custom Alert States
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
        const logintime = new Date().toLocaleString();

        // Save session in AsyncStorage
        await AsyncStorage.setItem('userid', user._id || 'N/A');
        await AsyncStorage.setItem('phone', user.phone || 'N/A');
        
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

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', width: '85%', marginVertical: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#DCD3C5' }} />
            <Text style={{ marginHorizontal: 12, color: '#7E7C77', fontSize: 13, fontWeight: '700' }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#DCD3C5' }} />
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
                <Text style={[styles.buttonText, { fontSize: 16 }]}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
