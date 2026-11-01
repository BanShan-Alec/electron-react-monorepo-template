import { Link } from 'vocs';

// 侧栏顶部品牌位：Vocs 的 Logo 组件配了 logoUrl 后只渲染图不渲染 title 文字，
// 「图 + 品牌名同一行」的组合靠本 slot 补齐（导航栏 gutter 的纯图标此时会与之重叠，
// 故 vocs.config.ts 不配 logoUrl，导航栏品牌完全由这里承担）。
export function SidebarHeader() {
  return (
    <Link to="/" className="flex items-center gap-2 no-underline py-1">
      <img
        src="/electron-react-monorepo-template/icon.png"
        alt="Electron React Template"
        className="h-6 w-6"
      />
      <span
        style={{ lineHeight: '1.1' }}
        className="text-[14px] font-bold text-heading tracking-tight"
      >
        Electron React Template
        <br />
        <span className="text-[10px] font-medium text-muted">解法合集</span>
      </span>
    </Link>
  );
}
