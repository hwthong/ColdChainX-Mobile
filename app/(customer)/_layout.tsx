import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CustomerHeader } from '../../components/CustomerHeader';

export default function CustomerLayout() {
  return (
    <Tabs
      screenOptions={{
        header: ({ route }) => {
          const titleMap: Record<string, string> = {
            home: 'ColdChainX',
            'create-order': 'Tạo đơn hàng',
            status: 'Trạng thái đơn',
            tracking: 'Giám sát đơn',
            chat: 'Trao đổi',
            'chat/[orderId]': 'Tin nhắn đơn hàng',
            profile: 'Hồ sơ cá nhân',
            notifications: 'Thông báo',
            'schedule-delivery': 'Đặt lịch giao',
            'delivery-schedules': 'Lịch vận chuyển',
          };
          const title = titleMap[route.name] || 'ColdChainX';
          const showBackButton = route.name !== 'home' && route.name !== 'profile';

          return <CustomerHeader title={title} showBackButton={showBackButton} />;
        },
        tabBarActiveTintColor: '#8B4513',
        tabBarInactiveTintColor: '#877369',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: 'rgba(218, 194, 182, 0.5)',
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
          title: 'Tổng quan',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create-order"
        options={{
          title: 'Tạo đơn',
          tabBarIcon: ({ color }) => <Ionicons name="add-circle-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          title: 'Trạng thái',
          tabBarIcon: ({ color }) => <Ionicons name="analytics-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tracking"
        options={{
          title: 'Giám sát',
          tabBarIcon: ({ color }) => <Ionicons name="locate-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá nhân',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Trao đổi',
          tabBarIcon: ({ color }) => <Ionicons name="chatbubbles-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat/[orderId]"
        options={{
          href: null,
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
    </Tabs>
  );
}
