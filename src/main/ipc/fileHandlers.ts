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

function decodeTextFile(buffer: Buffer): string {
  if (buffer.length >= 2) {
    const first = buffer[0];
    const second = buffer[1];

    if (first === 0xff && second === 0xfe) {
      return buffer.subarray(2).toString('utf16le');
    }

    if (first === 0xfe && second === 0xff) {
      const swapped = Buffer.alloc(buffer.length - 2);
      for (let index = 2; index < buffer.length; index += 2) {
        swapped[index - 2] = buffer[index + 1] ?? 0;
        swapped[index - 1] = buffer[index];
      }
      return swapped.toString('utf16le');
    }
  }

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8');
  }

  return buffer.toString('utf8');
}

function isXmlLike(buffer: Buffer): boolean {
  let offset = 0;

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    offset = 3;
  } else if (
    buffer.length >= 2 &&
    ((buffer[0] === 0xff && buffer[1] === 0xfe) || (buffer[0] === 0xfe && buffer[1] === 0xff))
  ) {
    return true;
  }

  while (offset < buffer.length) {
    const byte = buffer[offset];
    if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) {
      offset += 1;
      continue;
    }

    return byte === 0x3c;
  }

  return false;
}

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
        const buffer = await fs.promises.readFile(filePath);

        if (!isXmlLike(buffer)) {
          return {
            success: false,
            path: filePath,
            filename: path.basename(filePath),
            error:
              'Unsupported binary XDF format. This app currently supports XML-based TunerPro XDF files only.',
          };
        }

        const content = decodeTextFile(buffer);

        return {
          success: true,
          path: filePath,
          filename: path.basename(filePath),
          content,
          size: buffer.length,
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
