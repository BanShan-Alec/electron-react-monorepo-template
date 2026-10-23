import fs from 'node:fs';
import path from 'node:path';
import { type AppConfig, configSchema, DEFAULT_CONFIG } from '@app/shared/schemas/config';
import { app } from 'electron';
import Store from 'electron-store';
import type { AppModule } from '../AppModule';
import type { ModuleContext } from '../ModuleContext';
import { getLogManager } from './log.module';

export type { AppConfig };
export { DEFAULT_CONFIG };

export class ConfigStore implements AppModule {
  private readonly store: Store<AppConfig> | null;
  private config: AppConfig;

  constructor(customDir?: string) {
    this.store = this.openStore(customDir);
    this.config = this.loadConfig();
  }

  enable(_context: ModuleContext): void {
    // electron-store 每次 set 同步原子落盘，无需 before-quit 兜底
  }

  private openStore(customDir?: string): Store<AppConfig> | null {
    // 刻意不传 schema（ajv）与 defaults：校验与默认值的单一真源是 shared 的 zod configSchema。
    // 不传 name：落盘 electron-store 默认的 config.json，旧 app-config.json 断代不读。
    try {
      return new Store<AppConfig>({ cwd: customDir });
    } catch (error) {
      // conf 构造期即读整个文件，JSON 语法损坏会在此抛错
      this.logWarn('Config file unreadable, quarantining and retrying:', error);
    }
    this.quarantineCorruptFile(customDir);
    try {
      return new Store<AppConfig>({ cwd: customDir });
    } catch (error) {
      // 重试仍失败（如磁盘/权限异常）：退化为仅内存模式，不阻塞启动
      this.logWarn('Config store unavailable, running in memory only:', error);
      return null;
    }
  }

  private quarantineCorruptFile(customDir?: string): void {
    try {
      // store 尚未建成（构造期失败）时按同样规则推算路径
      const dir = customDir ?? (app ? app.getPath('userData') : undefined);
      if (dir) {
        this.quarantineFile(path.join(dir, 'config.json'));
      }
    } catch {
      // 隔离失败由随后的重试结果兜底
    }
  }

  private quarantineFile(file: string): void {
    try {
      if (fs.existsSync(file)) {
        fs.renameSync(file, `${file}.corrupt`);
      }
    } catch {
      // 隔离失败由随后的重试/写回兜底
    }
  }

  private loadConfig(): AppConfig {
    if (!this.store) {
      return { ...DEFAULT_CONFIG };
    }
    try {
      const parsed = configSchema.safeParse(this.store.store);
      if (parsed.success) {
        return parsed.data;
      }
      this.logWarn('Invalid config on disk, falling back to defaults:', parsed.error.issues);
      // 隔离后由下次写盘重建，避免每次启动都带着无效数据回退默认值
      this.quarantineFile(this.store.path);
    } catch (error) {
      this.logWarn('Config file unreadable, falling back to defaults:', error);
    }
    return { ...DEFAULT_CONFIG };
  }

  private persist(): void {
    if (!this.store) return;
    try {
      // 整对象写回：顺带清掉磁盘上已废弃的残留键
      this.store.store = this.config;
    } catch (error) {
      this.logWarn('Config write failed:', error);
    }
  }

  private logWarn(message: string, detail: unknown): void {
    try {
      getLogManager().scoped(this).warn(message, detail);
    } catch {
      // 日志系统自身不可用时静默，不影响配置链路
    }
  }

  public getAll(): AppConfig {
    return { ...this.config };
  }

  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  public set(partial: Partial<AppConfig>): AppConfig {
    // IPC 入口已校验，此处兜住非 IPC 直连调用方（如 counter.service）：
    // 非法输入拒绝并留痕，不抛错不断链路
    const parsed = configSchema.safeParse({ ...this.config, ...partial });
    if (!parsed.success) {
      this.logWarn('Invalid config update rejected:', parsed.error.issues);
      return { ...this.config };
    }
    this.config = parsed.data;
    this.persist();
    return { ...this.config };
  }

  public reset(): AppConfig {
    this.config = { ...DEFAULT_CONFIG };
    this.persist();
    return { ...this.config };
  }
}

// 默认单例供应用全局使用
let singletonInstance: ConfigStore | null = null;

export function getAppConfigStore(customDir?: string): ConfigStore {
  if (!singletonInstance) {
    singletonInstance = new ConfigStore(customDir);
  }
  return singletonInstance;
}

export function createConfigModule(customDir?: string): ConfigStore {
  return getAppConfigStore(customDir);
}
