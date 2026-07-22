import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { WarehouseHeader } from '../../components/WarehouseHeader';
import { WH_COLORS } from '../../constants/warehouseTheme';

const TITLE_MAP: Record<string, string> = {
  home: 'ColdChainX',
  inbound: 'Tiếp nhận',
  outbound: 'Xuất kho',
  receipts: 'Phiếu nhập kho',
  inventory: 'Hàng trong kho',
};

export default function WarehouseLayout() {
  return (
    <Tabs
      screenOptions={{
        header: ({ route }) => {
          const title = TITLE_MAP[route.name] || 'ColdChainX';
          return <WarehouseHeader title={title} />;
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
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Tổng quan',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbound"
        options={{
          title: 'Tiếp nhận',
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
          title: 'Phiếu nhập kho',
          tabBarIcon: ({ color }) => (
            <Ionicons name="document-text-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Hàng trong kho',
          tabBarIcon: ({ color }) => <Ionicons name="layers-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
