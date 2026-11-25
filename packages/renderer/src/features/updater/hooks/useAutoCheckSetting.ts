import type { AppConfig } from '@shared/schemas/config';
import { useEffect, useState } from 'react';
import { useIpc } from '@/hooks/useIpc';

// 私有常量

// 可抽离的逻辑处理函数/组件

export interface UseAutoCheckSettingResult {
  /** 开关选中态：挂载拉取前按 schema 默认值 true 呈现 */
  checked: boolean;
  /** 初始配置是否已就绪：未就绪前不放行切换，避免默认值误切换 */
  ready: boolean;
  /** 乐观切换 → 落盘失败回滚；返回是否保存成功（调用方决定失败怎么提示） */
  handleChange: (checked: boolean) => Promise<boolean>;
}

export function useAutoCheckSetting(): UseAutoCheckSettingResult {
  const [checked, setChecked] = useState(true);
  const [ready, setReady] = useState(false);

  // ③ 网络IO（显式挂载触发）—— 拉取偏好配置
  const { run: fetchConfig } = useIpc('config.get', {
    onSuccess: (data: AppConfig) => {
      setChecked(data.autoCheckUpdate);
      setReady(true);
    },
    onError: () => {
      // 读取失败不打断更新窗口：按默认值呈现并放行操作
      setReady(true);
    },
  });

  // ③ 网络IO（显式触发）—— 局部更新
  const { runAsync: updateConfig } = useIpc('config.update');

  // ⑥ 组件 Effect：初次拉取 + 订阅配置变更（外部来源修改时同步开关）
  useEffect(() => {
    fetchConfig();
    const unsub = window.api?.config?.onChanged?.((config) => {
      setChecked(config.autoCheckUpdate);
    });
    return () => {
      unsub?.();
    };
  }, [fetchConfig]);

  // ⑤ 逻辑处理函数
  const handleChange = async (next: boolean): Promise<boolean> => {
    setChecked(next);
    try {
      await updateConfig({ autoCheckUpdate: next });
      return true;
    } catch {
      // 失败行已由 callIpc 落盘；此处回滚开关，由调用方决定提示方式
      setChecked(!next);
      return false;
    }
  };

  return { checked, ready, handleChange };
}
