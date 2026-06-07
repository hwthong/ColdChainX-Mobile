import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AuthBackground } from '../../components/AuthBackground';
import { getApiErrorMessage } from '../../services/apiClient';
import {
  BackendRole,
  DEFAULT_REGISTER_ROLE,
  getMobileRoleFromBackend,
  mapBackendRoleToAppRole,
  register as registerApi,
} from '../../services/authApi';
import { useAuthStore } from '../../store/useAuthStore';

const REGISTER_ROLE_OPTIONS: { label: string; value: BackendRole.Customer | BackendRole.Driver }[] = [
  { label: 'Customer', value: BackendRole.Customer },
  { label: 'Driver', value: BackendRole.Driver },
];

export default function RegisterScreen() {
  const router = useRouter();
  const saveAuth = useAuthStore((state) => state.login);
  const [selectedRole, setSelectedRole] = useState<BackendRole.Customer | BackendRole.Driver>(
    DEFAULT_REGISTER_ROLE
  );
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = async () => {
    setErrorMessage(null);

    if (!acceptedTerms) {
      setErrorMessage('Vui lòng đồng ý với điều khoản trước khi tạo tài khoản.');
      return;
    }

    if (!fullName.trim() || !email.trim() || !password) {
      setErrorMessage('Vui lòng nhập tên, email và mật khẩu.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await registerApi({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim() || null,
        email: email.trim(),
        password,
        role: selectedRole,
      });

      if (!response.success) {
        throw new Error(response.message ?? 'Đăng ký thất bại.');
      }

      const authData = response.data;
      if (authData?.accessToken) {
        const appRole =
          getMobileRoleFromBackend(authData.role) ?? mapBackendRoleToAppRole(selectedRole);

        saveAuth({
          token: authData.accessToken,
          refreshToken: authData.refreshToken,
          accessTokenExpiresAt: authData.accessTokenExpiresAt,
          role: appRole,
          user: {
            userId: authData.userId,
            fullName: authData.fullName,
            email: authData.email ?? email.trim(),
            backendRole: authData.role ?? selectedRole,
          },
        });
        return;
      }

      router.replace('/(auth)/login');
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthBackground>
      <View className="absolute left-0 right-0 top-0 z-10 h-16 flex-row items-center px-5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'flex-end',
            paddingHorizontal: 20,
            paddingTop: 112,
            paddingBottom: 32,
          }}
        >
          <View className="w-full max-w-[448px] self-center pb-6 gap-6">
            <View className="w-full pb-3">
              <View className="w-full px-2 gap-1">
                <Text
                  className="text-white text-2xl leading-8 font-bold"
                  style={{
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.13,
                    shadowRadius: 4,
                  }}
                >
                  Đăng ký
                </Text>
                <Text className="text-white/70 text-base leading-6 font-normal">
                  Bắt đầu hành trình ColdChainX của bạn
                </Text>
              </View>
            </View>

            <View className="w-full rounded-2xl bg-white/10 border border-white/10 p-6 shadow-xl gap-3">
              <View className="h-11 w-full flex-row rounded-xl border border-white/20 bg-white/10 p-1">
                {REGISTER_ROLE_OPTIONS.map((option) => {
                  const isSelected = selectedRole === option.value;

                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setSelectedRole(option.value)}
                      className={[
                        'h-full flex-1 items-center justify-center rounded-lg',
                        isSelected ? 'bg-[#75FF68]' : '',
                      ].join(' ')}
                    >
                      <Text
                        className={[
                          'text-sm font-semibold',
                          isSelected ? 'text-[#002201]' : 'text-white/75',
                        ].join(' ')}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View className="relative h-14 w-full justify-center">
                <View className="h-14 w-full flex-row items-center rounded-xl bg-[#F8F9FA] px-3 shadow-sm">
                  <Ionicons name="person-outline" size={18} color="#877369" className="mr-3" />
                  <TextInput
                    placeholder="Tên đầy đủ / Doanh nghiệp"
                    placeholderTextColor="#877369"
                    returnKeyType="next"
                    value={fullName}
                    onChangeText={setFullName}
                    className="flex-1 text-[#877369] text-base leading-[19px]"
                  />
                </View>
              </View>

              <View className="relative h-14 w-full justify-center">
                <View className="h-14 w-full flex-row items-center rounded-xl bg-[#F8F9FA] px-3 shadow-sm">
                  <Ionicons name="call-outline" size={20} color="#877369" className="mr-3" />
                  <TextInput
                    keyboardType="phone-pad"
                    placeholder="Số điện thoại"
                    placeholderTextColor="#877369"
                    returnKeyType="next"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    className="flex-1 text-[#877369] text-base leading-[19px]"
                  />
                </View>
              </View>

              <View className="relative h-14 w-full justify-center">
                <View className="h-14 w-full flex-row items-center rounded-xl bg-[#F8F9FA] px-3 shadow-sm">
                  <Ionicons name="mail-outline" size={22} color="#877369" className="mr-3" />
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="Email"
                    placeholderTextColor="#877369"
                    returnKeyType="next"
                    value={email}
                    onChangeText={setEmail}
                    className="flex-1 text-[#877369] text-base leading-[19px]"
                  />
                </View>
              </View>

              <View className="relative h-14 w-full justify-center">
                <View className="h-14 w-full flex-row items-center rounded-xl bg-[#F8F9FA] px-3 shadow-sm">
                  <Ionicons name="lock-closed-outline" size={22} color="#877369" className="mr-3" />
                  <TextInput
                    placeholder="Mật khẩu"
                    placeholderTextColor="#877369"
                    returnKeyType="done"
                    secureTextEntry={!passwordVisible}
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={handleRegister}
                    className="flex-1 pr-3 text-[#877369] text-base leading-[19px]"
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onPress={() => setPasswordVisible((value) => !value)}
                    className="h-full w-7 items-center justify-center"
                  >
                    <Ionicons
                      name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#877369"
                    />
                  </Pressable>
                </View>
              </View>

              <View className="w-full pt-1">
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acceptedTerms }}
                  onPress={() => setAcceptedTerms((value) => !value)}
                  className="w-full flex-row items-start gap-3"
                >
                  <View className="pt-0.5">
                    <View
                      className={[
                        'h-5 w-5 items-center justify-center rounded border-2',
                        acceptedTerms ? 'border-[#75FF68] bg-[#75FF68]' : 'border-white/50',
                      ].join(' ')}
                    >
                      {acceptedTerms ? (
                        <Ionicons name="checkmark" size={14} color="#002201" />
                      ) : null}
                    </View>
                  </View>

                  <Text className="flex-1 text-xs leading-4 font-medium text-white/70">
                    Tôi đồng ý với <Text className="text-white/90 underline">Điều khoản</Text>
                    {'\n'}và <Text className="text-white/90 underline">Chính sách bảo mật</Text>
                  </Text>
                </Pressable>
              </View>

              {errorMessage ? (
                <Text className="text-sm leading-5 text-red-200">{errorMessage}</Text>
              ) : null}

              <View className="w-full pt-3">
                <Pressable
                  accessibilityRole="button"
                  onPress={handleRegister}
                  disabled={isLoading}
                  className={[
                    'h-14 w-full items-center justify-center rounded-xl bg-[#75FF68]',
                    isLoading ? 'opacity-70' : '',
                  ].join(' ')}
                  style={{
                    shadowColor: '#75FF68',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 14,
                  }}
                >
                  <Text className="text-[#002201] text-sm leading-5 font-semibold uppercase tracking-[0.7px]">
                    {isLoading ? 'ĐANG TẠO...' : 'TẠO TÀI KHOẢN'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View className="w-full pt-0 items-center">
              <Pressable accessibilityRole="link" onPress={() => router.replace('/(auth)/login')}>
                <Text className="text-center text-white/80 text-base leading-6 font-normal">
                  Đã có tài khoản? Đăng nhập
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}
