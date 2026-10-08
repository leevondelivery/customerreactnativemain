import React, { useEffect, useRef, useMemo, useState } from 'react';
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

const NUM_CONFETTI = 18;

const PARTICLE_SEEDS = Array.from({ length: NUM_CONFETTI }, (_, i) => {
  const angle = -(Math.PI * 0.15 + (Math.PI * 0.42 * (i / NUM_CONFETTI))) + (((i * 17) % 16 - 8) * 0.01);
  const velocity = 260 + ((i * 23) % 260);
  const startX = 24 + ((i * 13) % 30 - 15);
  const startY = SCREEN_HEIGHT - (Platform.OS === 'ios' ? 140 : 100) + ((i * 7) % 24 - 12);
  const peakY = startY + Math.sin(angle) * velocity - 35;
  const endX = startX + Math.cos(angle) * velocity;
  const endY = startY + Math.sin(angle) * velocity + 120;
  const rotationStart = (i * 37) % 360;
  const rotationEnd = rotationStart + 360 + ((i * 41) % 540);
  const size = 2.4 + ((i * 11) % 18) / 10;
  const isCircle = i % 3 === 0;
  const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
  return {
    id: i,
    size,
    isCircle,
    color,
    startX,
    endX,
    startY,
    peakY,
    endY,
    rotationStart,
    rotationEnd,
  };
});

export default function BogoCelebration({ visible, offerDetails, onDismiss }) {
  const [bannerAnim] = useState(() => new Animated.Value(0));
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const [confettiProgress] = useState(() => new Animated.Value(0));
  const animRunningRef = useRef(false);

  // Pre-compute fixed interpolation nodes ONCE using static particle seeds
  const particles = useMemo(() => {
    return PARTICLE_SEEDS.map((seed) => ({
      ...seed,
      translateX: confettiProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [seed.startX, seed.endX],
      }),
      translateY: confettiProgress.interpolate({
        inputRange: [0, 0.45, 1],
        outputRange: [seed.startY, seed.peakY, seed.endY],
      }),
      rotate: confettiProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [`${seed.rotationStart}deg`, `${seed.rotationEnd}deg`],
      }),
      opacity: confettiProgress.interpolate({
        inputRange: [0, 0.75, 1],
        outputRange: [1, 0.9, 0],
      }),
      scale: confettiProgress.interpolate({
        inputRange: [0, 0.2, 1],
        outputRange: [0.3, 1.2, 0.8],
      }),
    }));
  }, [confettiProgress]);

  useEffect(() => {
    if (!visible) {
      bannerAnim.setValue(0);
      pulseAnim.setValue(1);
      confettiProgress.setValue(0);
      animRunningRef.current = false;
      return;
    }

    animRunningRef.current = true;
    bannerAnim.setValue(0);
    pulseAnim.setValue(1);
    confettiProgress.setValue(0);

    // Run animations smoothly
    const bannerSpring = Animated.spring(bannerAnim, {
      toValue: 1,
      friction: 7,
      tension: 40,
      useNativeDriver: true,
    });

    const pulseSeq = Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.18,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1.12,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]);

    const confettiTiming = Animated.timing(confettiProgress, {
      toValue: 1,
      duration: 1800,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });

    Animated.parallel([bannerSpring, pulseSeq, confettiTiming]).start();

    const timer = setTimeout(() => {
      if (!animRunningRef.current) return;
      Animated.timing(bannerAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        animRunningRef.current = false;
        if (onDismiss) onDismiss();
      });
    }, 2400);

    return () => {
      animRunningRef.current = false;
      clearTimeout(timer);
      bannerAnim.stopAnimation();
      pulseAnim.stopAnimation();
      confettiProgress.stopAnimation();
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
      {/* Confetti Particles (Shooting from bottom-left corner) */}
      {particles.map((p) => (
        <Animated.View
          key={p.id}
          style={[
            styles.confettiPiece,
            {
              left: 0,
              top: 0,
              width: p.size,
              height: p.isCircle ? p.size : p.size * 1.4,
              borderRadius: p.isCircle ? p.size / 2 : 1,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: [
                { translateX: p.translateX },
                { translateY: p.translateY },
                { rotate: p.rotate },
                { scale: p.scale },
              ],
            },
          ]}
        />
      ))}

      {/* Top Notification Celebration Banner */}
      <Animated.View
        style={[
          styles.celebrationCardContainer,
          {
            opacity: bannerAnim,
            transform: [
              {
                translateY: bannerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-70, 0],
                }),
              },
              {
                scale: bannerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1],
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
            <MaterialCommunityIcons name="party-popper" size={26} color="#FFFFFF" />
          </Animated.View>

          {/* Texts */}
          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.celebrationTitle}>{titleText}</Text>
              <Ionicons name="sparkles" size={15} color="#FFD700" style={{ marginLeft: 6 }} />
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
    top: Platform.OS === 'ios' ? 60 : 42,
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    maxWidth: 420,
    width: '100%',
  },
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
    fontSize: 14.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  celebrationSubtext: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#E8F5E9',
    marginTop: 2,
    lineHeight: 15,
  },
});
