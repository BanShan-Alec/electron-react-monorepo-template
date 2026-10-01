import { memo, useEffect } from 'react';

// 私有常量
const REACT_READY_EVENT = 'app-react-startup-ready';

// 可抽离的逻辑处理函数/组件

const _StartupReadyNotifier = (_props: IProps) => {
  // 变量声明、解构

  // 组件状态

  // 网络IO

  // 数据转换

  // 逻辑处理函数

  // 组件Effect
  useEffect(() => {
    // 事件名与 index.html 内联协调器字符串耦合，两端必须同步修改
    window.__APP_REACT_COMMIT_AT__ = Date.now();
    performance.mark('app:react-commit');
    window.dispatchEvent(new Event(REACT_READY_EVENT));
  }, []);

  // 组件渲染
  return null;
};

// props 类型定义
type IProps = Record<string, never>;

declare global {
  interface Window {
    __APP_REACT_COMMIT_AT__?: number;
  }
}

const StartupReadyNotifier = memo(_StartupReadyNotifier);

export { StartupReadyNotifier };
export default StartupReadyNotifier;
