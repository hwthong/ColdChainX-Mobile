import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../constants/colors';
import { getApiErrorMessage } from '../../services/apiClient';
import { getCustomerAsns, type AsnResponse } from '../../services/asnApi';
import { customerApi, CustomerOrderSummaryResponse } from '../../services/customerApi';
import { getCustomerIdFromToken } from '../../services/jwt';
import { useAuthStore } from '../../store/useAuthStore';
import {
  CUSTOMER_ORDER_TABS,
  CustomerOrderTabGroupKey,
  getCustomerOrderActionPriority,
  getCustomerOrderCategoryLabel,
  getCustomerOrderStatusPresentation,
  getCustomerOrderTabGroup,
} from '../../constants/customerOrderPresentation';

const ORDER_PAGE_SIZE = 100;

export default function StatusScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const accessToken = useAuthStore((state) => state.token);
  const storedCustomerId = useAuthStore((state) => state.customerId ?? state.user?.customerId ?? null);
  const customerId = storedCustomerId ?? (accessToken ? getCustomerIdFromToken(accessToken) : null);

  const [activeTab, setActiveTab] = useState<CustomerOrderTabGroupKey>('ALL');
  const [allOrders, setAllOrders] = useState<CustomerOrderSummaryResponse[]>([]);
  const [asnsByOrderId, setAsnsByOrderId] = useState<Record<string, AsnResponse>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncActiveTabFromParams = useCallback(() => {
    if (params.tab) {
      const normalizedTab = params.tab.toUpperCase() as CustomerOrderTabGroupKey;
      if (CUSTOMER_ORDER_TABS.some((t) => t.key === normalizedTab)) {
        setActiveTab(normalizedTab);
      }
    }
  }, [params.tab]);

  useEffect(() => {
    syncActiveTabFromParams();
  }, [syncActiveTabFromParams]);

  const fetchOrders = useCallback(async () => {
    if (!accessToken) {
      setError('Phiên đăng nhập đã hết hạn.');
      setAllOrders([]);
      setAsnsByOrderId({});
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setError(null);
      if (!customerId) {
        throw new Error('Không tìm thấy mã khách hàng để kiểm tra ASN hiện có.');
      }

      const [orders, asnResponse] = await Promise.all([
        fetchAllCustomerOrders(),
        getCustomerAsns(accessToken, customerId),
      ]);

      if (!asnResponse.success) {
        throw new Error(asnResponse.message || 'Không thể kiểm tra ASN hiện có.');
      }

      setAllOrders(orders);
      setAsnsByOrderId(buildAsnsByOrderId(asnResponse.data ?? []));
    } catch (err) {
      setError(getApiErrorMessage(err));
      setAllOrders([]);
      setAsnsByOrderId({});
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken, customerId]);

  useFocusEffect(
    useCallback(() => {
      syncActiveTabFromParams();
      setIsLoading(true);
      void fetchOrders();
    }, [fetchOrders, syncActiveTabFromParams])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    void fetchOrders();
  };

  const actionRequiredCount = useMemo(
    () => allOrders.filter((o) => getCustomerOrderTabGroup(o.status) === 'ACTION_REQUIRED').length,
    [allOrders]
  );

  const displayedOrders = useMemo(() => {
    let filtered = allOrders;
    if (activeTab !== 'ALL') {
      filtered = allOrders.filter((o) => getCustomerOrderTabGroup(o.status) === activeTab);
    }

    return [...filtered].sort((a, b) => {
      const priorityA = getCustomerOrderActionPriority(a.status);
      const priorityB = getCustomerOrderActionPriority(b.status);
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [allOrders, activeTab]);

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'ACTION_REQUIRED':
        return 'Không có đơn hàng nào cần bạn xử lý lúc này.';
      case 'WAITING':
        return 'Không có đơn hàng nào đang chờ xử lý.';
      case 'TRANSIT':
        return 'Không có đơn hàng nào đang vận chuyển.';
      case 'COMPLETED':
        return 'Chưa có đơn hàng nào hoàn tất.';
      default:
        return 'Bạn chưa có đơn hàng nào.';
    }
  };

  const renderOrder = ({ item }: { item: CustomerOrderSummaryResponse }) => {
    const categoryLabel = getCustomerOrderCategoryLabel(item.category);
    const isNeedsUpdate = item.status?.trim().toUpperCase() === 'NEEDS_UPDATE';
    const isContractSigned = item.status?.trim().toUpperCase() === 'CONTRACT_SIGNED';
    const existingAsn = asnsByOrderId[getOrderIdKey(item.orderId)];

    return (
      <Pressable
        onPress={() => router.push(`/(customer)/orders/${item.orderId}` as never)}
        style={{
          backgroundColor: colors.surface.card,
          borderColor: isNeedsUpdate ? 'rgba(249, 115, 22, 0.4)' : colors.border.default,
        }}
        className="mb-4 overflow-hidden rounded-2xl border shadow-sm"
      >
        <View className="p-5">
          <View className="mb-3 flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text style={{ color: colors.brand.primary }} className="text-lg font-bold">
                {item.trackingCode}
              </Text>
              <Text style={{ color: colors.text.muted }} className="mt-1 text-xs">
                {formatDate(item.createdAt)}
              </Text>
            </View>
            <StatusBadge status={item.status} />
          </View>

          <View className="flex-row gap-3">
            <View
              style={{ backgroundColor: colors.surface.muted }}
              className="h-20 w-20 items-center justify-center rounded-xl"
            >
              <Ionicons name="cube-outline" size={24} color={colors.brand.primary} />
            </View>

            <View className="flex-1 gap-2">
              <View className="flex-row items-center gap-2">
                <Text style={{ color: colors.text.primary }} className="flex-1 font-semibold">
                  {item.itemName}
                </Text>
              </View>

              {categoryLabel ? (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="grid-outline" size={16} color={colors.brand.primary} />
                  <Text style={{ color: colors.brand.primary }} className="font-medium">
                    {categoryLabel}
                  </Text>
                </View>
              ) : null}

              {item.destinationAddress ? (
                <View className="flex-row items-start gap-2">
                  <Ionicons name="location-outline" size={16} color={colors.text.secondary} />
                  <Text style={{ color: colors.text.secondary }} className="flex-1 text-sm leading-5">
                    {item.destinationAddress}
                  </Text>
                </View>
              ) : null}

              {item.routeCode ? (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="git-branch-outline" size={16} color={colors.brand.primary} />
                  <Text style={{ color: colors.brand.primary }} className="flex-1 text-sm font-semibold">
                    {item.routeCode}
                  </Text>
                </View>
              ) : null}

              {/* Action Banner for NEEDS_UPDATE */}
              {isNeedsUpdate ? (
                <View
                  style={{
                    backgroundColor: '#FFF7ED',
                    borderColor: '#FDBA74',
                    borderWidth: 1,
                    borderRadius: 12,
                  }}
                  className="mt-2 flex-row items-center justify-between px-3.5 py-2.5"
                >
                  <View className="flex-1 flex-row items-center gap-2">
                    <Ionicons name="alert-circle" size={18} color="#EA580C" />
                    <Text className="flex-1 text-xs font-semibold text-orange-800">
                      Đơn cần cập nhật theo yêu cầu của Sales
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#EA580C" />
                </View>
              ) : null}

              {/* Action Button for CONTRACT_SIGNED -> Tạo/Xem ASN */}
              {isContractSigned ? (
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    router.push({
                      pathname: '/(customer)/schedule-delivery',
                      params: existingAsn
                        ? { orderId: item.orderId, asnId: existingAsn.asnId }
                        : { orderId: item.orderId },
                    } as never);
                  }}
                  style={{ backgroundColor: colors.brand.primary }}
                  className="mt-2 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3"
                >
                  <Ionicons name="document-text-outline" size={18} color={colors.text.onPrimary} />
                  <Text style={{ color: colors.text.onPrimary }} className="font-bold">
                    {existingAsn ? 'Xem ASN' : 'Tạo ASN giao kho'}
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
      <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.brand.primary }} className="mt-4 font-medium">
          Đang tải danh sách...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.surface.page }} className="flex-1">
      {/* 5 TABS */}
      <View
        style={{ backgroundColor: colors.surface.card, borderBottomColor: colors.border.default }}
        className="z-10 border-b px-2 pt-2 shadow-sm"
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}
        >
          {CUSTOMER_ORDER_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const showBadge = tab.key === 'ACTION_REQUIRED' && actionRequiredCount > 0;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{ backgroundColor: isActive ? colors.brand.primary : colors.surface.muted }}
                className="flex-row items-center rounded-full px-5 py-2.5"
              >
                <Text
                  style={{ color: isActive ? colors.text.onPrimary : colors.text.secondary }}
                  className="font-bold"
                >
                  {tab.label}
                </Text>
                {showBadge ? (
                  <View
                    style={{
                      backgroundColor: isActive ? '#FFFFFF' : '#FFEDD5',
                      marginLeft: 6,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 999,
                    }}
                  >
                    <Text
                      style={{
                        color: isActive ? colors.brand.primary : '#C2410C',
                        fontSize: 11,
                        fontWeight: '700',
                      }}
                    >
                      {actionRequiredCount}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="alert-circle-outline" size={48} color={colors.status.danger.main} />
          <Text
            style={{ color: colors.status.danger.main }}
            className="mt-4 text-center font-medium leading-6"
          >
            {error}
          </Text>
          <Pressable
            onPress={fetchOrders}
            style={{ backgroundColor: colors.brand.primary }}
            className="mt-4 rounded-xl px-6 py-3"
          >
            <Text style={{ color: colors.text.onPrimary }} className="font-bold">
              Thử lại
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={displayedOrders}
          keyExtractor={(item) => item.orderId}
          renderItem={renderOrder}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand.primary}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="document-text-outline" size={64} color={colors.text.muted} />
              <Text style={{ color: colors.text.secondary }} className="mt-4 text-center font-medium">
                {getEmptyMessage()}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

async function fetchAllCustomerOrders(): Promise<CustomerOrderSummaryResponse[]> {
  const firstPage = await customerApi.getMyOrders(1, ORDER_PAGE_SIZE);
  const totalPages = firstPage?.totalPages ?? 1;
  if (totalPages <= 1) {
    return firstPage?.data ?? [];
  }
  const remainingPageNumbers = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
  const remainingPages = await Promise.all(
    remainingPageNumbers.map((pageNumber) => customerApi.getMyOrders(pageNumber, ORDER_PAGE_SIZE))
  );

  return [
    ...(firstPage.data ?? []),
    ...remainingPages.flatMap((page) => page.data ?? []),
  ];
}

function buildAsnsByOrderId(asns: AsnResponse[]) {
  return asns.reduce<Record<string, AsnResponse>>((byOrderId, asn) => {
    const orderIdKey = getOrderIdKey(asn.orderId);
    if (orderIdKey) {
      byOrderId[orderIdKey] = asn;
    }

    return byOrderId;
  }, {});
}

function getOrderIdKey(orderId?: string | null) {
  return orderId?.trim().toLowerCase() ?? '';
}

function StatusBadge({ status }: { status: string }) {
  const presentation = getCustomerOrderStatusPresentation(status);

  return (
    <View className={`rounded-full border px-2.5 py-1 ${presentation.containerClass}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${presentation.textClass}`}>
        {presentation.label}
      </Text>
    </View>
  );
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa cập nhật';
}
