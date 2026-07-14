import { useEffect, useMemo } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';

export default function LoadingView() {
  const rotateAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web', // avoid issue on web if native driver not supported for rotation
      })
    ).start();
  }, [rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.spinnerWrapper}>
        {/* Outer Spinning Ring */}
        <Animated.View style={[styles.outerRing, { transform: [{ rotate }] }]} />

        {/* Inner Black Circle with Logo */}
        <View style={styles.innerCircle}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>

      <Text style={styles.title}>Wait for a Second...</Text>
      <Text style={styles.subtitle}>Everything is getting ready for you</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgb(247, 247, 235)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerWrapper: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  outerRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3.5,
    borderColor: '#E6E2D8',
    borderTopColor: '#C4A46A', // Golden spinner segment
    borderLeftColor: '#C4A46A',
  },
  innerCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  logo: {
    width: 64,
    height: 64,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#7C7C7C',
    textAlign: 'center',
  },
});
