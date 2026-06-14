import React from 'react';
import { View, Text } from 'react-native';

export default function StatusScreen() {
  return (
    <View className="flex-1 bg-[#F5F2F0] items-center justify-center p-6">
      <Text className="text-[#8B4513] font-bold text-2xl mb-2">Trạng thái đơn hàng</Text>
      <Text className="text-[#877369] text-center">
        Chức năng theo dõi danh sách trạng thái sẽ được cập nhật trong phiên bản tiếp theo.
      </Text>
    </View>
  );
}
