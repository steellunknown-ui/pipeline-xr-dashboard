interface SafeFetchResult<T = any> {
  success: boolean;
  data?: T;
  degraded?: boolean;
  reason?: 'network' | 'timeout' | 'invalid_response';
}

export async function safeFetch<T = any>(
  url: string,
  options?: RequestInit,
  timeoutMs: number = 8000
): Promise<SafeFetchResult<T>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        degraded: true,
        reason: 'network'
      };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return {
        success: false,
        degraded: true,
        reason: 'invalid_response'
      };
    }

    const data = await response.json();
    return {
      success: true,
      data
    };

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        degraded: true,
        reason: 'timeout'
      };
    }

    return {
      success: false,
      degraded: true,
      reason: 'network'
    };
  }
}