/**
 * IPC Channel definitions for Electron main/renderer communication
 */

export const IpcChannels = {
  // File operations
  FILE_OPEN_DIALOG: 'file:open-dialog',
  FILE_SAVE_DIALOG: 'file:save-dialog',
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_READ_BIN: 'file:read-bin',
  FILE_WRITE_BIN: 'file:write-bin',
  FILE_READ_XDF: 'file:read-xdf',

  // Checksum operations
  CHECKSUM_CALCULATE: 'checksum:calculate',
  CHECKSUM_VALIDATE: 'checksum:validate',
  CHECKSUM_CORRECT: 'checksum:correct',

  // AI operations
  AI_SET_CONFIG: 'ai:set-config',
  AI_CHAT: 'ai:chat',
  AI_STREAM_START: 'ai:stream-start',
  AI_STREAM_CHUNK: 'ai:stream-chunk',
  AI_STREAM_END: 'ai:stream-end',
  AI_STREAM_ERROR: 'ai:stream-error',

  // Menu events
  MENU_ACTION: 'menu:action',

  // App operations
  APP_GET_VERSION: 'app:get-version',
  APP_QUIT: 'app:quit',
  APP_MINIMIZE: 'app:minimize',
  APP_MAXIMIZE: 'app:maximize',

  // Logging
  LOG_ACTION: 'log:action',
  LOG_ERROR: 'log:error',
} as const;

export type IpcChannel = typeof IpcChannels[keyof typeof IpcChannels];

export const MenuActions = {
  OPEN_BIN: 'open-bin',
  OPEN_XDF: 'open-xdf',
  SAVE: 'save',
  SAVE_AS: 'save-as',
  EXPORT_BIN: 'export-bin',
  UNDO: 'undo',
  REDO: 'redo',
  FIND_MAP: 'find-map',
  RESTORE_ORIGINAL: 'restore-original',
  TOGGLE_EXPLORER: 'toggle-explorer',
  TOGGLE_HEX: 'toggle-hex',
  TOGGLE_AI: 'toggle-ai',
  VIEW_2D: 'view-2d',
  VIEW_3D: 'view-3d',
  VALIDATE_CHECKSUM: 'validate-checksum',
  CORRECT_CHECKSUM: 'correct-checksum',
  COMPARE_ORIGINAL: 'compare-original',
  SHOW_MODIFIED: 'show-modified',
  AI_SETTINGS: 'ai-settings',
  SAFETY_GUIDELINES: 'safety-guidelines',
  SHORTCUTS: 'shortcuts',
} as const;

export type MenuAction = typeof MenuActions[keyof typeof MenuActions];

/**
 * File dialog options
 */
export interface FileDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
  multiSelections?: boolean;
}

/**
 * File dialog result
 */
export interface FileDialogResult {
  canceled: boolean;
  filePaths: string[];
}

/**
 * Binary file read result
 */
export interface BinFileResult {
  success: boolean;
  path: string;
  filename: string;
  data?: Uint8Array;
  size?: number;
  error?: string;
}

/**
 * XDF file read result
 */
export interface XdfFileResult {
  success: boolean;
  path: string;
  filename: string;
  content?: string;
  size?: number;
  error?: string;
}

/**
 * File write result
 */
export interface FileWriteResult {
  success: boolean;
  path: string;
  error?: string;
}

/**
 * AI chat request
 */
export interface AiChatRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  context?: {
    mapTitle?: string;
    mapValues?: number[][];
    mapUnits?: string;
    ecuType?: string;
  };
  stream?: boolean;
}

export interface AiConfigRequest {
  apiKey: string | null;
  endpoint?: string;
}

/**
 * AI chat response
 */
export interface AiChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Checksum calculation request
 */
export interface ChecksumRequest {
  data: Uint8Array;
  algorithm: string;
  startAddress?: number;
  endAddress?: number;
  checksumAddress?: number;
}

/**
 * Checksum result
 */
export interface ChecksumResult {
  success: boolean;
  calculated?: number;
  stored?: number;
  valid?: boolean;
  correctedData?: Uint8Array;
  error?: string;
}

/**
 * Tuning action log entry
 */
export interface TuningLogEntry {
  timestamp: Date;
  action: string;
  mapId?: string;
  mapTitle?: string;
  details: Record<string, unknown>;
}
