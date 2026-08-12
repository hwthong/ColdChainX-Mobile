import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppPressable as Pressable } from '../../components/AppPressable';
import { colors } from '../../constants/colors';
import { useAuthStore } from '../../store/useAuthStore';

export default function DriverProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <ScrollView style={{ backgroundColor: colors.surface.page }} className="flex-1">
      <View className="px-6 py-8">

        {/* Profile Card */}
        <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="mb-6 items-center rounded-3xl border p-6 shadow-sm">
          <View style={{ backgroundColor: colors.brand.primarySoft }} className="mb-4 h-24 w-24 items-center justify-center rounded-full">
            {user?.fullName ? (
              <Text style={{ color: colors.brand.primary }} className="text-3xl font-bold">{user.fullName.charAt(0).toUpperCase()}</Text>
            ) : (
              <Ionicons name="person" size={40} color={colors.brand.primary} />
            )}
          </View>

          <Text style={{ color: colors.text.primary }} className="text-2xl font-bold">
            {user?.fullName || 'Tài xế'}
          </Text>
          <Text style={{ color: colors.text.secondary }} className="mt-1 text-base">
            {user?.email || 'Chưa cập nhật email'}
          </Text>

          <View style={{ backgroundColor: colors.surface.selected }} className="mt-3 rounded-full px-4 py-1.5">
            <Text style={{ color: colors.brand.primary }} className="text-sm font-bold">Vai trò: Tài xế</Text>
          </View>
        </View>

        {/* Info List */}
        <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="mb-8 rounded-2xl border p-4 shadow-sm">
          <View style={{ borderBottomColor: colors.border.default }} className="flex-row items-center border-b pb-4">
            <View style={{ backgroundColor: colors.brand.primarySoft }} className="h-10 w-10 items-center justify-center rounded-full">
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.brand.primary} />
            </View>
            <View className="ml-3 flex-1">
              <Text style={{ color: colors.text.secondary }} className="text-xs">Trạng thái tài khoản</Text>
              <Text style={{ color: colors.text.primary }} className="mt-0.5 text-base font-semibold">Đang hoạt động</Text>
            </View>
          </View>
        </View>

        {/* Action Button */}
        <Pressable
          onPress={logout}
          className="flex-row items-center justify-center rounded-xl border border-red-200 bg-red-50 p-4"
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.status.danger.main} />
          <Text style={{ color: colors.status.danger.main }} className="ml-2 text-base font-bold">Đăng xuất</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
