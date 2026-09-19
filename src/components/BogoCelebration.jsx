import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONFETTI_COLORS = [
  '#FF3B30', // Vibrant Red
  '#FF9500', // Orange
  '#FFCC00', // Gold
  '#34C759', // Green
  '#00C853', // Emerald
  '#007AFF', // Blue
  '#5856D6', // Purple
  '#AF52DE', // Violet
  '#FF2D55', // Pink
  '#00E5FF', // Cyan
];

const NUM_CONFETTI = 36;

export default function BogoCelebration({ visible, offerDetails, onDismiss }) {
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Generate confetti particle animations once
  const confettiParticles = useRef(
    Array.from({ length: NUM_CONFETTI }, (_, i) => {
      const angle = (Math.PI * 2 * i) / NUM_CONFETTI + (Math.random() * 0.4 - 0.2);
      const velocity = 180 + Math.random() * 260;
      const startX = SCREEN_WIDTH / 2 + (Math.random() * 80 - 40);
      const startY = SCREEN_HEIGHT * 0.42 + (Math.random() * 60 - 30);
      const endX = startX + Math.cos(angle) * velocity;
      const endY = startY + Math.sin(angle) * velocity + 150; // gravity drift downward
      const rotationStart = Math.random() * 360;
      const rotationEnd = rotationStart + 360 + Math.random() * 720;
      const size = 6 + Math.random() * 6;
      const isCircle = i % 3 === 0;
      const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];

      return {
        id: i,
        startX,
        startY,
        endX,
        endY,
        rotationStart,
        rotationEnd,
        size,
        isCircle,
        color,
        progress: new Animated.Value(0),
      };
    })
  ).current;

  useEffect(() => {
    if (!visible) return;

    // 1. Reset all animation values
    bannerAnim.setValue(0);
    pulseAnim.setValue(1);
    confettiParticles.forEach((p) => p.progress.setValue(0));

    // 2. Banner Spring In
    const bannerSpring = Animated.spring(bannerAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    });

    // 3. Pulse loop for gift/sparkle icon
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // 4. Confetti burst animation
    const confettiAnims = confettiParticles.map((p, idx) =>
      Animated.timing(p.progress, {
        toValue: 1,
        duration: 1600 + (idx % 5) * 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );

    Animated.parallel([bannerSpring, ...confettiAnims]).start();

    // 5. Auto-dismiss after 2.6 seconds
    const timer = setTimeout(() => {
      Animated.timing(bannerAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        pulseLoop.stop();
        if (onDismiss) onDismiss();
      });
    }, 2600);

    return () => {
      clearTimeout(timer);
      pulseLoop.stop();
    };
  }, [visible, offerDetails?.triggerId, offerDetails?.itemName]);

  if (!visible) return null;

  const isCrossItem =
    offerDetails?.bogoOffer?.type === 'item' &&
    offerDetails?.bogoOffer?.targetItemName &&
    offerDetails?.bogoOffer?.targetItemName.toLowerCase() !==
      (offerDetails?.itemName || '').toLowerCase();

  const titleText =
    offerDetails?.customTitle ||
    (isCrossItem
      ? 'FREE ITEM UNLOCKED!'
      : offerDetails?.type === 'discount' || offerDetails?.type === 'tiered'
      ? 'DISCOUNT UNLOCKED!'
      : offerDetails?.type === 'coupon'
      ? 'COUPON APPLIED!'
      : '1+1 FREE UNLOCKED!');

  const subText =
    offerDetails?.customSubtext ||
    (isCrossItem
      ? `+1 Free ${offerDetails?.bogoOffer?.targetItemName} added to your cart!`
      : `Buy 1 Get 1 Free offer applied to ${offerDetails?.itemName || 'this dish'}!`);

  return (
    <View style={styles.overlayContainer} pointerEvents="none">
      {/* Confetti Particles */}
      {confettiParticles.map((p) => {
        const translateX = p.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [p.startX - SCREEN_WIDTH / 2, p.endX - SCREEN_WIDTH / 2],
        });
        const translateY = p.progress.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [p.startY - SCREEN_HEIGHT / 2, (p.startY + p.endY) / 2 - SCREEN_HEIGHT / 2 - 40, p.endY - SCREEN_HEIGHT / 2],
        });
        const rotate = p.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [`${p.rotationStart}deg`, `${p.rotationEnd}deg`],
        });
        const opacity = p.progress.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [1, 0.9, 0],
        });
        const scale = p.progress.interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [0.3, 1.2, 0.8],
        });

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.confettiPiece,
              {
                left: SCREEN_WIDTH / 2,
                top: SCREEN_HEIGHT / 2,
                width: p.size,
                height: p.isCircle ? p.size : p.size * 1.6,
                borderRadius: p.isCircle ? p.size / 2 : 2,
                backgroundColor: p.color,
                opacity,
                transform: [
                  { translateX },
                  { translateY },
                  { rotate },
                  { scale },
                ],
              },
            ]}
          />
        );
      })}

      {/* Floating Celebration Card */}
      <Animated.View
        style={[
          styles.celebrationCardContainer,
          {
            opacity: bannerAnim,
            transform: [
              {
                translateY: bannerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-80, 0],
                }),
              },
              {
                scale: bannerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.celebrationCard}>
          {/* Glowing Gift / Sparkle Icon */}
          <Animated.View
            style={[
              styles.iconWrapper,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <MaterialCommunityIcons name="party-popper" size={28} color="#FFFFFF" />
          </Animated.View>

          {/* Texts */}
          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.celebrationTitle}>{titleText}</Text>
              <Ionicons name="sparkles" size={16} color="#FFD700" style={{ marginLeft: 6 }} />
            </View>
            <Text style={styles.celebrationSubtext} numberOfLines={2}>
              {subText}
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    elevation: 99999,
    pointerEvents: 'none',
  },
  confettiPiece: {
    position: 'absolute',
    zIndex: 99998,
    elevation: 99998,
  },
  celebrationCardContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  celebrationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F8A65', // Rich Emerald Theme
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    maxWidth: 420,
    width: '100%',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  celebrationTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  celebrationSubtext: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E8F5E9',
    marginTop: 2,
    lineHeight: 16,
  },
});
