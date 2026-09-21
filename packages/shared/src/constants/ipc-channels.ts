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
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
