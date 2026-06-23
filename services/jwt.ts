export function getCustomerIdFromToken(token: string): string | null {
  const payload = decodeJwtPayload(token);

  return getStringClaim(payload, 'CustomerId');
}

export function getUserIdFromToken(token: string): string | null {
  const payload = decodeJwtPayload(token);

  return (
    getStringClaim(payload, 'sub') ??
    getStringClaim(payload, 'nameidentifier') ??
    getStringClaim(payload, 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier') ??
    getStringClaim(payload, 'http://schemas.microsoft.com/ws/2008/06/identity/claims/nameidentifier')
  );
}

export function getWarehouseIdFromToken(token: string): string | null {
  const payload = decodeJwtPayload(token);

  return getStringClaim(payload, 'WarehouseId');
}

export function getRoleFromToken(token: string): string | null {
  const payload = decodeJwtPayload(token);

  return (
    getStringClaim(payload, 'role') ??
    getStringClaim(payload, 'roles') ??
    getStringClaim(payload, 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role') ??
    getStringClaim(payload, 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role')
  );
}

function decodeJwtPayload(token: string): unknown {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }

    const json = decodeBase64Url(payload);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  if (typeof atob !== 'function') {
    return '';
  }

  return decodeURIComponent(
    Array.from(atob(padded))
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join('')
  );
}

function getStringClaim(payload: unknown, claimName: string) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const value = (payload as Record<string, unknown>)[claimName];
  if (Array.isArray(value)) {
    const firstString = value.find((item): item is string => typeof item === 'string' && item.trim().length > 0);
    return firstString ?? null;
  }

  return typeof value === 'string' && value.trim() ? value : null;
}
