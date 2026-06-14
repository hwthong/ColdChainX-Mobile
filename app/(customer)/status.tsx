import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCustomerOrders, OrderResponse } from '../../services/orderApi';
import { useAuthStore } from '../../store/useAuthStore';
import { getApiErrorMessage } from '../../services/apiClient';

export default function StatusScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);
  const customerId = useAuthStore((state) => state.user?.customerId);

  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!accessToken || !customerId) {
      setError('Không tìm thấy thông tin khách hàng.');
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const res = await getCustomerOrders(accessToken, customerId);
      if (res.success && res.data) {
        setOrders(res.data.items || []);
      } else {
        setError(res.message || 'Không thể lấy danh sách đơn hàng.');
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken, customerId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchOrders();
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'APPROVED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'IN_TRANSIT': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'DELIVERED': return 'bg-green-100 text-green-800 border-green-200';
      case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const translateStatus = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING': return 'Chờ duyệt';
      case 'APPROVED': return 'Đã duyệt';
      case 'IN_TRANSIT': return 'Đang giao';
      case 'DELIVERED': return 'Đã giao';
      case 'CANCELLED': return 'Đã hủy';
      default: return status;
    }
  };

  const renderOrder = ({ item }: { item: OrderResponse }) => {
    const statusStyle = getStatusColor(item.status);
    
    return (
      <Pressable 
        onPress={() => router.push(`/(customer)/orders/${item.orderId}` as any)}
        className="bg-white rounded-2xl p-5 shadow-sm border border-[#DAC2B6]/50 mb-4"
      >
        <View className="flex-row justify-between items-start mb-3">
          <View>
            <Text className="text-[#8B4513] font-bold text-lg">{item.trackingCode}</Text>
            <Text className="text-[#877369] text-xs">
              {item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
            </Text>
          </View>
          <View className={`px-2.5 py-1 rounded-full border ${statusStyle.split(' ')[0]} ${statusStyle.split(' ')[2]}`}>
            <Text className={`text-[10px] font-bold uppercase tracking-wider ${statusStyle.split(' ')[1]}`}>
              {translateStatus(item.status)}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2 mb-2">
          <Ionicons name="cube-outline" size={16} color="#877369" />
          <Text className="text-[#3A1F04] font-medium">{item.itemName} • {item.quantity} {item.packingType}</Text>
        </View>

        <View className="flex-row items-center gap-2 mb-2">
          <Ionicons name="thermometer-outline" size={16} color="#006E0A" />
          <Text className="text-[#006E0A] font-medium">{item.tempCondition} °C</Text>
        </View>

        <View className="flex-row items-start gap-2 mt-2 pt-3 border-t border-gray-100">
          <Ionicons name="location-outline" size={16} color="#8B4513" className="mt-0.5" />
          <Text className="text-[#877369] text-sm flex-1 leading-5">
            {item.destination?.address || 'Chưa cập nhật địa chỉ'}
          </Text>
        </View>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#F5F2F0] items-center justify-center">
        <ActivityIndicator size="large" color="#8B4513" />
        <Text className="text-[#8B4513] mt-4 font-medium">Đang tải danh sách...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F5F2F0]">
      {error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
          <Text className="text-red-600 text-center mt-4 font-medium">{error}</Text>
          <Pressable onPress={fetchOrders} className="mt-4 px-6 py-2 bg-[#8B4513] rounded-xl">
            <Text className="text-white font-bold">Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.orderId}
          renderItem={renderOrder}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#8B4513" />}
          ListEmptyComponent={
            <View className="items-center justify-center py-20 opacity-60">
              <Ionicons name="document-text-outline" size={64} color="#877369" />
              <Text className="text-[#877369] mt-4 text-center font-medium">
                Chưa có đơn hàng nào.{'\n'}Hãy tạo đơn hàng mới ngay!
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
