import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { WH_COLORS } from '../constants/warehouseTheme';

interface WarehouseHeaderProps {
  title: string;
  showBackButton?: boolean;
}

/**
 * Warehouse header styled to match Customer app (dark brown bg, warm peach text).
 * Simpler than CustomerHeader — no notification bell.
 */
export function WarehouseHeader({ title, showBackButton = false }: WarehouseHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: WH_COLORS.headerBg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(218, 194, 182, 0.1)',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 60,
          paddingHorizontal: 20,
        }}
      >
        {showBackButton ? (
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.1)',
            }}
          >
            <Ionicons name="chevron-back" size={24} color={WH_COLORS.headerText} />
          </Pressable>
        ) : (
          <View style={{ width: 40, height: 40 }} />
        )}

        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            color: WH_COLORS.headerText,
            fontWeight: '700',
            fontSize: title === 'ColdChainX' ? 26 : 20,
            fontStyle: title === 'ColdChainX' ? 'italic' : 'normal',
            letterSpacing: -0.3,
          }}
        >
          {title}
        </Text>

        {/* Spacer to balance layout */}
        <View style={{ width: 40, height: 40 }} />
      </View>
    </View>
  );
}
