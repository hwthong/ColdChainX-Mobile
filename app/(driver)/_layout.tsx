import React from 'react';
import { Tabs, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DriverHeader } from '../../components/DriverHeader';
import { colors } from '../../constants/colors';

export default function DriverLayout() {
  const pathname = usePathname();

  // Detect if we are on a full-screen subroute (nested trip pages, incident details, notifications)
  const isNestedTrip =
    pathname.includes('/trips/') &&
    pathname !== '/(driver)/trips' &&
    pathname !== '/trips';
  const isNotifications = pathname.includes('/notifications');
  const isFullScreenRoute = isNestedTrip || isNotifications;

  return (
    <Tabs
      screenOptions={{
        header: ({ route }) => {
          if (isFullScreenRoute) return null;

          const titleMap: Record<string, string> = {
            home: 'ColdChainX Driver',
            trips: 'Chuyến xe',
            history: 'Lịch sử chuyến đi',
            profile: 'Hồ sơ cá nhân',
          };

          const title = titleMap[route.name] || 'Tài xế';
          const showBackButton =
            route.name !== 'home' &&
            route.name !== 'trips' &&
            route.name !== 'history' &&
            route.name !== 'profile';

          return <DriverHeader title={title} showBackButton={showBackButton} />;
        },
        headerShown: !isFullScreenRoute,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: isFullScreenRoute
          ? { display: 'none' }
          : {
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
          popToTopOnBlur: true,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('trips', { screen: 'index' });
          },
        })}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Lịch sử',
          tabBarIcon: ({ color }) => <Ionicons name="time-outline" size={24} color={color} />,
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
        name="notifications"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
