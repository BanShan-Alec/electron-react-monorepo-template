/**
 * IPC 通信通道常量定义 (IPC Channels)
 */
export const IPC_CHANNELS = {
  SYSTEM_PING: 'system:ping',
  SYSTEM_GET_INFO: 'system:get-info',

  COUNTER_GET: 'counter:get',
  COUNTER_INCREMENT: 'counter:increment',
  COUNTER_DECREMENT: 'counter:decrement',
  COUNTER_RESET: 'counter:reset',

  CALCULATOR_CALCULATE: 'calculator:calculate',

  CONFIG_GET: 'config:get',
  CONFIG_UPDATE: 'config:update',
  CONFIG_RESET: 'config:reset',

  DIAGNOSTICS_LOG: 'diagnostics:log',
  DIAGNOSTICS_OPEN_LOG_FOLDER: 'diagnostics:open-log-folder',
  DIAGNOSTICS_PERFORM_ACTION: 'diagnostics:perform-action',

  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_OPEN_DIRECTORY: 'dialog:open-directory',
  DIALOG_SAVE_FILE: 'dialog:save-file',
  SHELL_SHOW_ITEM_IN_FOLDER: 'shell:show-item-in-folder',
  SHELL_OPEN_EXTERNAL: 'shell:open-external',

  // 自动更新通道 (Updater IPC Channels)
  UPDATER_GET_STATE: 'updater:get-state',
  UPDATER_CHECK: 'updater:check',
  UPDATER_DOWNLOAD: 'updater:download',
  UPDATER_CANCEL: 'updater:cancel',
  UPDATER_INSTALL: 'updater:install',
  UPDATER_OPEN_WINDOW: 'updater:open-window',
  UPDATER_CLOSE_WINDOW: 'updater:close-window',
  UPDATER_EVENT_STATE: 'updater:event:state',
  UPDATER_EVENT_PROGRESS: 'updater:event:progress',
  UPDATER_MOCK_EMIT: 'updater:mock:emit',

  // 跨窗口配置广播 (Config broadcast)
  CONFIG_EVENT_CHANGED: 'config:event:changed',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
