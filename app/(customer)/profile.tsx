import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';

export default function ProfileScreen() {
  const logout = useAuthStore((state) => state.logout);

  return (
    <View className="flex-1 bg-[#F5F2F0] items-center justify-center p-6">
      <Text className="text-[#8B4513] font-bold text-2xl mb-4">Hồ sơ cá nhân</Text>
      
      <Pressable 
        onPress={logout}
        className="px-6 py-3 bg-red-100 rounded-xl border border-red-200"
      >
        <Text className="text-red-700 font-bold">Đăng xuất</Text>
      </Pressable>
    </View>
  );
}
