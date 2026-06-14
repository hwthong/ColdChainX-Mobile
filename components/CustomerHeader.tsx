import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface CustomerHeaderProps {
  title: string;
  showBackButton?: boolean;
}

export function CustomerHeader({ title, showBackButton = false }: CustomerHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-[#3A1F04] w-full flex-col z-50 shadow-sm border-b border-[#DAC2B6]/10"
    >
      <View className="flex-row items-center justify-between h-[60px] px-5">
        {showBackButton ? (
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors"
          >
            <Ionicons name="chevron-back" size={24} color="#FFC29F" />
          </Pressable>
        ) : (
          <View className="w-10 h-10" /> // Spacer for alignment
        )}

        <Text
          className={`flex-1 text-center text-[#FFC29F] tracking-tight ${
            title === 'ColdChainX' ? 'font-serif italic font-bold text-[26px]' : 'font-bold text-xl'
          }`}
        >
          {title}
        </Text>

        <Pressable className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors">
          <Ionicons name="search" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}
