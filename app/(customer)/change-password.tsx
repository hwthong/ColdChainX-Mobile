import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuthStore } from '../../store/useAuthStore';
import { changePassword } from '../../services/authApi';
import { getApiErrorMessage } from '../../services/apiClient';

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const accessToken = useAuthStore((state) => state.token);

  const handleSubmit = async () => {
    setError(null);

    if (!currentPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    if (!newPassword) {
      setError('Vui lòng nhập mật khẩu mới.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    if (!accessToken) {
      setError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await changePassword(accessToken, {
        currentPassword,
        newPassword,
      });

      if (res.success) {
        Alert.alert(
          'Thành công',
          'Đổi mật khẩu thành công.',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        setError(res.message || 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.');
      }
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setError(msg || 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
      style={{ backgroundColor: colors.surface.page }}
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ backgroundColor: colors.surface.card }} className="mb-6 rounded-2xl p-5 shadow-sm">
          <Text style={{ color: colors.text.primary }} className="mb-4 text-base font-bold">Nhập mật khẩu mới</Text>

          {/* Current Password */}
          <View className="mb-4">
            <Text style={{ color: colors.text.secondary }} className="mb-1 text-sm font-medium">Mật khẩu hiện tại <Text className="text-red-500">*</Text></Text>
            <View style={{ borderColor: colors.border.default, backgroundColor: colors.surface.card }} className="flex-row items-center rounded-xl border px-3 h-12">
              <TextInput
                className="flex-1"
                style={{ color: colors.text.primary }}
                secureTextEntry={!showCurrentPassword}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Nhập mật khẩu hiện tại"
                placeholderTextColor={colors.text.muted}
                editable={!isLoading}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowCurrentPassword(!showCurrentPassword)} className="p-2">
                <Ionicons name={showCurrentPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.text.secondary} />
              </Pressable>
            </View>
          </View>

          {/* New Password */}
          <View className="mb-4">
            <Text style={{ color: colors.text.secondary }} className="mb-1 text-sm font-medium">Mật khẩu mới <Text className="text-red-500">*</Text></Text>
            <View style={{ borderColor: colors.border.default, backgroundColor: colors.surface.card }} className="flex-row items-center rounded-xl border px-3 h-12">
              <TextInput
                className="flex-1"
                style={{ color: colors.text.primary }}
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Nhập mật khẩu mới"
                placeholderTextColor={colors.text.muted}
                editable={!isLoading}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowNewPassword(!showNewPassword)} className="p-2">
                <Ionicons name={showNewPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.text.secondary} />
              </Pressable>
            </View>
            <Text style={{ color: colors.text.muted }} className="mt-1 text-xs">Tối thiểu 8 ký tự.</Text>
          </View>

          {/* Confirm Password */}
          <View className="mb-4">
            <Text style={{ color: colors.text.secondary }} className="mb-1 text-sm font-medium">Xác nhận mật khẩu mới <Text className="text-red-500">*</Text></Text>
            <View style={{ borderColor: colors.border.default, backgroundColor: colors.surface.card }} className="flex-row items-center rounded-xl border px-3 h-12">
              <TextInput
                className="flex-1"
                style={{ color: colors.text.primary }}
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Nhập lại mật khẩu mới"
                placeholderTextColor={colors.text.muted}
                editable={!isLoading}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} className="p-2">
                <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.text.secondary} />
              </Pressable>
            </View>
          </View>

          {/* Error Message */}
          {error ? (
            <View className="mb-4 rounded-lg bg-red-50 p-3">
              <Text className="text-sm font-medium text-red-600">{error}</Text>
            </View>
          ) : null}

          {/* Submit Button */}
          <Pressable
            onPress={handleSubmit}
            disabled={isLoading}
            style={({ pressed }) => ({
              backgroundColor: isLoading ? '#cbd5e1' : pressed ? colors.brand.primaryPressed : colors.brand.primary,
              opacity: pressed && !isLoading ? 0.8 : 1,
            })}
            className="mt-2 flex-row items-center justify-center rounded-xl py-4"
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text.onPrimary} size="small" className="mr-2" />
            ) : null}
            <Text style={{ color: colors.text.onPrimary }} className="text-base font-bold">
              {isLoading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
