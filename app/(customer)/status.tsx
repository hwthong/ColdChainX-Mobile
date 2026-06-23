import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { API_BASE_URL, getApiErrorMessage } from '../../services/apiClient';
import { getCustomerAsns, type AsnResponse } from '../../services/asnApi';
import { getCustomerIdFromToken } from '../../services/jwt';
import { getCustomerOrders, OrderResponse } from '../../services/orderApi';
import { useAuthStore } from '../../store/useAuthStore';

export default function StatusScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);
  const storedCustomerId = useAuthStore((state) => state.customerId ?? state.user?.customerId ?? null);

  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asnsByOrderId, setAsnsByOrderId] = useState<Record<string, AsnResponse>>({});

  const fetchOrders = useCallback(async () => {
    const fallbackCustomerId = accessToken ? getCustomerIdFromToken(accessToken) : null;
    const resolvedCustomerId = storedCustomerId ?? fallbackCustomerId;

    console.log('[Status] hasToken:', Boolean(accessToken));
    console.log('[Status] customerId from store:', storedCustomerId);
    console.log('[Status] customerId from token fallback:', fallbackCustomerId);

    if (!accessToken) {
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      setOrders([]);
      setAsnsByOrderId({});
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (!resolvedCustomerId) {
      setError('Không tìm thấy mã khách hàng. Vui lòng đăng xuất và đăng nhập lại.');
      setOrders([]);
      setAsnsByOrderId({});
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setError(null);
      const response = await getCustomerOrders(accessToken, resolvedCustomerId, 1, 10);

      if (response.success) {
        setOrders(response.data ?? []);

        try {
          const asnResponse = await getCustomerAsns(accessToken, resolvedCustomerId);
          const nextAsnsByOrderId = Object.fromEntries(
            (asnResponse.data ?? []).map((asn) => [asn.orderId, asn])
          );

          setAsnsByOrderId(nextAsnsByOrderId);
        } catch (asnError) {
          console.warn('[Status] Could not load customer ASNs', asnError);
          setAsnsByOrderId({});
        }
      } else {
        setError(response.message || 'Không thể lấy danh sách đơn hàng.');
        setAsnsByOrderId({});
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
      setOrders([]);
      setAsnsByOrderId({});
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken, storedCustomerId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchOrders();
    }, [fetchOrders])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchOrders();
  };

  const renderOrder = ({ item }: { item: OrderResponse }) => {
    const imageUrl = getOrderImageUrl(item);
    const existingAsn = asnsByOrderId[item.orderId];
    const canScheduleDelivery = isContractSigned(item.status);

    return (
      <Pressable
        onPress={() => router.push(`/(customer)/orders/${item.orderId}` as never)}
        className="mb-4 overflow-hidden rounded-2xl border border-[#DAC2B6]/50 bg-white shadow-sm"
      >
        <View className="p-5">
          <View className="mb-3 flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-lg font-bold text-[#8B4513]">{item.trackingCode}</Text>
              <Text className="mt-1 text-[11px] font-medium text-[#877369]" numberOfLines={1}>
                Order ID: {item.orderId}
              </Text>
              <Text className="mt-1 text-xs text-[#877369]">{formatDate(item.createdAt)}</Text>
            </View>
            <StatusBadge status={item.status} />
          </View>

          <View className="flex-row gap-3">
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} className="h-20 w-20 rounded-xl bg-[#F8F9FA]" resizeMode="cover" />
            ) : (
              <View className="h-20 w-20 items-center justify-center rounded-xl bg-[#F8F9FA]">
                <Ionicons name="image-outline" size={24} color="#877369" />
              </View>
            )}

            <View className="flex-1 gap-2">
              <View className="flex-row items-center gap-2">
                <Ionicons name="cube-outline" size={16} color="#8B4513" />
                <Text className="flex-1 font-semibold text-[#3A1F04]">{item.itemName}</Text>
              </View>

              <View className="flex-row items-center gap-2">
                <Ionicons name="thermometer-outline" size={16} color="#006E0A" />
                <Text className="font-medium text-[#006E0A]">{formatTemperature(item.tempCondition)}</Text>
                <Text className="text-[#877369]">•</Text>
                <Text className="font-medium text-[#877369]">{item.expectedWeightKg} kg</Text>
              </View>

              <View className="flex-row items-start gap-2">
                <Ionicons name="location-outline" size={16} color="#877369" />
                <Text className="flex-1 text-sm leading-5 text-[#877369]">
                  {item.destination?.address || 'Chưa cập nhật địa chỉ'}
                </Text>
              </View>

              {item.route ? (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="git-branch-outline" size={16} color="#8B4513" />
                  <Text className="flex-1 text-sm font-semibold text-[#8B4513]">
                    {`${item.route.routeCode} - ${item.route.originCity} -> ${item.route.destCity}`}
                  </Text>
                </View>
              ) : null}

              {getLatestQuotationStatus(item) ? (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="receipt-outline" size={16} color="#877369" />
                  <Text className="text-sm font-medium text-[#877369]">
                    Báo giá: {translateStatus(getLatestQuotationStatus(item) ?? '')}
                  </Text>
                </View>
              ) : null}

              {canScheduleDelivery ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/(customer)/schedule-delivery',
                      params: {
                        orderId: item.orderId,
                        asnId: existingAsn?.asnId ?? '',
                      },
                    } as never)
                  }
                  className={`mt-2 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 ${
                    existingAsn ? 'bg-green-700' : 'bg-[#8B4513]'
                  }`}
                >
                  <Ionicons name={existingAsn ? 'qr-code-outline' : 'calendar-outline'} size={18} color="#FFFFFF" />
                  <Text className="font-bold text-white">
                    {existingAsn ? 'Xem lịch đã đặt' : 'Đặt lịch giao'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F2F0]">
        <ActivityIndicator size="large" color="#8B4513" />
        <Text className="mt-4 font-medium text-[#8B4513]">Đang tải danh sách...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F5F2F0]">
      {error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
          <Text className="mt-4 text-center font-medium leading-6 text-red-600">{error}</Text>
          <Pressable onPress={fetchOrders} className="mt-4 rounded-xl bg-[#8B4513] px-6 py-3">
            <Text className="font-bold text-white">Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.orderId}
          renderItem={renderOrder}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#8B4513" />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="document-text-outline" size={64} color="#877369" />
              <Text className="mt-4 text-center font-medium text-[#877369]">
                Bạn chưa có đơn hàng nào.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorClass = getStatusColor(status);

  return (
    <View className={`rounded-full border px-2.5 py-1 ${colorClass.container}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${colorClass.text}`}>
        {translateStatus(status)}
      </Text>
    </View>
  );
}

