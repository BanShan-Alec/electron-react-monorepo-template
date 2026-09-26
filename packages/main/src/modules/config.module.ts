import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type AppConfig, DEFAULT_CONFIG } from '@app/shared/schemas/config';
import { app } from 'electron';
import type { AppModule } from '../AppModule';
import type { ModuleContext } from '../ModuleContext';

export type { AppConfig };
export { DEFAULT_CONFIG };

export class ConfigStore implements AppModule {
  private readonly configFilePath: string;
  private config: AppConfig;

  constructor(customDir?: string) {
    const dir = customDir ?? (app ? app.getPath('userData') : os.tmpdir());
    this.configFilePath = path.join(dir, 'app-config.json');
    this.config = this.loadConfig();
  }

  enable({ app }: ModuleContext): void {
    // 应用启动生命周期：预热加载配置并监听退出保障落盘
    this.loadConfig();
    app.on('before-quit', () => {
      this.persist();
    });
  }

  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch {
      // 容错回退
    }
    return { ...DEFAULT_CONFIG };
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.configFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tempPath = `${this.configFilePath}.${Date.now()}.tmp`;
      const data = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(tempPath, data, 'utf-8');
      fs.renameSync(tempPath, this.configFilePath);
    } catch {
      // 降级使用普通写入
      try {
        fs.writeFileSync(this.configFilePath, JSON.stringify(this.config, null, 2), 'utf-8');
      } catch {
        // 静默处理磁盘异常
      }
    }
  }

  public getAll(): AppConfig {
    return { ...this.config };
  }

  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  public set(partial: Partial<AppConfig>): AppConfig {
    this.config = {
      ...this.config,
      ...partial,
    };
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
