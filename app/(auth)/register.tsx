import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppPressable as Pressable } from '../../components/AppPressable';
import { AuthBackground } from '../../components/AuthBackground';
import { colors } from '../../constants/colors';
import { getApiErrorMessage } from '../../services/apiClient';
import { registerCustomer } from '../../services/authApi';

export default function RegisterScreen() {
  const router = useRouter();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxCode, setTaxCode] = useState('');
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

    if (!fullName.trim() || !companyName.trim() || !taxCode.trim() || !email.trim() || !password) {
      setErrorMessage('Vui lòng điền đầy đủ tên, công ty, mã số thuế, email và mật khẩu.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await registerCustomer({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phone: phoneNumber.trim() || undefined,
        companyName: companyName.trim(),
        taxCode: taxCode.trim(),
      });

      if (!response.success) {
        throw new Error(response.message ?? 'Đăng ký thất bại.');
      }

      Alert.alert('Thành công', 'Đăng ký tài khoản thành công', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') }
      ]);
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
          <Ionicons name="chevron-back" size={22} color={colors.brand.primaryForeground} />
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

            <View className="w-full rounded-2xl bg-slate-900/40 border border-white/10 p-6 shadow-xl gap-3">
              <View className="relative h-14 w-full justify-center">
                <View style={{ borderColor: colors.border.default }} className="h-14 w-full flex-row items-center rounded-xl bg-white px-3 border shadow-sm">
                  <Ionicons name="person-outline" size={18} color={colors.text.secondary} className="mr-3" />
                  <TextInput
                    placeholder="Tên người đại diện"
                    placeholderTextColor={colors.text.muted}
                    returnKeyType="next"
                    value={fullName}
                    onChangeText={setFullName}
                    style={{ color: colors.text.primary }}
                    className="flex-1 text-base leading-[19px]"
                  />
                </View>
              </View>

              <View className="relative h-14 w-full justify-center">
                <View style={{ borderColor: colors.border.default }} className="h-14 w-full flex-row items-center rounded-xl bg-white px-3 border shadow-sm">
                  <Ionicons name="business-outline" size={18} color={colors.text.secondary} className="mr-3" />
                  <TextInput
                    placeholder="Tên doanh nghiệp"
                    placeholderTextColor={colors.text.muted}
                    returnKeyType="next"
                    value={companyName}
                    onChangeText={setCompanyName}
                    style={{ color: colors.text.primary }}
                    className="flex-1 text-base leading-[19px]"
                  />
                </View>
              </View>

              <View className="relative h-14 w-full justify-center">
                <View style={{ borderColor: colors.border.default }} className="h-14 w-full flex-row items-center rounded-xl bg-white px-3 border shadow-sm">
                  <Ionicons name="card-outline" size={18} color={colors.text.secondary} className="mr-3" />
                  <TextInput
                    placeholder="Mã số thuế"
                    placeholderTextColor={colors.text.muted}
                    returnKeyType="next"
                    value={taxCode}
                    onChangeText={setTaxCode}
                    style={{ color: colors.text.primary }}
                    className="flex-1 text-base leading-[19px]"
                  />
                </View>
              </View>

              <View className="relative h-14 w-full justify-center">
                <View style={{ borderColor: colors.border.default }} className="h-14 w-full flex-row items-center rounded-xl bg-white px-3 border shadow-sm">
                  <Ionicons name="call-outline" size={20} color={colors.text.secondary} className="mr-3" />
                  <TextInput
                    keyboardType="phone-pad"
                    placeholder="Số điện thoại"
                    placeholderTextColor={colors.text.muted}
                    returnKeyType="next"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    style={{ color: colors.text.primary }}
                    className="flex-1 text-base leading-[19px]"
                  />
                </View>
              </View>

              <View className="relative h-14 w-full justify-center">
                <View style={{ borderColor: colors.border.default }} className="h-14 w-full flex-row items-center rounded-xl bg-white px-3 border shadow-sm">
                  <Ionicons name="mail-outline" size={22} color={colors.text.secondary} className="mr-3" />
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="Email"
                    placeholderTextColor={colors.text.muted}
                    returnKeyType="next"
                    value={email}
                    onChangeText={setEmail}
                    style={{ color: colors.text.primary }}
                    className="flex-1 text-base leading-[19px]"
                  />
                </View>
              </View>

              <View className="relative h-14 w-full justify-center">
                <View style={{ borderColor: colors.border.default }} className="h-14 w-full flex-row items-center rounded-xl bg-white px-3 border shadow-sm">
                  <Ionicons name="lock-closed-outline" size={22} color={colors.text.secondary} className="mr-3" />
                  <TextInput
                    placeholder="Mật khẩu"
                    placeholderTextColor={colors.text.muted}
                    returnKeyType="done"
                    secureTextEntry={!passwordVisible}
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={handleRegister}
                    style={{ color: colors.text.primary }}
                    className="flex-1 pr-3 text-base leading-[19px]"
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
                      color={colors.text.secondary}
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
                      style={{
                        backgroundColor: acceptedTerms ? colors.brand.primary : 'transparent',
                        borderColor: acceptedTerms ? colors.brand.primary : 'rgba(255,255,255,0.5)',
                      }}
                      className="h-5 w-5 items-center justify-center rounded border-2"
                    >
                      {acceptedTerms ? (
                        <Ionicons name="checkmark" size={14} color={colors.text.onPrimary} />
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
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? colors.brand.primaryPressed : colors.brand.primary,
                    shadowColor: colors.brand.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 14,
                  })}
                  className={[
                    'h-14 w-full items-center justify-center rounded-xl',
                    isLoading ? 'opacity-70' : '',
                  ].join(' ')}
                >
                  <Text className="text-white text-sm leading-5 font-semibold uppercase tracking-[0.7px]">
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
