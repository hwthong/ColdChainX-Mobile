import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getApiErrorMessage } from '../../services/apiClient';
import { getCustomerAsns } from '../../services/asnApi';
import { customerApi, CustomerOrderSummaryResponse } from '../../services/customerApi';
import { getCustomerIdFromToken } from '../../services/jwt';
import { useAuthStore } from '../../store/useAuthStore';

const ASN_TAB = 'ASN';
const ELIGIBLE_ASN_ORDER_STATUS = 'CONTRACT_SIGNED';
const ORDER_PAGE_SIZE = 100;
const TABS = [
  { key: ASN_TAB, label: 'Tạo ASN' },
  { key: 'WAITING', label: 'Chờ xử lý' },
  { key: 'IN_STOCK', label: 'Trong kho' },
  { key: 'TRANSIT', label: 'Đang giao' },
  { key: 'DELIVERED', label: 'Đã giao' },
  { key: 'RETURNED', label: 'Hoàn trả' },
  { key: 'CANCELLED', label: 'Đã hủy' },
];

export default function StatusScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.token);
  const storedCustomerId = useAuthStore((state) => state.customerId ?? state.user?.customerId ?? null);
  const customerId = storedCustomerId ?? (accessToken ? getCustomerIdFromToken(accessToken) : null);

  const [activeTab, setActiveTab] = useState(ASN_TAB);
  const [orders, setOrders] = useState<CustomerOrderSummaryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!accessToken) {
      setError('Phiên đăng nhập đã hết hạn.');
      setOrders([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setError(null);

      if (activeTab === ASN_TAB) {
        if (!customerId) {
          throw new Error('Không tìm thấy mã khách hàng trong phiên đăng nhập.');
        }

        const [eligibleOrders, asnResponse] = await Promise.all([
          getAllEligibleAsnOrders(),
          getCustomerAsns(accessToken, customerId),
        ]);

        if (!asnResponse.success) {
          throw new Error(asnResponse.message || 'Không thể kiểm tra các ASN đã tạo.');
        }

        const orderIdsWithAsn = new Set(
          (asnResponse.data ?? []).map((asn) => asn.orderId).filter(Boolean)
        );
        setOrders(eligibleOrders.filter((order) => !orderIdsWithAsn.has(order.orderId)));
      } else {
        const data = await customerApi.getMyOrdersByCategory(activeTab);
        setOrders(data || []);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
      setOrders([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken, activeTab, customerId]);

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

  const renderOrder = ({ item }: { item: CustomerOrderSummaryResponse }) => {
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
            <View className="h-20 w-20 items-center justify-center rounded-xl bg-[#F8F9FA]">
              <Ionicons name="cube-outline" size={24} color="#877369" />
            </View>

            <View className="flex-1 gap-2">
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 font-semibold text-[#3A1F04]">{item.itemName}</Text>
              </View>

              <View className="flex-row items-center gap-2">
                <Ionicons name="grid-outline" size={16} color="#8B4513" />
                <Text className="font-medium text-[#8B4513]">{item.category}</Text>
              </View>

              <View className="flex-row items-start gap-2">
                <Ionicons name="location-outline" size={16} color="#877369" />
                <Text className="flex-1 text-sm leading-5 text-[#877369]">
                  {item.destinationAddress || 'Chưa cập nhật địa chỉ'}
                </Text>
              </View>

              {item.routeCode ? (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="git-branch-outline" size={16} color="#8B4513" />
                  <Text className="flex-1 text-sm font-semibold text-[#8B4513]">
                    {item.routeCode}
                  </Text>
                </View>
              ) : null}

              {activeTab === ASN_TAB ? (
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    router.push({
                      pathname: '/(customer)/schedule-delivery',
                      params: { orderId: item.orderId },
                    } as never);
                  }}
                  className="mt-2 flex-row items-center justify-center gap-2 rounded-xl bg-[#8B4513] px-4 py-3"
                >
                  <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
                  <Text className="font-bold text-white">Tạo ASN</Text>
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
      {/* TABS */}
      <View className="bg-white px-2 pt-2 shadow-sm z-10">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`rounded-full px-5 py-2.5 ${activeTab === tab.key ? 'bg-[#8B4513]' : 'bg-gray-100'}`}
            >
              <Text className={`font-bold ${activeTab === tab.key ? 'text-white' : 'text-gray-600'}`}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

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
                {activeTab === ASN_TAB
                  ? 'Không có đơn đã ký hợp đồng và chưa tạo ASN.'
                  : 'Bạn chưa có đơn hàng nào.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

async function getAllEligibleAsnOrders() {
  const firstPage = await customerApi.getMyOrders(
    1,
    ORDER_PAGE_SIZE,
    ELIGIBLE_ASN_ORDER_STATUS
  );
  const remainingPageNumbers = Array.from(
    { length: Math.max(0, firstPage.totalPages - 1) },
    (_, index) => index + 2
  );
  const remainingPages = await Promise.all(
    remainingPageNumbers.map((pageNumber) =>
      customerApi.getMyOrders(pageNumber, ORDER_PAGE_SIZE, ELIGIBLE_ASN_ORDER_STATUS)
    )
  );

  return [
    ...(firstPage.data ?? []),
    ...remainingPages.flatMap((page) => page.data ?? []),
  ];
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
    case 'LOADING':
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
    case 'LOADING':
      return 'Đang chuẩn bị xuất kho';
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

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa cập nhật';
}
