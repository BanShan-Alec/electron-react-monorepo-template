import { t } from '@lingui/core/macro';

/**
 * 品牌主句（应用自述）：主窗口标题栏副标题与更新窗口 tagline 共用这一条 msgid。
 *
 * 为什么不放进 `APP_INFO`：`APP_INFO` 是**应用身份元数据**（名称/作者/协议/仓库），
 * 构建期由 `package.json` 注入；品牌句是**界面文案**，真源是 i18n 目录，
 * 一旦搬进注入链就再也翻译不了（英文字符串在构建期被内联，lingui 无从生成词条）。
 * 两处在不同尺寸下渲染（主窗口 12px 右对齐可两行、更新窗口 12px 单行），
 * 所以只共享文案、不共享组件。
 *
 * 文档站与 README 无法 import 本文件：那两处保留「坑位解法合集」大标题，
 * 把本句作为副段第一句，改动时须同步（登记于 docs 的《国际化文案规范》）。
 */
export function appTagline(): string {
  return t`类型安全 · 契约先行的 Electron 单仓模板`;
}
