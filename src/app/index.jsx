import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoadingView from '../components/LoadingView';

export default function Index() {
  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const userid = await AsyncStorage.getItem('userid');
        if (userid) {
          setIsLoggedIn(true);
        }
      } catch (e) {
        console.error('Session check error:', e);
      } finally {
        setChecking(false);
      }
    };
    checkSession();
  }, []);

  if (checking) {
    return <LoadingView />;
  }

  return isLoggedIn ? <Redirect href="/restaurentlist" /> : <Redirect href="/login" />;
}
