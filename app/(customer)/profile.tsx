import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getApiErrorMessage } from '../../services/apiClient';
import { getCustomerById, CustomerResponse } from '../../services/customerApi';
import { getCustomerIdFromToken } from '../../services/jwt';
import { useAuthStore } from '../../store/useAuthStore';

export default function ProfileScreen() {
  const logout = useAuthStore((state) => state.logout);
  const accessToken = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const fullName = useAuthStore((state) => state.fullName ?? state.user?.fullName ?? null);
  const email = useAuthStore((state) => state.email ?? state.user?.email ?? null);
  const role = useAuthStore((state) => state.role);
  const storedCustomerId = useAuthStore((state) => state.customerId ?? state.user?.customerId ?? null);
  const customerId = storedCustomerId ?? (accessToken ? getCustomerIdFromToken(accessToken) : null);

  const [customer, setCustomer] = useState<CustomerResponse | null>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function fetchCustomer() {
        if (!accessToken || !customerId) {
          setCustomer(null);
          return;
        }

        setIsLoadingCustomer(true);
        setError(null);

        try {
          const response = await getCustomerById(accessToken, customerId);
          if (!isActive) return;

          if (response.success && response.data) {
            setCustomer(response.data);
          } else {
            setError(response.message || 'Không thể tải thông tin khách hàng.');
          }
        } catch (err) {
          if (isActive) {
            setError(getApiErrorMessage(err));
          }
        } finally {
          if (isActive) {
            setIsLoadingCustomer(false);
          }
        }
      }

      fetchCustomer();

      return () => {
        isActive = false;
      };
    }, [accessToken, customerId])
  );

  const hasAccountInfo = Boolean(fullName || email || role || customerId || customer?.companyName);

  return (
    <ScrollView className="flex-1 bg-[#F5F2F0]" contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
      <View className="mb-5 rounded-3xl border border-[#DAC2B6]/50 bg-white p-6 shadow-sm">
        <View className="flex-row items-center gap-4">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-[#8B4513]/10">
            <Ionicons name="person-outline" size={30} color="#8B4513" />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-[#3A1F04]">{fullName || 'Khách hàng'}</Text>
            <Text className="mt-1 text-sm text-[#877369]">{email || customer?.email || 'Chưa có email'}</Text>
          </View>
        </View>
      </View>

      {!hasAccountInfo ? (
        <View className="mb-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
          <Text className="text-sm font-semibold leading-5 text-yellow-800">
            Thông tin tài khoản chưa được tải. Vui lòng đăng nhập lại.
          </Text>
        </View>
      ) : null}

      <View className="rounded-2xl border border-[#DAC2B6]/50 bg-white p-5 shadow-sm">
        <View className="mb-4 flex-row items-center gap-2 border-b border-[#DAC2B6]/30 pb-3">
          <Ionicons name="business-outline" size={18} color="#8B4513" />
          <Text className="text-base font-bold text-[#8B4513]">Thông tin tài khoản</Text>
        </View>

        {isLoadingCustomer ? (
          <View className="items-center py-5">
            <ActivityIndicator color="#8B4513" />
            <Text className="mt-3 text-sm text-[#877369]">Đang tải thông tin khách hàng...</Text>
          </View>
        ) : (
          <View className="gap-3">
            <InfoRow label="Họ tên" value={fullName || user?.fullName || 'Chưa cập nhật'} />
            <InfoRow label="Email" value={email || customer?.email || 'Chưa cập nhật'} />
            <InfoRow label="Vai trò" value={translateRole(role)} />
            <InfoRow label="Mã khách hàng" value={customerId || 'Chưa có'} />
            <InfoRow label="Công ty" value={customer?.companyName || 'Chưa tải'} />
            <InfoRow label="Mã số thuế" value={customer?.taxCode || 'Chưa tải'} />
            <InfoRow label="Trạng thái" value={customer?.status || 'Chưa tải'} />
          </View>
        )}

        {error ? <Text className="mt-4 text-sm font-medium leading-5 text-red-600">{error}</Text> : null}
      </View>

      <Pressable onPress={logout} className="mt-6 rounded-xl border border-red-200 bg-red-100 px-6 py-3">
        <Text className="text-center font-bold text-red-700">Đăng xuất</Text>
      </Pressable>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-sm text-[#877369]">{label}</Text>
      <Text className="flex-1 text-right text-sm font-semibold text-[#3A1F04]">{value}</Text>
    </View>
  );
}

function translateRole(role: string | null) {
  switch (role) {
    case 'CUSTOMER':
      return 'Customer';
    case 'DRIVER':
      return 'Driver';
    default:
      return 'Chưa xác định';
  }
}
