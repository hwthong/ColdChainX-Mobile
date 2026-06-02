import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassWidget } from '../../components/GlassWidget';
import { SwipeButton } from '../../components/SwipeButton';
import { useAuthStore } from '../../store/useAuthStore';

export default function CustomerHomeScreen() {
  const logout = useAuthStore((state) => state.logout);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="flex-1 bg-[#F6F8F2] px-6 py-6">
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-semibold uppercase text-brown-light">Customer</Text>
            <Text className="mt-1 text-3xl font-bold text-brown-dark">Dashboard</Text>
          </View>
          <Pressable onPress={logout} className="rounded-lg border border-brown-dark/10 px-4 py-2">
            <Text className="font-semibold text-brown-dark">Logout</Text>
          </Pressable>
        </View>

        <View className="gap-4">
          <GlassWidget>
            <Text className="text-sm font-semibold uppercase text-brown-light">Shipments</Text>
            <Text className="mt-2 text-2xl font-bold text-brown-dark">Track your orders</Text>
            <Text className="mt-2 text-base leading-6 text-brown-light">
              Shipment status, handoff history, and cold-chain readings will appear here.
            </Text>
          </GlassWidget>

          <SwipeButton label="Swipe to create request" />
        </View>
      </View>
    </SafeAreaView>
  );
}
