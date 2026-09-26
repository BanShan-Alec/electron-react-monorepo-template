import { useState } from 'react';
import { useManualRequest } from '@/hooks/useManualRequest';
import { callIpc } from '@/lib/ipc';

// 私有常量
type DialogAction = 'openFile' | 'openDirectory' | 'saveFile' | 'showInFolder';

/** 对话框中失败时的状态框前缀（保持与原有一致的用户可见文案） */
const FAILURE_PREFIX: Record<DialogAction, string> = {
  openFile: '打开失败',
  openDirectory: '打开失败',
  saveFile: '保存失败',
  showInFolder: '定位失败',
};

interface DialogDescriptor {
  statusMessage: string;
  path?: string;
}

// 可抽离的逻辑处理函数/组件
/**
 * “取消”是业务流程而非异常；IPC 失败转成状态框文案（该通道无 message 弹窗），不抛给 useManualRequest。
 */
async function runDialogAction(
  action: DialogAction,
  selectedPath: string,
): Promise<DialogDescriptor> {
  try {
    switch (action) {
      case 'openFile': {
        const data = await callIpc('dialog.openFile', window.api.dialog.openFile, [
          { title: '选择测试文件' },
        ]);
        if (!data.canceled && data.filePaths.length > 0) {
          const path = data.filePaths[0];
          return { statusMessage: `已选择文件: ${path}`, path };
        }
        return { statusMessage: '用户取消了选择' };
      }
      case 'openDirectory': {
        const data = await callIpc('dialog.openDirectory', window.api.dialog.openDirectory, [
          { title: '选择测试文件夹' },
        ]);
        if (!data.canceled && data.filePaths.length > 0) {
          const path = data.filePaths[0];
          return { statusMessage: `已选择文件夹: ${path}`, path };
        }
        return { statusMessage: '用户取消了选择' };
      }
      case 'saveFile': {
        const data = await callIpc('dialog.saveFile', window.api.dialog.saveFile, [
          { title: '另存为示例', defaultPath: 'example.txt' },
        ]);
        if (!data.canceled && data.filePath) {
          return { statusMessage: `保存路径已选定: ${data.filePath}`, path: data.filePath };
        }
        return { statusMessage: '用户取消了保存' };
      }
      default: {
        await callIpc('shell.showItemInFolder', window.api.shell.showItemInFolder, [
          { path: selectedPath },
        ]);
        return {
          statusMessage: `已在资源管理器中定位: ${selectedPath}`,
          path: selectedPath,
        };
      }
    }
  } catch (error) {
    return { statusMessage: `${FAILURE_PREFIX[action]}: ${(error as Error).message}` };
  }
}

export function useNativeDialogs() {
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // 网络IO（显式触发）—— 单一动作通道；失败以状态框反馈（对话框流程的内嵌反馈渠道），并发时仅最后一次生效
  const { runAsync: runDialog, loading: isLoading } = useManualRequest(
    (action: DialogAction) => runDialogAction(action, selectedPath),
    {},
  );

  // 逻辑处理函数
  const runAction = async (action: DialogAction) => {
    try {
      const descriptor = await runDialog(action);
      setStatusMessage(descriptor.statusMessage);
      if (descriptor.path) {
        setSelectedPath(descriptor.path);
      }
    } catch {
      // 过期响应 CancelledError 已丢弃；业务失败已由 descriptor 反馈，此处防止未处理拒绝
    }
  };

  const handleOpenFile = () => void runAction('openFile');
  const handleOpenDirectory = () => void runAction('openDirectory');
  const handleSaveFile = () => void runAction('saveFile');
  const handleShowInFolder = () => void runAction('showInFolder');

  return {
    selectedPath,
    statusMessage,
    isLoading,
    handleOpenFile,
    handleOpenDirectory,
    handleSaveFile,
    handleShowInFolder,
  };
}
