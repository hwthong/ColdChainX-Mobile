import React from 'react';
import { View, Text } from 'react-native';

export default function TrackingScreen() {
  return (
    <View className="flex-1 bg-[#F5F2F0] items-center justify-center p-6">
      <Text className="text-[#8B4513] font-bold text-2xl mb-2">Giám sát đơn</Text>
      <Text className="text-[#877369] text-center">
        Bản đồ nhiệt độ thời gian thực sẽ hiển thị tại đây.
      </Text>
    </View>
  );
}
