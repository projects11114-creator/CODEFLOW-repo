/**
 * CodeFlow Execution API Configuration & Utilities
 * Resolves the backend URL for Java compilation and runtime execution.
 */

export function getBackendBaseUrl(): string {
  // Check build-time or runtime environment variables
  const envUrl =
    (import.meta.env.VITE_JAVA_EXECUTION_API_URL as string | undefined) ||
    (import.meta.env.VITE_API_URL as string | undefined) ||
    '';

  if (envUrl && typeof envUrl === 'string') {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return '';
}

/**
 * Returns the full URL for an API endpoint.
 * If VITE_JAVA_EXECUTION_API_URL is configured, prepends the backend host.
 * Otherwise, uses a relative URL (same-origin / local dev / Vercel proxy).
 */
export function getApiUrl(endpoint: string): string {
  const base = getBackendBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return base ? `${base}${cleanEndpoint}` : cleanEndpoint;
}

export interface BackendStatus {
  online: boolean;
  javacAvailable: boolean;
  javacVersion: string;
  geminiConfigured: boolean;
  backendUrl: string;
  isCustomBackend: boolean;
  error?: string;
}

/**
 * Checks connectivity and JDK availability on the configured backend.
 */
export async function checkBackendStatus(): Promise<BackendStatus> {
  const base = getBackendBaseUrl();
  const url = getApiUrl('/api/status');
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Backend returned HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      online: true,
      javacAvailable: Boolean(data.javacAvailable),
      javacVersion: data.javacVersion || '',
      geminiConfigured: Boolean(data.geminiConfigured),
      backendUrl: base || window.location.origin,
      isCustomBackend: Boolean(base),
    };
  } catch (err: any) {
    return {
      online: false,
      javacAvailable: false,
      javacVersion: 'Disconnected',
      geminiConfigured: false,
      backendUrl: base || (typeof window !== 'undefined' ? window.location.origin : ''),
      isCustomBackend: Boolean(base),
      error: err?.message || 'Failed to connect to backend',
    };
  }
}
