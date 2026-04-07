import { IpcMain } from 'electron';
import { IpcChannels } from '../../shared/types/ipc';
import type { ChecksumRequest, ChecksumResult } from '../../shared/types/ipc';

/**
 * Common checksum algorithms for ECU files
 */
const ChecksumAlgorithms = {
  /**
   * Simple 8-bit sum
   */
  sum8: (data: Uint8Array, start: number, end: number): number => {
    let sum = 0;
    for (let i = start; i <= end; i++) {
      sum = (sum + data[i]) & 0xff;
    }
    return sum;
  },

  /**
   * Simple 16-bit sum
   */
  sum16: (data: Uint8Array, start: number, end: number): number => {
    let sum = 0;
    for (let i = start; i <= end; i += 2) {
      const word = (data[i] << 8) | (data[i + 1] || 0);
      sum = (sum + word) & 0xffff;
    }
    return sum;
  },

  /**
   * Simple 32-bit sum
   */
  sum32: (data: Uint8Array, start: number, end: number): number => {
    let sum = 0;
    for (let i = start; i <= end; i += 4) {
      const dword =
        ((data[i] || 0) << 24) |
        ((data[i + 1] || 0) << 16) |
        ((data[i + 2] || 0) << 8) |
        (data[i + 3] || 0);
      sum = (sum + dword) >>> 0;
    }
    return sum;
  },

  /**
   * CRC16 (CCITT)
   */
  crc16: (data: Uint8Array, start: number, end: number): number => {
    let crc = 0xffff;
    for (let i = start; i <= end; i++) {
      crc ^= data[i] << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = ((crc << 1) ^ 0x1021) & 0xffff;
        } else {
          crc = (crc << 1) & 0xffff;
        }
      }
    }
    return crc;
  },

  /**
   * CRC32
   */
  crc32: (data: Uint8Array, start: number, end: number): number => {
    // Pre-computed CRC32 table
    const table: number[] = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }

    let crc = 0xffffffff;
    for (let i = start; i <= end; i++) {
      crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  },

  /**
   * XOR checksum
   */
  xor: (data: Uint8Array, start: number, end: number): number => {
    let result = 0;
    for (let i = start; i <= end; i++) {
      result ^= data[i];
    }
    return result;
  },

  /**
   * Two's complement checksum (common in Bosch ECUs)
   */
  twosComplement: (data: Uint8Array, start: number, end: number): number => {
    let sum = 0;
    for (let i = start; i <= end; i += 2) {
      const word = (data[i] << 8) | (data[i + 1] || 0);
      sum = (sum + word) & 0xffff;
    }
    return ((~sum + 1) & 0xffff);
  },
};

export function setupChecksumHandlers(ipcMain: IpcMain): void {
  // Calculate checksum
  ipcMain.handle(
    IpcChannels.CHECKSUM_CALCULATE,
    async (_, request: ChecksumRequest): Promise<ChecksumResult> => {
      try {
        const { data, algorithm, startAddress = 0, endAddress = data.length - 1 } = request;
        const algo = ChecksumAlgorithms[algorithm as keyof typeof ChecksumAlgorithms];

        if (!algo) {
          return {
            success: false,
            error: `Unknown checksum algorithm: ${algorithm}`,
          };
        }

        const calculated = algo(data, startAddress, endAddress);

        return {
          success: true,
          calculated,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Checksum calculation failed',
        };
      }
    }
  );

  // Validate checksum
  ipcMain.handle(
    IpcChannels.CHECKSUM_VALIDATE,
    async (_, request: ChecksumRequest): Promise<ChecksumResult> => {
      try {
        const {
          data,
          algorithm,
          startAddress = 0,
          endAddress = data.length - 1,
          checksumAddress,
        } = request;

        if (checksumAddress === undefined) {
          return {
            success: false,
            error: 'Checksum address is required for validation',
          };
        }

        const algo = ChecksumAlgorithms[algorithm as keyof typeof ChecksumAlgorithms];
        if (!algo) {
          return {
            success: false,
            error: `Unknown checksum algorithm: ${algorithm}`,
          };
        }

        const calculated = algo(data, startAddress, endAddress);

        // Read stored checksum (assuming 16-bit big-endian for common cases)
        let stored: number;
        if (algorithm === 'crc32' || algorithm === 'sum32') {
          stored =
            ((data[checksumAddress] << 24) |
              (data[checksumAddress + 1] << 16) |
              (data[checksumAddress + 2] << 8) |
              data[checksumAddress + 3]) >>>
            0;
        } else if (algorithm === 'sum8' || algorithm === 'xor') {
          stored = data[checksumAddress];
        } else {
          stored = (data[checksumAddress] << 8) | data[checksumAddress + 1];
        }

        return {
          success: true,
          calculated,
          stored,
          valid: calculated === stored,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Checksum validation failed',
        };
      }
    }
  );

  // Correct checksum
  ipcMain.handle(
    IpcChannels.CHECKSUM_CORRECT,
    async (_, request: ChecksumRequest): Promise<ChecksumResult> => {
      try {
        const {
          data,
          algorithm,
          startAddress = 0,
          endAddress = data.length - 1,
          checksumAddress,
        } = request;

        if (checksumAddress === undefined) {
          return {
            success: false,
            error: 'Checksum address is required for correction',
          };
        }

        const algo = ChecksumAlgorithms[algorithm as keyof typeof ChecksumAlgorithms];
        if (!algo) {
          return {
            success: false,
            error: `Unknown checksum algorithm: ${algorithm}`,
          };
        }

        // Create a copy of the data
        const correctedData = new Uint8Array(data);

        // Calculate new checksum
        const calculated = algo(correctedData, startAddress, endAddress);

        // Write corrected checksum
        if (algorithm === 'crc32' || algorithm === 'sum32') {
          correctedData[checksumAddress] = (calculated >>> 24) & 0xff;
          correctedData[checksumAddress + 1] = (calculated >>> 16) & 0xff;
          correctedData[checksumAddress + 2] = (calculated >>> 8) & 0xff;
          correctedData[checksumAddress + 3] = calculated & 0xff;
        } else if (algorithm === 'sum8' || algorithm === 'xor') {
          correctedData[checksumAddress] = calculated & 0xff;
        } else {
          correctedData[checksumAddress] = (calculated >>> 8) & 0xff;
          correctedData[checksumAddress + 1] = calculated & 0xff;
        }

        return {
          success: true,
          calculated,
          correctedData,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Checksum correction failed',
        };
      }
    }
  );
}
