import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { WarehouseHeader } from '../../components/WarehouseHeader';
import { WH_COLORS } from '../../constants/warehouseTheme';

const TITLE_MAP: Record<string, string> = {
  home: 'ColdChainX',
  inbound: 'Nhập kho',
  outbound: 'Xuất kho',
  receipts: 'Phiếu nhập',
  inventory: 'Tồn kho',
};

export default function WarehouseLayout() {
  return (
    <Tabs
      screenOptions={{
        header: ({ route }) => {
          const title = TITLE_MAP[route.name] || 'ColdChainX';
          const showBackButton = route.name !== 'home';
          return <WarehouseHeader title={title} showBackButton={showBackButton} />;
        },
        tabBarActiveTintColor: WH_COLORS.primary,
        tabBarInactiveTintColor: WH_COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: WH_COLORS.tabBorder,
          elevation: 20,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.03,
          shadowRadius: 20,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbound"
        options={{
          title: 'Nhập kho',
          tabBarIcon: ({ color }) => <Ionicons name="cube-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="outbound"
        options={{
          title: 'Xuất kho',
          tabBarIcon: ({ color }) => <Ionicons name="exit-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="receipts"
        options={{
          title: 'Phiếu nhập',
          tabBarIcon: ({ color }) => (
            <Ionicons name="document-text-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Tồn kho',
          tabBarIcon: ({ color }) => <Ionicons name="layers-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
