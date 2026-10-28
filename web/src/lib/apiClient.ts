/**
 * KARE Smart Lab Management System
 * Authenticated API Client
 * 
 * Automatically attaches valid Supabase Auth Bearer token to all requests,
 * handles token refresh, session validation, and structured error responses.
 */

import { supabase } from '@/lib/supabaseClient';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

export interface ApiClientOptions extends RequestInit {
  requireAuth?: boolean;
}

/**
 * Obtain a valid, fresh access token from the active Supabase session.
 * Automatically triggers refresh if token is near expiration.
 */
export async function getValidAccessToken(): Promise<string | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;

    // Check if token is expired or expiring within 30 seconds
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    if (expiresAt && Date.now() >= expiresAt - 30000) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshed.session) {
        return refreshed.session.access_token;
      }
    }

    return session.access_token || null;
  } catch (err) {
    console.error('[apiClient] Error retrieving auth session:', err);
    return null;
  }
}

/**
 * Universal authenticated API fetch helper
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const { requireAuth = true, headers: customHeaders, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string> || {})
  };

  if (requireAuth) {
    const token = await getValidAccessToken();
    if (!token) {
      throw new Error('Authentication required. Please sign in to your staff account.');
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  let response = await fetch(url, { ...fetchOptions, headers });

  // If 401 Unauthorized, attempt one token refresh and retry
  if (response.status === 401 && requireAuth) {
    try {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && refreshed.session?.access_token) {
        headers['Authorization'] = `Bearer ${refreshed.session.access_token}`;
        response = await fetch(url, { ...fetchOptions, headers });
      }
    } catch {
      // Continue to error parsing below
    }
  }

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorBody.message || errorMessage;
    } catch {
      // Response body not JSON
    }
    throw new Error(errorMessage);
  }

  // Handle empty 204 or 201 responses
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  return {} as T;
}
