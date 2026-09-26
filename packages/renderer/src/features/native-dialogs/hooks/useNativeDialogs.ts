import { useState } from 'react';
import { useManualRequest } from '@/hooks/useManualRequest';

// 私有常量
type DialogAction = 'openFile' | 'openDirectory' | 'saveFile' | 'showInFolder';

interface DialogDescriptor {
  statusMessage: string;
  path?: string;
}

// 可抽离的逻辑处理函数/组件
async function runDialogAction(
  action: DialogAction,
  selectedPath: string,
): Promise<DialogDescriptor> {
  switch (action) {
    case 'openFile': {
      const res = await window.api.dialog.openFile({ title: '选择测试文件' });
      if (!res.success) {
        return { statusMessage: `打开失败: ${res.error}` };
      }
      if (!res.data.canceled && res.data.filePaths.length > 0) {
        const path = res.data.filePaths[0];
        return { statusMessage: `已选择文件: ${path}`, path };
      }
      return { statusMessage: '用户取消了选择' };
    }
    case 'openDirectory': {
      const res = await window.api.dialog.openDirectory({ title: '选择测试文件夹' });
      if (!res.success) {
        return { statusMessage: `打开失败: ${res.error}` };
      }
      if (!res.data.canceled && res.data.filePaths.length > 0) {
        const path = res.data.filePaths[0];
        return { statusMessage: `已选择文件夹: ${path}`, path };
      }
      return { statusMessage: '用户取消了选择' };
    }
    case 'saveFile': {
      const res = await window.api.dialog.saveFile({
        title: '另存为示例',
        defaultPath: 'example.txt',
      });
      if (!res.success) {
        return { statusMessage: `保存失败: ${res.error}` };
      }
      if (!res.data.canceled && res.data.filePath) {
        return {
          statusMessage: `保存路径已选定: ${res.data.filePath}`,
          path: res.data.filePath,
        };
      }
      return { statusMessage: '用户取消了保存' };
    }
    case 'showInFolder': {
      const res = await window.api.shell.showItemInFolder({ path: selectedPath });
      if (!res.success) {
        return { statusMessage: `定位失败: ${res.error}` };
      }
      return {
        statusMessage: `已在资源管理器中定位: ${selectedPath}`,
        path: selectedPath,
      };
    }
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
