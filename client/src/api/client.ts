export const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('studysync_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('studysync_token', token);
}

export function removeAuthToken() {
  localStorage.removeItem('studysync_token');
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type');
  let data: any = null;

  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const hasAuthHeader = headers.has('Authorization');
    const isAuthOrVerificationRoute = endpoint.startsWith('/auth/') || endpoint.includes('/verify') || endpoint.includes('/password');

    if (response.status === 401 && hasAuthHeader && !isAuthOrVerificationRoute) {
      removeAuthToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studysync:unauthorized'));
      }
    }
    const errorMsg = data && data.error ? data.error : response.statusText || 'Request failed';
    throw new Error(errorMsg);
  }

  return data as T;
}
