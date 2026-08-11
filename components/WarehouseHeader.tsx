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
 * Warehouse header styled with Web blue palette dark navy theme.
 */
export function WarehouseHeader({ title, showBackButton = false }: WarehouseHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.text.primary,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.strong,
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
              backgroundColor: 'rgba(248, 252, 255, 0.15)',
            }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.brand.primaryForeground} />
          </Pressable>
        ) : (
          <View style={{ width: 40, height: 40 }} />
        )}

        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            color: colors.brand.primaryForeground,
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
