import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { WH_COLORS } from '../../constants/warehouseTheme';
import { getWarehouseIdFromToken } from '../../services/jwt';
import { useAuthStore } from '../../store/useAuthStore';

export default function WarehouseHomeScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const token = useAuthStore((state) => state.token);
  const fullName = useAuthStore((state) => state.fullName ?? state.user?.fullName ?? null);
  const warehouseId = token ? getWarehouseIdFromToken(token) : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: WH_COLORS.background }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 110 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      {/* Greeting row */}
      <View style={{ marginBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: WH_COLORS.textSecondary }}>
            Khu vực kho
          </Text>
          <Text style={{ marginTop: 4, fontSize: 24, fontWeight: '700', color: WH_COLORS.textPrimary }} numberOfLines={1}>
            {fullName || 'ColdChainX'}
          </Text>
        </View>
        <Pressable
          onPress={logout}
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: 'rgba(139, 69, 19, 0.2)',
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <Text style={{ fontWeight: '600', color: WH_COLORS.primary }}>Đăng xuất</Text>
        </Pressable>
      </View>

      {/* Hero card */}
      <View style={{ borderRadius: 20, backgroundColor: WH_COLORS.headerBg, padding: 20 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255, 194, 159, 0.7)' }}>
          Kho lạnh ColdChainX
        </Text>
        <Text style={{ marginTop: 12, fontSize: 24, fontWeight: '700', color: WH_COLORS.headerText }}>
          Quản lý nhập kho
        </Text>
        <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 22, color: 'rgba(255, 255, 255, 0.7)' }}>
          Tiếp nhận hàng, kiểm tra chất lượng, xử lý sai lệch, tạo phiếu nhập và xác nhận vị trí lưu kho.
        </Text>
        <View style={{ marginTop: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', padding: 14 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255, 194, 159, 0.8)' }}>Khu vực làm việc</Text>
          <Text style={{ marginTop: 4, fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>Kho hàng</Text>
          <Text style={{ marginTop: 8, fontSize: 11, fontWeight: '600', color: 'rgba(255, 194, 159, 0.8)' }}>Mã kho</Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: '#FFFFFF' }}>{warehouseId || 'Chưa xác định'}</Text>
        </View>
      </View>

      {/* Quick actions */}
      <View style={{ marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <QuickAction
          icon="cube-outline"
          title="Nhập kho"
          subtitle="Tiếp nhận và QC hàng"
          onPress={() => router.push('/(warehouse)/inbound' as never)}
        />
        <QuickAction
          icon="document-text-outline"
          title="Phiếu nhập"
          subtitle="Danh sách phiếu nhập"
          onPress={() => router.push('/(warehouse)/receipts' as never)}
        />
        <QuickAction
          icon="layers-outline"
          title="Tồn kho"
          subtitle="Trạng thái LPN"
          onPress={() => router.push('/(warehouse)/inventory' as never)}
        />
      </View>
    </ScrollView>
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
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 132,
        flexBasis: '47%',
        flexGrow: 1,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: WH_COLORS.cardBorder,
        backgroundColor: WH_COLORS.cardBg,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: WH_COLORS.iconBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={22} color={WH_COLORS.primary} />
      </View>
      <Text style={{ marginTop: 16, fontSize: 16, fontWeight: '700', color: WH_COLORS.textPrimary }}>
        {title}
      </Text>
      <Text style={{ marginTop: 4, fontSize: 12, fontWeight: '500', color: WH_COLORS.textSecondary }}>
        {subtitle}
      </Text>
    </Pressable>
  );
}
