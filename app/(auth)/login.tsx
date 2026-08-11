import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AuthBackground } from '../../components/AuthBackground';
import { colors } from '../../constants/colors';
import { ApiClientError, getApiErrorMessage } from '../../services/apiClient';
import {
  getMobileRoleFromBackend,
  hasValidGoogleLoginPayload,
  login as loginApi,
  logout as logoutApi,
  googleLogin,
} from '../../services/authApi';
import { isGoogleSigninSupported, performGoogleSignIn } from '../../services/googleAuth';
import { getRoleFromToken } from '../../services/jwt';
import { useAuthStore } from '../../store/useAuthStore';

const LOGIN_CREDENTIALS_ERROR = 'Email hoặc mật khẩu không chính xác';
const UNSUPPORTED_MOBILE_ROLE_ERROR = 'Tài khoản này không hỗ trợ đăng nhập trên mobile.';

export default function LoginScreen() {
  const router = useRouter();
  const saveAuth = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId) {
      setErrorMessage('Đăng nhập Google chưa được cấu hình (thiếu EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).');
      return;
    }

    if (!isGoogleSigninSupported()) {
      setErrorMessage(
        'Đăng nhập Google yêu cầu bản Development Build (npx expo run:android). Tính năng không hỗ trợ trên Expo Go.'
      );
      return;
    }

    setErrorMessage(null);
    setIsGoogleLoading(true);

    try {
      const { idToken, cancelled, playServicesUnavailable } = await performGoogleSignIn(webClientId);

      if (cancelled) {
        return;
      }

      if (playServicesUnavailable) {
        setErrorMessage('Thiết bị chưa hỗ trợ dịch vụ đăng nhập Google.');
        return;
      }

      if (!idToken) {
        throw new Error('Không nhận được thông tin xác thực từ Google. Vui lòng thử lại.');
      }

      const response = await googleLogin(idToken);

      if (!response.success) {
        throw new Error(response.message ?? 'Đăng nhập Google không thành công. Vui lòng thử lại.');
      }

      if (!hasValidGoogleLoginPayload(response)) {
        throw new Error('Máy chủ trả về phiên đăng nhập không hợp lệ. Vui lòng thử lại.');
      }

      const authData = response.data;

      const backendRole = authData.user.role ?? getRoleFromToken(authData.token);
      const appRole = getMobileRoleFromBackend(backendRole);
      if (!appRole) {
        throw new Error(UNSUPPORTED_MOBILE_ROLE_ERROR);
      }

      saveAuth({
        token: authData.token,
        refreshToken: authData.refreshToken,
        accessTokenExpiresAt: authData.expiresAt ?? null,
        role: appRole,
        user: {
          userId: authData.user.userId,
          customerId: authData.user.customerId,
          warehouseId: authData.user.warehouseId,
          fullName: authData.user.fullName ?? authData.user.email ?? '',
          email: authData.user.email ?? '',
          backendRole: backendRole ?? appRole,
        },
      });

    } catch (error: unknown) {
      if (error instanceof ApiClientError) {
        const msg = getApiErrorMessage(error);
        if (error.status === 401) {
          if (msg.includes('deactivated') || msg.includes('vô hiệu hóa') || msg.includes('deactivate')) {
            setErrorMessage('Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ.');
          } else {
            setErrorMessage('Phiên xác thực Google không hợp lệ hoặc đã hết hạn.');
          }
        } else if (error.status === 409) {
          setErrorMessage('Email này đã được liên kết với một tài khoản Google khác.');
        } else if (error.status && error.status >= 500) {
          setErrorMessage('Đăng nhập Google hiện chưa khả dụng. Vui lòng thử lại sau.');
        } else {
          setErrorMessage('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.');
        }
      } else if (error instanceof Error) {
        setErrorMessage(error.message || 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.');
      } else {
        setErrorMessage('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

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
          warehouseId: authData.warehouseId,
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
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.formContainer}>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Ionicons
                name="snow"
                size={53}
                color={colors.brand.primaryForeground}
                style={{
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 4,
                }}
              />
              <Text
                style={[
                  styles.logoText,
                  {
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.12,
                    shadowRadius: 4,
                  },
                ]}
              >
                ColdChainX
              </Text>
            </View>

            <View style={styles.formContent}>
              {/* Error Badge */}
              {errorMessage ? (
                <View style={styles.errorBadge}>
                  <Text style={styles.errorText}>
                    {errorMessage}
                  </Text>
                </View>
              ) : null}

              {/* Email Input */}
              <View
                style={[
                  styles.inputContainer,
                  isEmailFocused && styles.inputContainerFocused,
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={22}
                  color={isEmailFocused ? colors.brand.primary : colors.text.secondary}
                />
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="Email"
                  placeholderTextColor={colors.text.muted}
                  returnKeyType="next"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setIsEmailFocused(true)}
                  onBlur={() => setIsEmailFocused(false)}
                  style={styles.inputField}
                />
              </View>

              {/* Password Input */}
              <View
                style={[
                  styles.inputContainer,
                  styles.inputContainerSpaced,
                  isPasswordFocused && styles.inputContainerFocused,
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={22}
                  color={isPasswordFocused ? colors.brand.primary : colors.text.secondary}
                />
                <TextInput
                  placeholder="Mật khẩu"
                  placeholderTextColor={colors.text.muted}
                  returnKeyType="done"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  onSubmitEditing={handleLogin}
                  style={styles.inputField}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.text.secondary}
                  />
                </Pressable>
              </View>

              {/* Primary Login CTA */}
              <View style={styles.primaryButtonShell}>
                {isLoading ? (
                  <ActivityIndicator color={colors.text.onPrimary} />
                ) : (
                  <Text style={styles.primaryButtonText}>Đăng nhập</Text>
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đăng nhập"
                  onPress={handleLogin}
                  disabled={isLoading || isGoogleLoading}
                  style={styles.touchOverlay}
                />
              </View>

              {/* Quên mật khẩu? */}
              <View style={styles.forgotPasswordContainer}>
                <Pressable accessibilityRole="link" style={styles.forgotPasswordPressable}>
                  <Text style={styles.forgotPasswordText}>
                    Quên mật khẩu?
                  </Text>
                </Pressable>
              </View>

              {/* ── Divider ── */}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Hoặc</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Login CTA */}
              <View style={styles.googleButtonShell}>
                {isGoogleLoading ? (
                  <ActivityIndicator color="#202124" />
                ) : (
                  <View style={styles.googleButtonContent}>
                    <Ionicons name="logo-google" size={20} color="#DB4437" />
                    <Text style={styles.googleButtonText}>Tiếp tục với Google</Text>
                  </View>
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tiếp tục với Google"
                  onPress={handleGoogleLogin}
                  disabled={isLoading || isGoogleLoading}
                  style={styles.touchOverlay}
                />
              </View>

              {/* Register Link */}
              <View style={styles.registerRow}>
                <Text style={styles.registerLeadText}>
                  Chưa có tài khoản?{' '}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Chuyển đến trang Đăng ký"
                  onPress={() => router.push('/(auth)/register')}
                  style={styles.registerPressable}
                >
                  <Text style={styles.registerActionText}>
                    Đăng ký
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 88,
    paddingBottom: 32,
  },
  formContainer: {
    width: '100%',
    maxWidth: 350,
    paddingBottom: 12,
  },
  formContent: {
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 8,
  },
  errorBadge: {
    backgroundColor: colors.status.danger.bg,
    borderColor: colors.status.danger.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  errorText: {
    color: colors.status.danger.main,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    height: 54,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainerSpaced: {
    marginTop: 12,
  },
  inputContainerFocused: {
    borderColor: colors.brand.primary,
    borderWidth: 2,
  },
  inputField: {
    flex: 1,
    marginLeft: 12,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
  },

  // ── PRIMARY LOGIN BUTTON ─────────────────────────────────────────────
  primaryButtonShell: {
    width: '100%',
    height: 54,
    backgroundColor: colors.brand.primary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    overflow: 'hidden',
    elevation: 3,
  },
  primaryButtonText: {
    color: colors.text.onPrimary,
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },

  // ── FORGOT PASSWORD ──────────────────────────────────────────────────
  forgotPasswordContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 14,
  },
  forgotPasswordPressable: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  forgotPasswordText: {
    color: colors.brand.primarySoft,
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.9,
  },

  // ── DIVIDER ──────────────────────────────────────────────────────────
  dividerContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  dividerText: {
    marginHorizontal: 16,
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    fontWeight: '500',
  },

  // ── GOOGLE BUTTON ────────────────────────────────────────────────────
  googleButtonShell: {
    width: '100%',
    height: 54,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 2,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleButtonText: {
    color: '#202124',
    fontSize: 15,
    fontWeight: '600',
    includeFontPadding: false,
  },

  // ── TOUCH OVERLAY ────────────────────────────────────────────────────
  touchOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },

  // ── REGISTER ─────────────────────────────────────────────────────────
  registerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 26,
  },
  registerPressable: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  registerLeadText: {
    color: colors.brand.primaryForeground,
    fontSize: 14,
    opacity: 0.8,
  },
  registerActionText: {
    color: colors.brand.primarySoft,
    fontSize: 14,
    fontWeight: '700',
  },
});

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
