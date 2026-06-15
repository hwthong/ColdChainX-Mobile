export function getCustomerIdFromToken(token: string): string | null {
  const payload = decodeJwtPayload(token);

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const customerId = (payload as Record<string, unknown>).CustomerId;
  return typeof customerId === 'string' && customerId.trim() ? customerId : null;
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
