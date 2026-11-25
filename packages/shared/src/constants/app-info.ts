import { PROJECT_DOCS_URL } from './docs';

/**
 * 构建期注入的展示身份（vite `define`）。
 * 值由 `build/lib/app-identity.ts` 从根 `package.json` 解析，在 renderer 的 vite 配置与
 * `.config/vitest.config.ts` 两处注入同一份（主进程当前不消费本文件，故不注入）。
 */
declare const __APP_INFO__: {
  readonly name: string;
  readonly author: string;
  readonly authorUrl: string;
  readonly license: string;
  readonly repositoryUrl: string;
};

/**
 * 应用展示元数据单一事实源（更新窗口「关于」区消费）。
 *
 * - 身份字段（名称 / 作者 / 协议 / 仓库）不再手写字面量：构建期从根 `package.json`
 *   注入，fork 改名只需改 `package.json`，不存在两处漂移；
 * - 仓库子路径（releases / issues）与文档站地址在此派生，同样随注入值变化；
 * - 版本号不在此处：打包后主进程 `app.getVersion()` 才是运行时真值（经快照透传）。
 * - 本文件依赖构建期常量 `__APP_INFO__`：只有注入了该 define 的构建（renderer / vitest）
 *   才能引用；主进程当前不消费本文件，故未注入。新增消费方时必须同步给对应 vite config 加 define，
 *   否则模块求值即 ReferenceError。
 */
export interface AppInfo {
  name: string;
  author: string;
  authorUrl: string;
  license: string;
  repositoryUrl: string;
  releasesUrl: string;
  issuesUrl: string;
  docsUrl: string;
}

export const APP_INFO: AppInfo = {
  ...__APP_INFO__,
  releasesUrl: `${__APP_INFO__.repositoryUrl}/releases`,
  issuesUrl: `${__APP_INFO__.repositoryUrl}/issues`,
  docsUrl: PROJECT_DOCS_URL,
};
