import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('inventoryDesktop', {
  secureStore: {
    getRefreshToken: (): Promise<string | null> => ipcRenderer.invoke('secure:get-refresh-token'),
    setRefreshToken: (token: string | null): Promise<void> =>
      ipcRenderer.invoke('secure:set-refresh-token', token),
  },
  printCurrentWindow: (): Promise<{ success: boolean; reason?: string }> =>
    ipcRenderer.invoke('print:current-window'),
  platform: process.platform,
});
