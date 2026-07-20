import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../store/useAuthStore';

export default function DriverProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <ScrollView className="flex-1 bg-[#F6F8F2]">
      <View className="px-6 py-8">
        
        {/* Profile Card */}
        <View className="mb-6 items-center rounded-3xl border border-amber-200 bg-white p-6 shadow-sm">
          <View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-amber-100">
            {user?.fullName ? (
              <Text className="text-3xl font-bold text-amber-900">{user.fullName.charAt(0).toUpperCase()}</Text>
            ) : (
              <Ionicons name="person" size={40} color="#8B4513" />
            )}
          </View>

          <Text className="text-2xl font-bold text-amber-900">
            {user?.fullName || 'Tài xế'}
          </Text>
          <Text className="mt-1 text-base text-amber-700">
            {user?.email || 'Chưa cập nhật email'}
          </Text>
          
          <View className="mt-3 rounded-full bg-amber-100 px-4 py-1.5">
            <Text className="text-sm font-bold text-amber-900">Vai trò: Tài xế</Text>
          </View>
        </View>

        {/* Info List */}
        <View className="mb-8 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <View className="flex-row items-center border-b border-amber-100 pb-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-amber-50">
              <Ionicons name="shield-checkmark-outline" size={20} color="#8B4513" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-xs text-amber-700">Trạng thái tài khoản</Text>
              <Text className="mt-0.5 text-base font-semibold text-amber-900">Đang hoạt động</Text>
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
          <Ionicons name="log-out-outline" size={20} color="#991B1B" />
          <Text className="ml-2 text-base font-bold text-red-900">Đăng xuất</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
