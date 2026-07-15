import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoadingView from '../components/LoadingView';
import { API_URL } from '../config';

export default function Index() {
  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasActiveOrder, setHasActiveOrder] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
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
          setIsLoggedIn(true);
          
          // Check if there is an active order
          try {
            const response = await fetch(`${API_URL}/orderstatus/user/${userid}`);
            const data = await response.json();
            if (response.ok && data.success && data.orderStatus) {
              setHasActiveOrder(true);
            }
          } catch (orderErr) {
            console.warn('Error checking active order on startup:', orderErr);
          }
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

  if (!isLoggedIn) {
    return <Redirect href="/login" />;
  }

  return hasActiveOrder ? <Redirect href="/orderstatus" /> : <Redirect href="/restaurentlist" />;
}
