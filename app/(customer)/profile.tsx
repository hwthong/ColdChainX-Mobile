import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
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

  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc muốn đăng xuất?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng xuất', style: 'destructive', onPress: logout },
      ]
    );
  };

  const displayName = fullName || user?.fullName || 'Khách hàng';
  const displayEmail = email || customer?.email || 'Chưa có email';
  const displayRole = translateRole(role);
  const displayCompany = customer?.companyName;

  return (
    <ScrollView 
      className="flex-1 bg-[#F5F2F0]" 
      contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <ProfileHeroCard 
        name={displayName} 
        email={displayEmail} 
        role={displayRole} 
        status={customer?.status} 
        companyName={displayCompany}
      />

      <View className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <View className="mb-4 flex-row items-center gap-2 border-b border-gray-100 pb-3">
          <Ionicons name="information-circle-outline" size={20} color="#8B4513" />
          <Text className="text-base font-bold text-[#3A1F04]">Thông tin tài khoản</Text>
        </View>

        {isLoadingCustomer ? (
          <View className="items-center py-6">
            <ActivityIndicator color="#8B4513" size="small" />
            <Text className="mt-3 text-sm text-[#877369]">Đang tải thông tin...</Text>
          </View>
        ) : (
          <View className="gap-4">
            <InfoRow label="Họ tên" value={displayName} />
            <InfoRow label="Email" value={displayEmail} />
            <InfoRow label="Vai trò" value={displayRole} />
            <InfoRow 
              label="Mã khách hàng" 
              value={customerId || 'Chưa có'} 
              valueProps={{ numberOfLines: 1, ellipsizeMode: 'middle' }}
            />
            <InfoRow label="Công ty" value={customer?.companyName || 'Chưa cập nhật'} />
            <InfoRow label="Mã số thuế" value={customer?.taxCode || 'Chưa cập nhật'} />
          </View>
        )}

        {error ? (
          <View className="mt-4 rounded-lg bg-red-50 p-3">
            <Text className="text-sm font-medium text-red-600">{error}</Text>
          </View>
        ) : null}
      </View>

      <LogoutButton onPress={handleLogout} />
    </ScrollView>
  );
}

function ProfileHeroCard({ 
  name, 
  email, 
  role, 
  status, 
  companyName 
}: { 
  name: string; 
  email: string; 
  role: string; 
  status?: string; 
  companyName?: string; 
}) {
  const isActive = status === 'ACTIVE' || status === 'Đang hoạt động';

  return (
    <View className="items-center rounded-3xl bg-white p-6 shadow-sm">
      <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-[#8B4513]/10">
        <Ionicons name="person" size={40} color="#8B4513" />
      </View>
      
      <Text className="mb-1 text-center text-xl font-bold text-[#3A1F04]">{name}</Text>
      <Text className="mb-4 text-center text-sm text-[#877369]">{email}</Text>
      
      <View className="flex-row flex-wrap justify-center gap-2">
        <View className="rounded-full bg-[#F5F2F0] px-3 py-1">
          <Text className="text-xs font-semibold text-[#8B4513]">{role}</Text>
        </View>
        {status ? (
          <View className={`rounded-full px-3 py-1 ${isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
            <Text className={`text-xs font-semibold ${isActive ? 'text-green-700' : 'text-gray-700'}`}>
              {isActive ? 'Đang hoạt động' : status}
            </Text>
          </View>
        ) : null}
      </View>

      {companyName ? (
        <View className="mt-4 w-full flex-row items-center justify-center gap-2 rounded-xl bg-[#F5F2F0]/50 p-3">
          <Ionicons name="business" size={16} color="#877369" />
          <Text className="text-sm font-medium text-[#3A1F04]">{companyName}</Text>
        </View>
      ) : null}
    </View>
  );
}

function InfoRow({ 
  label, 
  value, 
  valueProps 
}: { 
  label: string; 
  value: string; 
  valueProps?: React.ComponentProps<typeof Text> 
}) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text className="text-sm font-medium text-[#877369]">{label}</Text>
      <Text 
        className="flex-1 text-right text-sm font-semibold text-[#3A1F04]" 
        {...valueProps}
      >
        {value}
      </Text>
    </View>
  );
}

function LogoutButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable 
      onPress={onPress} 
      className="mt-8 flex-row items-center justify-center gap-2 rounded-2xl bg-red-50 py-4 shadow-sm"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Ionicons name="log-out-outline" size={20} color="#DC2626" />
      <Text className="text-base font-bold text-red-600">Đăng xuất</Text>
    </Pressable>
  );
}

function translateRole(role: string | null) {
  switch (role) {
    case 'CUSTOMER':
      return 'Khách hàng';
    case 'DRIVER':
      return 'Tài xế';
    default:
      return 'Chưa xác định';
  }
}
