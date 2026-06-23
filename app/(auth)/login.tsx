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
import { ApiClientError, getApiErrorMessage } from '../../services/apiClient';
import {
  getMobileRoleFromBackend,
  login as loginApi,
  logout as logoutApi,
} from '../../services/authApi';
import { getRoleFromToken } from '../../services/jwt';
import { useAuthStore } from '../../store/useAuthStore';

const LOGIN_CREDENTIALS_ERROR = 'Email hoặc mật khẩu sai.';
const UNSUPPORTED_MOBILE_ROLE_ERROR = 'Tài khoản này không hỗ trợ đăng nhập trên mobile.';

export default function LoginScreen() {
  const router = useRouter();
  const saveAuth = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Vui lòng nhập email và mật khẩu.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await loginApi({
        email: email.trim(),
        password,
      });

      if (!response.success) {
        throw new Error(LOGIN_CREDENTIALS_ERROR);
      }

      const authData = response.data;
      if (!authData?.accessToken) {
        throw new Error('Phản hồi đăng nhập thiếu accessToken.');
      }

      const backendRole = authData.role ?? getRoleFromToken(authData.accessToken);
      const appRole = getMobileRoleFromBackend(backendRole);
      if (!appRole) {
        await revokeIssuedToken(authData.accessToken);
        throw new Error(UNSUPPORTED_MOBILE_ROLE_ERROR);
      }

      saveAuth({
        token: authData.accessToken,
        refreshToken: authData.refreshToken,
        accessTokenExpiresAt: authData.accessTokenExpiresAt,
        role: appRole,
        user: {
          userId: authData.userId,
          customerId: authData.customerId,
          fullName: authData.fullName,
          email: authData.email ?? email.trim(),
          backendRole: backendRole ?? appRole,
        },
      });
    } catch (error) {
      setErrorMessage(getLoginErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthBackground>
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
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 88,
            paddingBottom: 32,
          }}
        >
          <View className="w-full max-w-[350px] pb-3">
            <View className="items-center mb-12">
              <Ionicons
                name="snow"
                size={53}
                color="#FFFFFF"
                style={{
                  marginBottom: 8,
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 4,
                }}
              />
              <Text
                className="text-white text-base leading-6 font-normal"
                style={{
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 4,
                }}
              >
                ColdChainX
              </Text>
            </View>

            <View className="w-full gap-3">
              {errorMessage ? (
                <Text className="min-h-5 text-center text-sm leading-5 text-red-200">
                  {errorMessage}
                </Text>
              ) : (
                <View className="h-5" />
              )}

              <View className="w-full h-14 flex-row items-center bg-[#F8F9FA] rounded-xl px-4 shadow-sm">
                <Ionicons name="mail-outline" size={22} color="#877369" />
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="Email"
                  placeholderTextColor="#877369"
                  returnKeyType="next"
                  value={email}
                  onChangeText={setEmail}
                  className="flex-1 ml-3 text-[#877369] text-base leading-[19px]"
                />
              </View>

              <View className="w-full h-14 flex-row items-center bg-[#F8F9FA] rounded-xl px-4 shadow-sm">
                <Ionicons name="lock-closed-outline" size={22} color="#877369" />
                <TextInput
                  placeholder="Mật khẩu"
                  placeholderTextColor="#877369"
                  returnKeyType="done"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={handleLogin}
                  className="flex-1 ml-3 text-[#877369] text-base leading-[19px]"
                />
              </View>

              <View className="w-full pt-6">
                <Pressable
                  accessibilityRole="button"
                  onPress={handleLogin}
                  disabled={isLoading}
                  className={[
                    'w-full h-14 rounded-xl justify-center items-center bg-[#75FF68] shadow-xl',
                    isLoading ? 'opacity-70' : '',
                  ].join(' ')}
                >
                  <Text className="uppercase text-[#002201] text-base leading-6 font-normal">
                    {isLoading ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}
                  </Text>
                </Pressable>
              </View>

              <View className="w-full pt-6 items-center">
                <Pressable accessibilityRole="link">
                  <Text className="text-[#F8F9FA]/70 text-base leading-6 font-normal">
                    Quên mật khẩu?
                  </Text>
                </Pressable>
              </View>

              <View className="w-full pt-4">
                <View className="w-full items-center">
                  <View className="pb-2">
                    <Text className="text-[#F8F9FA]/50 text-base leading-6 font-normal">
                      Chưa có tài khoản?
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push('/(auth)/register')}
                    className="w-full h-14 rounded-xl border-2 border-[#75FF68] justify-center items-center"
                  >
                    <Text className="uppercase text-white text-base leading-6 font-normal">
                      ĐĂNG KÝ
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}

async function revokeIssuedToken(accessToken: string) {
  try {
    await logoutApi(accessToken);
  } catch (error) {
    console.error('[login] Failed to revoke token after role check failed', {
      message: getApiErrorMessage(error),
    });
  }
}

function getLoginErrorMessage(error: unknown) {
  if (error instanceof ApiClientError && (error.status === 400 || error.status === 401)) {
    return LOGIN_CREDENTIALS_ERROR;
  }

  if (error instanceof Error && error.message === LOGIN_CREDENTIALS_ERROR) {
    return LOGIN_CREDENTIALS_ERROR;
  }

  return getApiErrorMessage(error);
}
