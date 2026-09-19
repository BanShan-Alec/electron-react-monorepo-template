import { useCallback, useEffect, useState } from 'react';
import type { SystemInfo } from '../types';

export function useSystemInfo() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [serverTime, setServerTime] = useState<string>('');
  const [isPinging, setIsPinging] = useState(false);

  const fetchSystemInfo = useCallback(async () => {
    setIsFetchingInfo(true);
    try {
      const res = await window.api.system.getSystemInfo();
      if (res.success) {
        setSystemInfo(res.data);
      }
    } catch (err) {
      console.error('Failed to get system info:', err);
    } finally {
      setIsFetchingInfo(false);
    }
  }, []);

  const handlePing = useCallback(async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const res = await window.api.system.ping();
      const latency = Math.round((performance.now() - start) * 10) / 10;
      setPingLatency(latency);
      if (res.success) {
        setServerTime(res.data.serverTime);
      }
    } catch (err) {
      console.error('Ping failed:', err);
    } finally {
      setIsPinging(false);
    }
  }, []);

  useEffect(() => {
    fetchSystemInfo();
    handlePing();
  }, [fetchSystemInfo, handlePing]);

  return {
    systemInfo,
    isFetchingInfo,
    fetchSystemInfo,
    pingLatency,
    serverTime,
    isPinging,
    handlePing,
  };
}
