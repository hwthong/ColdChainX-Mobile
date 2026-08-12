import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { colors } from '../constants/colors';

interface WarehouseHeaderProps {
  title: string;
  showBackButton?: boolean;
}

/**
 * Unified Light Warehouse Header styled with clean light theme baseline.
 */
export function WarehouseHeader({ title, showBackButton = false }: WarehouseHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.surface.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
          paddingHorizontal: 16,
        }}
      >
        {showBackButton ? (
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 38,
              height: 38,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 19,
              backgroundColor: colors.surface.muted,
            }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 38, height: 38 }} />
        )}

        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            color: colors.text.primary,
            fontWeight: '700',
            fontSize: title === 'ColdChainX' ? 24 : 18,
            fontStyle: title === 'ColdChainX' ? 'italic' : 'normal',
            letterSpacing: -0.3,
          }}
        >
          {title}
        </Text>

        <View style={{ width: 38, height: 38 }} />
      </View>
    </View>
  );
}
