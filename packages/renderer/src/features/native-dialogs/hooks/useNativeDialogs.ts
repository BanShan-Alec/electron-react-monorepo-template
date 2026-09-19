import { useState } from 'react';

export function useNativeDialogs() {
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenFile = async () => {
    setIsLoading(true);
    try {
      const res = await window.api.dialog.openFile({
        title: '选择测试文件',
      });
      if (res.success) {
        if (!res.data.canceled && res.data.filePaths.length > 0) {
          setSelectedPath(res.data.filePaths[0]);
          setStatusMessage(`已选择文件: ${res.data.filePaths[0]}`);
        } else {
          setStatusMessage('用户取消了选择');
        }
      } else {
        setStatusMessage(`打开失败: ${res.error}`);
      }
    } catch (err) {
      setStatusMessage(`打开失败: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDirectory = async () => {
    setIsLoading(true);
    try {
      const res = await window.api.dialog.openDirectory({
        title: '选择测试文件夹',
      });
      if (res.success) {
        if (!res.data.canceled && res.data.filePaths.length > 0) {
          setSelectedPath(res.data.filePaths[0]);
          setStatusMessage(`已选择文件夹: ${res.data.filePaths[0]}`);
        } else {
          setStatusMessage('用户取消了选择');
        }
      } else {
        setStatusMessage(`打开失败: ${res.error}`);
      }
    } catch (err) {
      setStatusMessage(`打开失败: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveFile = async () => {
    setIsLoading(true);
    try {
      const res = await window.api.dialog.saveFile({
        title: '另存为示例',
        defaultPath: 'example.txt',
      });
      if (res.success) {
        if (!res.data.canceled && res.data.filePath) {
          setSelectedPath(res.data.filePath);
          setStatusMessage(`保存路径已选定: ${res.data.filePath}`);
        } else {
          setStatusMessage('用户取消了保存');
        }
      } else {
        setStatusMessage(`保存失败: ${res.error}`);
      }
    } catch (err) {
      setStatusMessage(`保存失败: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowInFolder = async () => {
    if (!selectedPath) return;
    try {
      const res = await window.api.shell.showItemInFolder({ path: selectedPath });
      if (res.success) {
        setStatusMessage(`已在资源管理器中定位: ${selectedPath}`);
      } else {
        setStatusMessage(`定位失败: ${res.error}`);
      }
    } catch (err) {
      setStatusMessage(`定位失败: ${String(err)}`);
    }
  };

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