function getStatusColor(status: string) {
  switch (status.toUpperCase()) {
    case 'PENDING':
    case 'PENDING_REVIEW':
      return { container: 'bg-yellow-100 border-yellow-200', text: 'text-yellow-800' };
    case 'QUOTING':
      return { container: 'bg-orange-100 border-orange-200', text: 'text-orange-800' };
    case 'CONTRACT_PENDING':
      return { container: 'bg-amber-100 border-amber-200', text: 'text-amber-800' };
    case 'CONTRACT_SIGNED':
      return { container: 'bg-emerald-100 border-emerald-200', text: 'text-emerald-800' };
    case 'ASSIGNED':
      return { container: 'bg-blue-100 border-blue-200', text: 'text-blue-800' };
    case 'IN_TRANSIT':
      return { container: 'bg-purple-100 border-purple-200', text: 'text-purple-800' };
    case 'DELIVERED':
      return { container: 'bg-green-100 border-green-200', text: 'text-green-800' };
    case 'REJECTED':
    case 'CANCELLED':
      return { container: 'bg-red-100 border-red-200', text: 'text-red-800' };
    default:
      return { container: 'bg-gray-100 border-gray-200', text: 'text-gray-800' };
  }
}

function translateStatus(status: string) {
  switch (status.toUpperCase()) {
    case 'PENDING':
    case 'PENDING_REVIEW':
      return 'Chờ duyệt';
    case 'QUOTING':
      return 'Đang báo giá';
    case 'CONTRACT_PENDING':
      return 'Chờ hợp đồng';
    case 'CONTRACT_SIGNED':
      return 'Đã ký HĐ';
    case 'ASSIGNED':
      return 'Đã phân xe';
    case 'IN_TRANSIT':
      return 'Đang giao';
    case 'DELIVERED':
      return 'Đã giao';
    case 'REJECTED':
      return 'Từ chối';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return status;
  }
}

function getOrderImageUrl(order: OrderResponse) {
  const rawUrl =
    order.documents?.find((doc) => doc.docType === 'CargoImage')?.imageUrl ??
    order.documents?.[0]?.imageUrl ??
    order.documentUrl;

  if (!rawUrl) {
    return null;
  }

  if (rawUrl.startsWith('http')) {
    return rawUrl;
  }

  return `${API_BASE_URL}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa cập nhật';
}

function formatTemperature(value: string | number) {
  const text = String(value);
  return text.includes('°') ? text : `${text} °C`;
}

function getLatestQuotationStatus(order: OrderResponse) {
  return order.quotations?.[0]?.status ?? null;
}

function isContractSigned(status: string) {
  return status.toUpperCase() === 'CONTRACT_SIGNED';
}
