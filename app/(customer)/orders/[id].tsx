import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getOrderById, OrderResponse } from '../../../services/orderApi';
import { useAuthStore } from '../../../store/useAuthStore';
import { getApiErrorMessage, API_BASE_URL } from '../../../services/apiClient';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrder() {
      if (!accessToken || !id) return;
      try {
        setError(null);
        const res = await getOrderById(accessToken, id);
        if (res.success && res.data) {
          setOrder(res.data);
        } else {
          setError(res.message || 'Không thể lấy thông tin đơn hàng.');
        }
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    fetchOrder();
  }, [id, accessToken]);

  const translateStatus = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING': 
      case 'PENDING_REVIEW': return 'Chờ duyệt';
      case 'APPROVED': return 'Đã duyệt';
      case 'IN_TRANSIT': return 'Đang giao';
      case 'DELIVERED': return 'Đã giao';
      case 'CANCELLED': return 'Đã hủy';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#F5F2F0] items-center justify-center">
        <ActivityIndicator size="large" color="#8B4513" />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View className="flex-1 bg-[#F5F2F0] items-center justify-center p-6">
        <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
        <Text className="text-red-600 text-center mt-4 font-medium">{error || 'Không tìm thấy đơn hàng'}</Text>
        <Pressable onPress={() => router.back()} className="mt-4 px-6 py-2 bg-gray-200 rounded-xl">
          <Text className="text-gray-800 font-bold">Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  const rawDocumentImage = order.documents.find(d => d.docType === 'CargoImage')?.imageUrl || order.documents[0]?.imageUrl;
  
  const getFullImageUrl = (url?: string | null) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const documentImage = getFullImageUrl(rawDocumentImage);

  return (
    <ScrollView className="flex-1 bg-[#F5F2F0]" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      {/* Header Info */}
      <View className="bg-white rounded-2xl p-6 shadow-sm border border-[#DAC2B6]/50 mb-4">
        <View className="flex-row items-center gap-2 mb-2">
          <Ionicons name="barcode-outline" size={20} color="#8B4513" />
          <Text className="text-[#8B4513] font-bold text-xl">{order.trackingCode}</Text>
        </View>
        <Text className="text-[#877369] font-medium mb-4">Trạng thái: <Text className="text-[#006E0A]">{translateStatus(order.status)}</Text></Text>
        
        <View className="flex-row items-center gap-2 pt-4 border-t border-gray-100">
          <Ionicons name="calendar-outline" size={16} color="#877369" />
          <Text className="text-[#3A1F04] font-medium text-sm">Ngày tạo: {order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN') : 'N/A'}</Text>
        </View>
      </View>

      {/* Cargo Info */}
      <View className="bg-white rounded-2xl p-6 shadow-sm border border-[#DAC2B6]/50 mb-4 gap-3">
        <Text className="text-[#8B4513] font-bold text-base mb-2 border-b border-[#DAC2B6]/30 pb-2">Thông Tin Hàng Hóa</Text>
        
        <View className="flex-row justify-between">
          <Text className="text-[#877369]">Tên hàng:</Text>
          <Text className="font-medium text-[#3A1F04]">{order.itemName}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-[#877369]">Loại hàng:</Text>
          <Text className="font-medium text-[#3A1F04]">{order.category}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-[#877369]">Bao bì:</Text>
          <Text className="font-medium text-[#3A1F04]">{order.packingType} (SL: {order.quantity})</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-[#877369]">Trọng lượng:</Text>
          <Text className="font-medium text-[#3A1F04]">{order.expectedWeightKg} kg</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-[#877369]">Thể tích (CBM):</Text>
          <Text className="font-medium text-[#3A1F04]">{order.expectedCbm}</Text>
        </View>
        <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-100">
          <Text className="text-[#877369] font-medium">Nhiệt độ yêu cầu:</Text>
          <Text className="font-bold text-[#006E0A]">{order.tempCondition} °C</Text>
        </View>
      </View>

      {/* Destination Info */}
      <View className="bg-white rounded-2xl p-6 shadow-sm border border-[#DAC2B6]/50 mb-4 gap-2">
        <Text className="text-[#8B4513] font-bold text-base mb-2 border-b border-[#DAC2B6]/30 pb-2">Giao Hàng Đến</Text>
        <View className="flex-row items-start gap-2">
          <Ionicons name="location-sharp" size={18} color="#006E0A" className="mt-0.5" />
          <Text className="text-[#3A1F04] font-medium leading-5 flex-1">{order.destination?.address || 'Chưa cập nhật'}</Text>
        </View>
      </View>

      {/* Cargo Image */}
      {documentImage && (
        <View className="bg-white rounded-2xl p-6 shadow-sm border border-[#DAC2B6]/50 mb-4 gap-3">
          <Text className="text-[#8B4513] font-bold text-base mb-2 border-b border-[#DAC2B6]/30 pb-2">Hình Ảnh Kiện Hàng</Text>
          <Image 
            source={{ uri: documentImage }} 
            className="w-full h-48 rounded-xl bg-gray-100" 
            resizeMode="cover" 
          />
        </View>
      )}

      {/* Quotation Section */}
      <View className="bg-[#F8F9FA] rounded-2xl p-6 shadow-sm border border-[#DAC2B6]/50 mb-4">
        <Text className="text-[#8B4513] font-bold text-base mb-2">Chi Phí & Báo Giá</Text>
        {order.quotations && order.quotations.length > 0 ? (
          <View>
             {order.quotations.map(q => (
               <View key={q.quoteId} className="bg-white p-4 rounded-xl border border-gray-200 mt-2">
                 <Text className="text-[#877369] mb-1">Mã Báo Giá: {q.quoteId}</Text>
                 <Text className="text-[#3A1F04] font-bold">Tổng tiền: {q.finalAmount.toLocaleString('vi-VN')} VND</Text>
               </View>
             ))}
          </View>
        ) : (
          <Text className="text-[#877369] italic">Đang chờ ColdChainX tính toán báo giá...</Text>
        )}
      </View>
    </ScrollView>
  );
}
