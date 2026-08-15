const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/$/, '');
const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api$/, '');

export const ACCESS_TOKEN_KEY = 'musicApp_accessToken';
export const REFRESH_TOKEN_KEY = 'musicApp_refreshToken';

function readToken(key) {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

export function storeAuthTokens({ access, refresh }) {
  if (typeof window === 'undefined') return;
  if (access) window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
  if (refresh) window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearAuthTokens() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function resolveBackendAsset(value, fallback = '') {
  if (!value) return fallback;
  if (/^(https?:|blob:|data:)/.test(value)) return value;
  return `${BACKEND_ORIGIN}${value.startsWith('/') ? '' : '/'}${value}`;
}

function firstError(payload) {
  if (!payload) return 'خطا در ارتباط با سرور';
  if (typeof payload === 'string') return payload;

  for (const key of ['detail', 'error', 'message', 'non_field_errors']) {
    const value = payload[key];
    if (Array.isArray(value) && value.length) return firstError(value[0]);
    if (value) return firstError(value);
  }

  const firstValue = Object.values(payload)[0];
  return firstValue ? firstError(firstValue) : 'خطا در ارتباط با سرور';
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  const text = await response.text();
  return text || null;
}

async function refreshAccessToken() {
  const refresh = readToken(REFRESH_TOKEN_KEY);
  if (!refresh) return null;

  const response = await fetch(`${API_BASE_URL}/users/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    clearAuthTokens();
    return null;
  }

  const payload = await response.json();
  storeAuthTokens({ access: payload.access });
  return payload.access;
}

export async function apiRequest(path, options = {}, retry = true) {
  const { auth = true, body, headers = {}, ...fetchOptions } = options;
  const requestHeaders = { ...headers };
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  if (body !== undefined && !isFormData) requestHeaders['Content-Type'] = 'application/json';
  const access = auth ? readToken(ACCESS_TOKEN_KEY) : null;
  if (access) requestHeaders.Authorization = `Bearer ${access}`;

  try {
    let response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers: requestHeaders,
      body: body === undefined || isFormData ? body : JSON.stringify(body),
    });

    if (response.status === 401 && auth && retry && readToken(REFRESH_TOKEN_KEY)) {
      const refreshedAccess = await refreshAccessToken();
      if (refreshedAccess) {
        response = await fetch(`${API_BASE_URL}${path}`, {
          ...fetchOptions,
          headers: { ...requestHeaders, Authorization: `Bearer ${refreshedAccess}` },
          body: body === undefined || isFormData ? body : JSON.stringify(body),
        });
      }
    }

    const payload = await parseResponse(response);
    if (!response.ok) {
      return {
        success: false,
        error: { message: firstError(payload), status: response.status, details: payload },
      };
    }
    return { success: true, data: payload };
  } catch (error) {
    return {
      success: false,
      error: {
        message: 'ارتباط با سرور برقرار نشد. مطمئن شوید بک‌اند روی پورت ۸۰۰۰ اجرا است.',
        status: 0,
        details: error.message,
      },
    };
  }
}
