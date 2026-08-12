import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppPressable as Pressable } from '../../components/AppPressable';
import { colors } from '../../constants/colors';
import { getApiErrorMessage } from '../../services/apiClient';
import { customerApi, CustomerResponse } from '../../services/customerApi';
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
          const data = await customerApi.getCustomerById(customerId);
          if (!isActive) return;
          setCustomer(data);
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
      className="flex-1"
      style={{ backgroundColor: colors.surface.page }}
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

      <View style={{ backgroundColor: colors.surface.card }} className="mt-6 rounded-2xl p-5 shadow-sm">
        <View style={{ borderBottomColor: colors.border.default }} className="mb-4 flex-row items-center gap-2 border-b pb-3">
          <Ionicons name="information-circle-outline" size={20} color={colors.brand.primary} />
          <Text style={{ color: colors.text.primary }} className="text-base font-bold">Thông tin tài khoản</Text>
        </View>

        {isLoadingCustomer ? (
          <View className="items-center py-6">
            <ActivityIndicator color={colors.brand.primary} size="small" />
            <Text style={{ color: colors.text.secondary }} className="mt-3 text-sm">Đang tải thông tin...</Text>
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

      <Pressable
        onPress={() => router.push('/(customer)/change-password' as any)}
        style={({ pressed }) => ({
          backgroundColor: colors.surface.card,
          opacity: pressed ? 0.7 : 1,
        })}
        className="mt-6 flex-row items-center justify-between rounded-2xl p-5 shadow-sm"
      >
        <View className="flex-row items-center gap-3">
          <View style={{ backgroundColor: colors.brand.primarySoft }} className="rounded-full p-2">
            <Ionicons name="lock-closed-outline" size={20} color={colors.brand.primary} />
          </View>
          <Text style={{ color: colors.text.primary }} className="text-base font-bold">Đổi mật khẩu</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
      </Pressable>

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
    <View style={{ backgroundColor: colors.surface.card }} className="items-center rounded-3xl p-6 shadow-sm">
      <View style={{ backgroundColor: colors.brand.primarySoft }} className="mb-4 h-20 w-20 items-center justify-center rounded-full">
        <Ionicons name="person" size={40} color={colors.brand.primary} />
      </View>
      
      <Text style={{ color: colors.text.primary }} className="mb-1 text-center text-xl font-bold">{name}</Text>
      <Text style={{ color: colors.text.secondary }} className="mb-4 text-center text-sm">{email}</Text>
      
      <View className="flex-row flex-wrap justify-center gap-2">
        <View style={{ backgroundColor: colors.surface.muted }} className="rounded-full px-3 py-1">
          <Text style={{ color: colors.brand.primary }} className="text-xs font-semibold">{role}</Text>
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
        <View style={{ backgroundColor: colors.surface.muted }} className="mt-4 w-full flex-row items-center justify-center gap-2 rounded-xl p-3">
          <Ionicons name="business" size={16} color={colors.text.secondary} />
          <Text style={{ color: colors.text.primary }} className="text-sm font-medium">{companyName}</Text>
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
      <Text style={{ color: colors.text.secondary }} className="text-sm font-medium">{label}</Text>
      <Text 
        style={{ color: colors.text.primary }}
        className="flex-1 text-right text-sm font-semibold"
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
