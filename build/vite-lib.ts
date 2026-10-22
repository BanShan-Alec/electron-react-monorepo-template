/**
 * Node 侧（main / preload）CJS 单文件构建的公共默认值。
 *
 * 两个包的差异只保留 entryFileNames / target / external，其余构建语义
 * （ssr、sourcemap、minify、outDir、emptyOutDir 等）在此单点维护。
 *
 * 返回结构化对象而非显式标注 Vite `BuildOptions`：build/ 与各 package 的
 * tsconfig 可能解析到不同的 @types/node，交叉标注会引入类型身份冲突。
 */
export interface NodeLibBuildOptions {
  /** 产物入口文件名，如 index.cjs / [name].cjs */
  entryFileNames: string;
  /** 编译目标，如 node24 / chrome130 */
  target: string;
  /** 运行时外置模块（不打包，从 node_modules 或宿主加载） */
  external: string[];
}

export function createNodeLibBuildOptions(options: NodeLibBuildOptions) {
  const isDev = process.env.MODE === 'development';
  return {
    ssr: true,
    sourcemap: isDev ? ('inline' as const) : ('hidden' as const),
    minify: isDev ? false : ('oxc' as const),
    outDir: 'dist',
    assetsDir: '.',
    target: options.target,
    lib: {
      entry: 'src/index.ts',
      formats: ['cjs'] as ['cjs'],
    },
    rolldownOptions: {
      external: options.external,
      output: {
        entryFileNames: options.entryFileNames,
        format: 'cjs' as const,
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  };
}
