import { NativeModules, TurboModuleRegistry } from 'react-native';

export interface GoogleAuthResult {
  idToken: string | null;
  cancelled?: boolean;
  playServicesUnavailable?: boolean;
}

type GoogleSigninErrorDetails = {
  code?: string;
  message: string;
};

const GOOGLE_SIGNIN_USER_MESSAGE = 'Không thể đăng nhập bằng Google. Vui lòng thử lại.';

export class GoogleSigninError extends Error {
  code?: string;

  constructor(code?: string) {
    super(GOOGLE_SIGNIN_USER_MESSAGE);
    this.name = 'GoogleSigninError';
    this.code = code;
  }
}

interface GoogleSignInModule {
  GoogleSignin: {
    configure: (options?: { webClientId?: string }) => void;
    hasPlayServices: (options?: { showPlayServicesUpdateDialog?: boolean }) => Promise<boolean>;
    signIn: () => Promise<{ data?: { idToken?: string | null } | null }>;
  };
  statusCodes: {
    SIGN_IN_CANCELLED: string;
    IN_PROGRESS: string;
    PLAY_SERVICES_NOT_AVAILABLE: string;
    SIGN_IN_REQUIRED: string;
  };
}

let cachedModule: GoogleSignInModule | null = null;
let isConfigured = false;

/**
 * Checks if the native RNGoogleSignin module is registered in the native binary.
 */
export function isGoogleSigninSupported(): boolean {
  try {
    const turboModule = TurboModuleRegistry.get ? TurboModuleRegistry.get('RNGoogleSignin') : null;
    const legacyModule = NativeModules.RNGoogleSignin;
    return Boolean(turboModule || legacyModule);
  } catch {
    return false;
  }
}

/**
 * Safely retrieves the GoogleSignin native wrapper module if available.
 */
function getGoogleSigninModule(): GoogleSignInModule | null {
  if (!isGoogleSigninSupported()) {
    return null;
  }

  if (!cachedModule) {
    try {
      cachedModule = require('@react-native-google-signin/google-signin') as GoogleSignInModule;
    } catch {
      return null;
    }
  }

  return cachedModule;
}

/**
 * Configures Google Sign-In with webClientId if native module is present.
 */
export function configureGoogleSignin(webClientId?: string): boolean {
  const module = getGoogleSigninModule();
  if (!module || !webClientId || isConfigured) {
    return false;
  }

  try {
    module.GoogleSignin.configure({ webClientId });
    isConfigured = true;
    return true;
  } catch (error) {
    logGoogleSigninError(error);
    return false;
  }
}

/**
 * Performs Google Sign-In and retrieves the idToken safely.
 */
export async function performGoogleSignIn(webClientId?: string): Promise<GoogleAuthResult> {
  const module = getGoogleSigninModule();
  if (!module) {
    throw new Error(
      'Đăng nhập Google chưa được tích hợp trong bản build hiện tại (Expo Go). Vui lòng sử dụng Development Build (npx expo run:android).'
    );
  }

  if (!isConfigured && webClientId) {
    configureGoogleSignin(webClientId);
  }

  try {
    await module.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await module.GoogleSignin.signIn();
    const idToken = response.data?.idToken ?? null;

    return { idToken };
  } catch (error: unknown) {
    const errCode = (error as { code?: string })?.code;
    if (
      errCode === module.statusCodes.SIGN_IN_CANCELLED ||
      errCode === module.statusCodes.IN_PROGRESS
    ) {
      return { idToken: null, cancelled: true };
    }
    if (errCode === module.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { idToken: null, playServicesUnavailable: true };
    }

    const { code } = getGoogleSigninErrorDetails(error);
    logGoogleSigninError(error);
    throw new GoogleSigninError(code);
  }
}

function logGoogleSigninError(error: unknown) {
  if (!__DEV__) {
    return;
  }

  const { code, message } = getGoogleSigninErrorDetails(error);
  console.warn('[GoogleSignIn]', { code, message });
}

function getGoogleSigninErrorDetails(error: unknown): GoogleSigninErrorDetails {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const code = typeof candidate?.code === 'string' || typeof candidate?.code === 'number'
    ? String(candidate.code)
    : undefined;
  const rawMessage = typeof candidate?.message === 'string'
    ? candidate.message
    : 'Google Sign-In failed.';

  return {
    code,
    message: rawMessage
      .replace(/\b(id_?token|access_?token|refresh_?token|serverAuthCode|authorization)\b\s*[:=]\s*\S+/gi, '$1=[redacted]')
      .slice(0, 300),
  };
}
