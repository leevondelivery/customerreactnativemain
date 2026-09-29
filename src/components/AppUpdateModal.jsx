import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function AppUpdateModal({ visible, updateData }) {
  if (!visible) return null;

  const title = updateData?.title || 'Update Required 🚀';
  const message =
    updateData?.message ||
    'A new version of Leevon Delivery is available! Please download the latest update directly from the Google Play Store to continue using the app.';
  const playStoreUrl =
    updateData?.playStoreUrl ||
    'https://play.google.com/store/apps/details?id=com.leevon.delivery';

  const handleUpdate = async () => {
    const marketUrl = 'market://details?id=com.leevon.delivery';
    const webUrl =
      playStoreUrl || 'https://play.google.com/store/apps/details?id=com.leevon.delivery';

    try {
      if (Platform.OS === 'android') {
        const canOpenMarket = await Linking.canOpenURL(marketUrl);
        if (canOpenMarket) {
          await Linking.openURL(marketUrl);
          return;
        }
      }
      await Linking.openURL(webUrl);
    } catch (err) {
      Linking.openURL(webUrl).catch((e) =>
        console.error('Failed to open Play Store link:', e)
      );
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" statusBarTranslucent={true}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Top Badge Icon */}
          <View style={styles.iconContainer}>
            <MaterialIcons name="system-update" size={38} color="#FFFFFF" />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.updateButton}
            activeOpacity={0.85}
            onPress={handleUpdate}
          >
            <Text style={styles.buttonText}>UPDATE NOW</Text>
            <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#F9F9F6', // Half-white / cream theme background
    borderRadius: 28,
    width: '100%',
    maxWidth: 340,
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
    }),
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E23744', // Premium Brand Red
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#E23744',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  updateButton: {
    backgroundColor: '#E23744',
    borderRadius: 9999,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#E23744',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
