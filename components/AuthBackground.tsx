import type { ReactNode } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

type AuthBackgroundProps = {
  children: ReactNode;
};

const backgroundImage = require('../backgroundlogin.png');

export function AuthBackground({ children }: AuthBackgroundProps) {
  return (
    <View className="flex-1 bg-[#191C1D]">
      <ImageBackground
        source={backgroundImage}
        resizeMode="cover"
        className="absolute inset-0"
        style={StyleSheet.absoluteFill}
      />
      <View className="absolute inset-0" style={styles.darkBrownOverlay} />
      <ExpoLinearGradient
        colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        className="absolute inset-0"
        style={StyleSheet.absoluteFill}
      />
      <View className="flex-1">{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  darkBrownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(58, 31, 4, 0.65)',
  },
});
