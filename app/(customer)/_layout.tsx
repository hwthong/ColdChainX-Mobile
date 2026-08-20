import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CustomerHeader } from '../../components/CustomerHeader';
import { colors } from '../../constants/colors';

export default function CustomerLayout() {
  return (
    <Tabs
      screenOptions={{
        header: ({ route }) => {
          const titleMap: Record<string, string> = {
            home: 'ColdChainX',
            'create-order': 'Tạo đơn hàng',
            status: 'Đơn hàng',
            tracking: 'Giám sát',
            claims: 'Khiếu nại',
            'chat/index': 'Hỗ trợ',
            'chat/[orderId]': 'Tin nhắn đơn hàng',
            profile: 'Hồ sơ cá nhân',
            notifications: 'Thông báo',
            'schedule-delivery': 'Đặt lịch giao',
            'delivery-schedules': 'Lịch vận chuyển',
            'change-password': 'Đổi mật khẩu',
          };
          const title = titleMap[route.name] || 'ColdChainX';
          const showBackButton = route.name !== 'home' && route.name !== 'profile';

          return <CustomerHeader title={title} showBackButton={showBackButton} />;
        },
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: {
          minHeight: 56,
          paddingVertical: 4,
        },
        tabBarStyle: {
          backgroundColor: colors.surface.card,
          borderTopColor: colors.border.default,
          elevation: 10,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.04,
          shadowRadius: 12,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Trang chủ',
          tabBarAccessibilityLabel: 'Trang chủ',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create-order"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          title: 'Đơn hàng',
          tabBarAccessibilityLabel: 'Đơn hàng',
          tabBarIcon: ({ color }) => <Ionicons name="receipt-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tracking"
        options={{
          title: 'Giám sát',
          tabBarAccessibilityLabel: 'Giám sát',
          tabBarIcon: ({ color }) => <Ionicons name="locate-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="claims"
        options={{
          title: 'Khiếu nại',
          tabBarAccessibilityLabel: 'Khiếu nại',
          tabBarIcon: ({ color }) => <Ionicons name="alert-circle-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá nhân',
          tabBarAccessibilityLabel: 'Cá nhân',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat/index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="chat/[orderId]"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="orders/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="schedule-delivery"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="delivery-schedules"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="change-password"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
