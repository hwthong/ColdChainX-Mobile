import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getWarehouseIdFromToken } from '../../services/jwt';
import { useAuthStore } from '../../store/useAuthStore';

export default function WarehouseHomeScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const token = useAuthStore((state) => state.token);
  const fullName = useAuthStore((state) => state.fullName ?? state.user?.fullName ?? null);
  const warehouseId = token ? getWarehouseIdFromToken(token) : null;

  return (
    <SafeAreaView className="flex-1 bg-[#EEF7F4]" edges={['bottom']}>
      <View className="flex-1 px-5 py-5">
        <View className="mb-5 flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-xs font-bold uppercase text-[#4B635F]">Warehouse workspace</Text>
            <Text className="mt-1 text-2xl font-bold text-[#102A2D]" numberOfLines={1}>
              {fullName || 'ColdChainX Hub'}
            </Text>
          </View>
          <Pressable onPress={logout} className="rounded-lg border border-[#0F766E]/20 bg-white px-4 py-2">
            <Text className="font-semibold text-[#0F766E]">Logout</Text>
          </Pressable>
        </View>

        <View className="rounded-xl bg-[#102A2D] p-5">
          <Text className="text-xs font-bold uppercase text-[#94E6DC]">Inbound control</Text>
          <Text className="mt-3 text-2xl font-bold text-white">Drop-off to in-stock</Text>
          <Text className="mt-2 text-sm leading-6 text-[#CBE7E3]">
            Process ASN arrivals, QC cargo, resolve discrepancies, generate receipts, and confirm putaway.
          </Text>
          <View className="mt-4 rounded-lg bg-white/10 p-3">
            <Text className="text-xs font-semibold text-[#CBE7E3]">Mobile workspace</Text>
            <Text className="mt-1 text-sm font-bold text-white">Warehouse</Text>
            <Text className="mt-2 text-xs font-semibold text-[#CBE7E3]">WarehouseId</Text>
            <Text className="mt-1 text-xs text-white">{warehouseId || 'Not present in token'}</Text>
          </View>
        </View>

        <View className="mt-5 flex-row flex-wrap gap-3">
          <QuickAction
            icon="calendar-outline"
            title="Inbound"
            subtitle="ASN schedule and QC"
            onPress={() => router.push('/(warehouse)/inbound' as never)}
          />
          <QuickAction
            icon="document-text-outline"
            title="Receipts"
            subtitle="Receipt list and PDF"
            onPress={() => router.push('/(warehouse)/receipts' as never)}
          />
          <QuickAction
            icon="layers-outline"
            title="Inventory"
            subtitle="LPN stock status"
            onPress={() => router.push('/(warehouse)/inventory' as never)}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="min-h-[124px] flex-1 basis-[47%] rounded-xl bg-white p-4 shadow-sm">
      <View className="h-11 w-11 items-center justify-center rounded-lg bg-[#DDF5F0]">
        <Ionicons name={icon} size={22} color="#0F766E" />
      </View>
      <Text className="mt-4 text-base font-bold text-[#102A2D]">{title}</Text>
      <Text className="mt-1 text-xs font-medium text-[#64748B]">{subtitle}</Text>
    </Pressable>
  );
}
