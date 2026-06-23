import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function WarehouseLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#102A2D',
        },
        headerTintColor: '#E9FFF9',
        headerTitleStyle: {
          fontWeight: '700',
        },
        tabBarActiveTintColor: '#0F766E',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#D7E5E4',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbound"
        options={{
          title: 'Inbound',
          tabBarIcon: ({ color }) => <Ionicons name="cube-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="receipts"
        options={{
          title: 'Receipts',
          tabBarIcon: ({ color }) => <Ionicons name="document-text-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color }) => <Ionicons name="layers-outline" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
