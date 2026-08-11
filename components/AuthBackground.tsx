import type { ReactNode } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

type AuthBackgroundProps = {
  children: ReactNode;
};

const backgroundImage = require('../backgroundlogin.png');

export function AuthBackground({ children }: AuthBackgroundProps) {
  return (
    <View className="flex-1 bg-[#061D38]">
      <ImageBackground
        source={backgroundImage}
        resizeMode="cover"
        className="absolute inset-0"
        style={StyleSheet.absoluteFill}
      />
      <ExpoLinearGradient
        colors={['rgba(6, 29, 56, 0.65)', 'rgba(6, 29, 56, 0.52)']}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        className="absolute inset-0"
        style={StyleSheet.absoluteFill}
      />
      <View className="flex-1">{children}</View>
    </View>
  );
}
