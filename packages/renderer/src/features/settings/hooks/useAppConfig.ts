import { useCallback, useEffect, useState } from 'react';
import type { AppConfig } from '../types';

export function useAppConfig() {
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await window.api.config.get();
      if (res.success) {
        setAppConfig(res.data);
      }
    } catch (err) {
      console.error('Failed to get app config:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleUpdateConfig = async (partial: Partial<AppConfig>) => {
    try {
      const res = await window.api.config.update(partial);
      if (res.success) {
        setAppConfig(res.data);
      }
    } catch (err) {
      console.error('Failed to update config:', err);
    }
  };

  const handleResetConfig = async () => {
    try {
      const res = await window.api.config.reset();
      if (res.success) {
        setAppConfig(res.data);
      }
    } catch (err) {
      console.error('Failed to reset config:', err);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    appConfig,
    isLoading,
    fetchConfig,
    handleUpdateConfig,
    handleResetConfig,
  };
}
