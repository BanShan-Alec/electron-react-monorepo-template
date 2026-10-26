import { Link } from 'vocs';

// 侧栏顶部品牌位：logo 图在导航栏 gutter（vocs.config.ts logoUrl），
// 文字标题挂这里——Vocs 的 Logo 组件配了 logoUrl 后只渲染图不渲染 title 文字，
// 图+字组合靠本 slot 补齐（同列对齐，视觉上与 vocs.dev「logo 图自带文字」等价）。
export function SidebarHeader() {
  return (
    <Link
      to="/"
      className="vocs:flex vocs:items-center vocs:gap-2 vocs:no-underline vocs:px-2 vocs:py-1"
    >
      <span className="vocs:text-[15px] vocs:font-bold vocs:text-heading vocs:tracking-tight">
        Electron React Template
      </span>
      <span className="vocs:text-[12px] vocs:font-medium vocs:text-[var(--vocs-color-text-3)]">
        解法合集
      </span>
    </Link>
  );
}
