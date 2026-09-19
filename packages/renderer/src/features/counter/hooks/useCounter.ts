import { useCallback, useEffect, useState } from 'react';

export function useCounter() {
  const [count, setCount] = useState<number>(0);
  const [step, setStep] = useState<number>(1);
  const [isUpdating, setIsUpdating] = useState(false);

  const refreshCounter = useCallback(async () => {
    try {
      const res = await window.api.counter.get();
      if (res.success) {
        setCount(res.data.count);
      }
    } catch (err) {
      console.error('Failed to get counter:', err);
    }
  }, []);

  const handleIncrement = async () => {
    setIsUpdating(true);
    try {
      const res = await window.api.counter.increment({ step });
      if (res.success) {
        setCount(res.data.count);
      }
    } catch (err) {
      console.error('Increment failed:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDecrement = async () => {
    setIsUpdating(true);
    try {
      const res = await window.api.counter.decrement({ step });
      if (res.success) {
        setCount(res.data.count);
      }
    } catch (err) {
      console.error('Decrement failed:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReset = async () => {
    setIsUpdating(true);
    try {
      const res = await window.api.counter.reset();
      if (res.success) {
        setCount(res.data.count);
      }
    } catch (err) {
      console.error('Reset failed:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    refreshCounter();
  }, [refreshCounter]);

  return {
    count,
    step,
    setStep,
    isUpdating,
    handleIncrement,
    handleDecrement,
    handleReset,
    refreshCounter,
  };
}
