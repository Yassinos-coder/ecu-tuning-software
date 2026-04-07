import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/types/ipc';
import type {
  FileDialogOptions,
  FileDialogResult,
  BinFileResult,
  XdfFileResult,
  FileWriteResult,
  AiChatRequest,
  AiChatResponse,
  AiConfigRequest,
  ChecksumRequest,
  ChecksumResult,
  MenuAction,
  TuningLogEntry,
} from '../shared/types/ipc';

/**
 * Exposed API for renderer process
 */
const electronAPI = {
  // File operations
  file: {
    openDialog: (options: FileDialogOptions): Promise<FileDialogResult> =>
      ipcRenderer.invoke(IpcChannels.FILE_OPEN_DIALOG, options),

    saveDialog: (options: FileDialogOptions): Promise<FileDialogResult> =>
      ipcRenderer.invoke(IpcChannels.FILE_SAVE_DIALOG, options),

    readBin: (filePath: string): Promise<BinFileResult> =>
      ipcRenderer.invoke(IpcChannels.FILE_READ_BIN, filePath),

    writeBin: (filePath: string, data: Uint8Array): Promise<FileWriteResult> =>
      ipcRenderer.invoke(IpcChannels.FILE_WRITE_BIN, filePath, data),

    readXdf: (filePath: string): Promise<XdfFileResult> =>
      ipcRenderer.invoke(IpcChannels.FILE_READ_XDF, filePath),
  },

  // Checksum operations
  checksum: {
    calculate: (request: ChecksumRequest): Promise<ChecksumResult> =>
      ipcRenderer.invoke(IpcChannels.CHECKSUM_CALCULATE, request),

    validate: (request: ChecksumRequest): Promise<ChecksumResult> =>
      ipcRenderer.invoke(IpcChannels.CHECKSUM_VALIDATE, request),

    correct: (request: ChecksumRequest): Promise<ChecksumResult> =>
      ipcRenderer.invoke(IpcChannels.CHECKSUM_CORRECT, request),
  },

  // AI operations
  ai: {
    setConfig: (config: AiConfigRequest): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IpcChannels.AI_SET_CONFIG, config),

    chat: (request: AiChatRequest): Promise<AiChatResponse> =>
      ipcRenderer.invoke(IpcChannels.AI_CHAT, request),

    onStreamChunk: (callback: (chunk: string) => void) => {
      const handler = (_: unknown, chunk: string) => callback(chunk);
      ipcRenderer.on(IpcChannels.AI_STREAM_CHUNK, handler);
      return () => {
        ipcRenderer.removeListener(IpcChannels.AI_STREAM_CHUNK, handler);
      };
    },

    onStreamEnd: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(IpcChannels.AI_STREAM_END, handler);
      return () => {
        ipcRenderer.removeListener(IpcChannels.AI_STREAM_END, handler);
      };
    },

    onStreamError: (callback: (error: string) => void) => {
      const handler = (_: unknown, error: string) => callback(error);
      ipcRenderer.on(IpcChannels.AI_STREAM_ERROR, handler);
      return () => {
        ipcRenderer.removeListener(IpcChannels.AI_STREAM_ERROR, handler);
      };
    },
  },

  // Menu events
  menu: {
    onAction: (callback: (action: MenuAction) => void) => {
      const handler = (_: unknown, action: MenuAction) => callback(action);
      ipcRenderer.on(IpcChannels.MENU_ACTION, handler);
      return () => {
        ipcRenderer.removeListener(IpcChannels.MENU_ACTION, handler);
      };
    },
  },

  // App operations
  app: {
    getVersion: (): Promise<string> =>
      ipcRenderer.invoke(IpcChannels.APP_GET_VERSION),

    minimize: (): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.APP_MINIMIZE),

    maximize: (): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.APP_MAXIMIZE),

    quit: (): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.APP_QUIT),
  },

  // Logging
  log: {
    action: (entry: TuningLogEntry): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.LOG_ACTION, entry),

    error: (message: string, details?: Record<string, unknown>): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.LOG_ERROR, message, details),
  },
};

// Expose API to renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for renderer
export type ElectronAPI = typeof electronAPI;
