import { IpcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { IpcChannels } from '../../shared/types/ipc';
import type {
  FileDialogOptions,
  FileDialogResult,
  BinFileResult,
  XdfFileResult,
  FileWriteResult,
} from '../../shared/types/ipc';

export function setupFileHandlers(ipcMain: IpcMain): void {
  // Open file dialog
  ipcMain.handle(
    IpcChannels.FILE_OPEN_DIALOG,
    async (_, options: FileDialogOptions): Promise<FileDialogResult> => {
      const result = await dialog.showOpenDialog({
        title: options.title || 'Open File',
        defaultPath: options.defaultPath,
        filters: options.filters || [
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: options.multiSelections
          ? ['openFile', 'multiSelections']
          : ['openFile'],
      });

      return {
        canceled: result.canceled,
        filePaths: result.filePaths,
      };
    }
  );

  // Save file dialog
  ipcMain.handle(
    IpcChannels.FILE_SAVE_DIALOG,
    async (_, options: FileDialogOptions): Promise<FileDialogResult> => {
      const result = await dialog.showSaveDialog({
        title: options.title || 'Save File',
        defaultPath: options.defaultPath,
        filters: options.filters || [
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      return {
        canceled: result.canceled,
        filePaths: result.filePath ? [result.filePath] : [],
      };
    }
  );

  // Read BIN file
  ipcMain.handle(
    IpcChannels.FILE_READ_BIN,
    async (_, filePath: string): Promise<BinFileResult> => {
      try {
        const buffer = await fs.promises.readFile(filePath);
        const data = new Uint8Array(buffer);

        return {
          success: true,
          path: filePath,
          filename: path.basename(filePath),
          data,
          size: data.length,
        };
      } catch (error) {
        return {
          success: false,
          path: filePath,
          filename: path.basename(filePath),
          error: error instanceof Error ? error.message : 'Unknown error reading file',
        };
      }
    }
  );

  // Write BIN file
  ipcMain.handle(
    IpcChannels.FILE_WRITE_BIN,
    async (_, filePath: string, data: Uint8Array): Promise<FileWriteResult> => {
      try {
        // Create backup before writing
        const backupPath = `${filePath}.backup`;
        if (fs.existsSync(filePath)) {
          await fs.promises.copyFile(filePath, backupPath);
        }

        // Write the new data
        await fs.promises.writeFile(filePath, Buffer.from(data));

        return {
          success: true,
          path: filePath,
        };
      } catch (error) {
        return {
          success: false,
          path: filePath,
          error: error instanceof Error ? error.message : 'Unknown error writing file',
        };
      }
    }
  );

  // Read XDF file
  ipcMain.handle(
    IpcChannels.FILE_READ_XDF,
    async (_, filePath: string): Promise<XdfFileResult> => {
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');

        return {
          success: true,
          path: filePath,
          filename: path.basename(filePath),
          content,
        };
      } catch (error) {
        return {
          success: false,
          path: filePath,
          filename: path.basename(filePath),
          error: error instanceof Error ? error.message : 'Unknown error reading XDF file',
        };
      }
    }
  );
}
