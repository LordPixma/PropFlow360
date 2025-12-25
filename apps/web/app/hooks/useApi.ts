/**
 * React hooks for API calls with loading and error states
 */

import { useState, useEffect, useCallback } from 'react';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useApi<T>(
  apiCall: () => Promise<T>,
  deps: any[] = []
): UseApiState<T> & { refetch: () => Promise<void> } {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await apiCall();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [apiCall]);

  useEffect(() => {
    fetchData();
  }, deps);

  return {
    ...state,
    refetch: fetchData,
  };
}

export function useMutation<T, P = any>(
  apiCall: (params: P) => Promise<T>
): {
  mutate: (params: P) => Promise<T>;
  loading: boolean;
  error: Error | null;
  data: T | null;
} {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const mutate = useCallback(async (params: P) => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await apiCall(params);
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
      throw error;
    }
  }, [apiCall]);

  return {
    mutate,
    ...state,
  };
}
