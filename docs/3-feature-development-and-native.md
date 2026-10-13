# 阶段三：渲染进程架构、组件规范与基础设施选型

本文档对比 electron-vite 空白模板，阐述渲染进程 MPA 架构、七段式组件规范以及前端基础设施的选型理由。

## 1. 多窗口入口 (MPA Entries) 与特性驱动架构 (Feature)

### electron-vite 现状
默认仅提供单一 `index.html` 的单页面应用 (SPA)。桌面应用通常包含多个独立窗口（如主窗口与轻量更新窗口）。在单页面应用中强行通过路由区分窗口，会导致轻量窗口加载整个主界面的庞大依赖代码，增加内存开销。

### 本模板的设计
本模板在渲染进程构建了 MPA Entries 物理入口与领域内聚的 Feature 架构：

```mermaid
graph TD
    Renderer[packages/renderer/src] --> Entries[entries/ (独立物理入口)]
    Renderer --> Features[features/ (高内聚业务特性)]
    
    Entries --> Home["entries/home (主窗口入口)"]
    Entries --> Updater["entries/updater (更新器轻量独立窗口)"]
    
    Features --> FeatDashboard["features/dashboard (仪表盘)"]
    Features --> FeatUsb["features/usb (USB 硬件监控)"]
```

- **物理 Entries 入口**：
  `src/entries/home` 与 `src/entries/updater` 拥有独立的 HTML 与根入口。轻量更新窗口不引入多余的沉重依赖，极大降低次级窗口的资源消耗。
- **特性驱动架构 (Feature)**：
  每个功能在 `features/<name>/` 下自包含 `components/`、`hooks/` 与专属页面，对外只暴露单一聚合入口，重构或移除功能时不留孤立代码。

---

## 2. 渲染进程“七段式”组件编写规范

本模板在 `packages/renderer` 中严格执行“一组件一文件夹”与官方七段式代码组织顺序，保证团队多人与 AI 协作时的代码一致性：

### 七段式组织顺序 (以展示卡片为例)
```tsx
import { ApiOutlined, ReloadOutlined, UsbOutlined } from '@ant-design/icons';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type { UsbDeviceItem } from '@shared/types/usb';
import { Badge, Button, Card, Empty, Skeleton, Tag } from 'antd';
import { memo } from 'react';
import { CardTitle } from '@/components/ui/CardTitle';

// [段落 10] Props 接口契约定义
export interface IUsbCardProps {
  devices: UsbDeviceItem[];
  isLoading: boolean;
  onRefresh: () => void;
}

// [段落 1] 组件本体内部实现
const _UsbCard = (props: IUsbCardProps) => {
  // ① 必须调用 useLingui() 订阅语言切换上下文
  useLingui();

  // ② 属性与变量解构
  const { devices, isLoading, onRefresh } = props;

  // ③ 派生状态转换
  const showSkeleton = isLoading && devices.length === 0;

  // ④ 视图渲染
  return (
    <Card
      className="glass-card transition-all duration-200 hover:border-border/80"
      title={<CardTitle icon={<UsbOutlined />} title={t`USB 硬件设备监控`} />}
      extra={
        <div className="flex items-center gap-2">
          <Badge count={devices.length} style={{ backgroundColor: '#10b981' }} />
          <Button type="primary" size="small" icon={<ReloadOutlined />} onClick={onRefresh}>
            {t`刷新`}
          </Button>
        </div>
      }
    >
      {showSkeleton ? <Skeleton active /> : /* 列表渲染 */}
    </Card>
  );
};

// [段落 2] 展示卡片统一使用 memo 包装导出，避免多余渲染
const UsbCard = memo(_UsbCard);
export { UsbCard };
export default UsbCard;
```

---

## 3. 前端基础设施库选型理由

| 选型库 | 替代方案 | 为什么选择它？(工程化视角) |
| :--- | :--- | :--- |
| **Ant Design v6 + Tailwind CSS** | 纯自绘 / 手写 CSS | **互补融合**：AntD v6 提供严苛的企业级交互规范、设计变量系统与无障碍支持；Tailwind CSS 提供原子化实用工具类，灵活处理局部微调与流体布局。 |
| **Lingui v5** | i18next / react-intl | **零遗漏与代码可读性**：源码中直接书写自然语言（中文 `t` 宏包裹），编译期 AST 自动提取词条生成 PO 文件，彻底消灭未定义的嵌套 JSON 键名。 |
| **wouter** | react-router-dom | **极致轻量**：体积仅 1.5KB，无大型路由框架的侵入式上下文，完美契合桌面客户端的极简面板切换。 |
| **Zustand** | Redux Toolkit / MobX | **零模版代码**：采用纯函数创建状态库，摆脱繁琐的 action 与 reducer 样板代码，性能极佳。 |
