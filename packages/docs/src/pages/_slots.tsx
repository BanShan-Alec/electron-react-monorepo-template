import { Link } from 'vocs';

// 侧栏顶部品牌位：Vocs 的 Logo 组件配了 logoUrl 后只渲染图不渲染 title 文字，
// 「图 + 品牌名同一行」的组合靠本 slot 补齐（导航栏 gutter 的纯图标此时会与之重叠，
// 故 vocs.config.ts 不配 logoUrl，导航栏品牌完全由这里承担）。
export function SidebarHeader() {
  return (
    <Link
      to="/"
      className="vocs:flex vocs:items-center vocs:gap-2 vocs:no-underline vocs:px-2 vocs:py-1"
    >
      <img
        src="/electron-react-monorepo-template/icon.png"
        alt="Electron React Template"
        className="vocs:h-6 vocs:w-6"
      />
      <span className="vocs:text-[15px] vocs:font-bold vocs:text-heading vocs:tracking-tight">
        Electron React Template
      </span>
      <span className="vocs:text-[12px] vocs:font-medium vocs:text-muted">解法合集</span>
    </Link>
  );
}
