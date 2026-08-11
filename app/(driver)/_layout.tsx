import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WarehouseHeader } from '../../components/WarehouseHeader';
import { colors } from '../../constants/colors';

export default function DriverLayout() {
  return (
    <Tabs
      screenOptions={{
        header: ({ route }) => {
          const titleMap: Record<string, string> = {
            home: 'Trang chủ Tài xế',
            trips: 'Chuyến xe',
            profile: 'Hồ sơ cá nhân',
          };
          
          let title = titleMap[route.name];
          
          // Fallbacks for dynamic routes
          if (route.name === 'trips/[id]') title = 'Chi tiết chuyến';
          if (route.name === 'trips/[id]/documents') title = 'Chứng từ & Waybill';
          if (route.name === 'trips/[id]/incident') title = 'Báo cáo sự cố';
          
          if (!title) title = 'Tài xế';

          const showBackButton = route.name !== 'home' && route.name !== 'trips' && route.name !== 'profile';

          return <WarehouseHeader title={title} showBackButton={showBackButton} />;
        },
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: {
          backgroundColor: colors.surface.card,
          borderTopColor: colors.border.default,
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
        name="trips"
        options={{
          title: 'Chuyến xe',
          tabBarIcon: ({ color }) => <Ionicons name="map-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá nhân',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={color} />,
        }}
      />
      
    </Tabs>
  );
}
