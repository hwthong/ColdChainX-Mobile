import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  
  const accessToken = useAuthStore(state => state.token);
  const logout = useAuthStore(state => state.logout);

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!currentPassword) {
      setError('Mật khẩu hiện tại không được để trống.');
      return;
    }
    if (!newPassword) {
      setError('Mật khẩu mới không được để trống.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu không khớp.');
      return;
    }

    if (!accessToken) {
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await changePassword(accessToken, { currentPassword, newPassword });

      if (response.success) {
        // Clear forms immediately for security
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

        Alert.alert(
          'Thành công',
          'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await logout();
                router.replace('/login');
              }
            }
          ]
        );
      } else {
        handleApiError(response.message || 'Lỗi không xác định.');
      }
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiError = (err: any) => {
    let msg = typeof err === 'string' ? err : getApiErrorMessage(err);
    
    // Map backend messages to specific requirements if needed
    if (msg.includes('Current password is incorrect')) {
      msg = 'Mật khẩu hiện tại không chính xác.';
    } else if (msg.includes('New password must be different from current password')) {
      msg = 'Mật khẩu mới phải khác mật khẩu hiện tại.';
    }

    if (err?.status === 401 || msg.toLowerCase().includes('unauthorized') || msg.includes('Invalid token')) {
      Alert.alert('Hết hạn', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', [
        {
          text: 'OK',
          onPress: async () => {
            await logout();
            router.replace('/login');
          }
        }
      ]);
    } else if (err?.status >= 500) {
      setError('Không thể đổi mật khẩu lúc này. Vui lòng thử lại.');
    } else {
      setError(msg || 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#F5F2F0]"
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <Text className="mb-4 text-base font-bold text-[#3A1F04]">Nhập mật khẩu mới</Text>

          {/* Current Password */}
          <View className="mb-4">
            <Text className="mb-1 text-sm font-medium text-[#877369]">Mật khẩu hiện tại <Text className="text-red-500">*</Text></Text>
            <View className="flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-3 h-12">
              <TextInput
                className="flex-1 text-[#3A1F04]"
                secureTextEntry={!showCurrentPassword}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Nhập mật khẩu hiện tại"
                placeholderTextColor="#A99B94"
                editable={!isLoading}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowCurrentPassword(!showCurrentPassword)} className="p-2">
                <Ionicons name={showCurrentPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#877369" />
              </Pressable>
            </View>
          </View>

          {/* New Password */}
          <View className="mb-4">
            <Text className="mb-1 text-sm font-medium text-[#877369]">Mật khẩu mới <Text className="text-red-500">*</Text></Text>
            <View className="flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-3 h-12">
              <TextInput
                className="flex-1 text-[#3A1F04]"
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Nhập mật khẩu mới"
                placeholderTextColor="#A99B94"
                editable={!isLoading}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowNewPassword(!showNewPassword)} className="p-2">
                <Ionicons name={showNewPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#877369" />
              </Pressable>
            </View>
            <Text className="mt-1 text-xs text-gray-500">Tối thiểu 8 ký tự.</Text>
          </View>

          {/* Confirm Password */}
          <View className="mb-4">
            <Text className="mb-1 text-sm font-medium text-[#877369]">Xác nhận mật khẩu mới <Text className="text-red-500">*</Text></Text>
            <View className="flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-3 h-12">
              <TextInput
                className="flex-1 text-[#3A1F04]"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Nhập lại mật khẩu mới"
                placeholderTextColor="#A99B94"
                editable={!isLoading}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} className="p-2">
                <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#877369" />
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
            className={`mt-2 flex-row items-center justify-center rounded-xl py-4 ${
              isLoading ? 'bg-gray-300' : 'bg-[#8B4513]'
            }`}
            style={({ pressed }) => ({ opacity: pressed && !isLoading ? 0.8 : 1 })}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" className="mr-2" />
            ) : null}
            <Text className="text-base font-bold text-white">
              {isLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
