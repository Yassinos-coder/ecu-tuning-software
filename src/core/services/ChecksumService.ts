import { EcuFile, ChecksumInfo } from '../domain/EcuFile';
import { ChecksumAlgorithm } from '../domain/types';

/**
 * Checksum detection and correction service
 */
export class ChecksumService {
  /**
   * Common checksum locations for popular ECU types
   */
  private static readonly KNOWN_CHECKSUMS: Array<{
    name: string;
    fileSize: number;
    algorithm: ChecksumAlgorithm;
    startAddress: number;
    endAddress: number;
    checksumAddress: number;
  }> = [
    // Bosch ME7.x
    {
      name: 'Bosch ME7.x (512KB)',
      fileSize: 512 * 1024,
      algorithm: ChecksumAlgorithm.SUM16,
      startAddress: 0x10000,
      endAddress: 0x7FFFD,
      checksumAddress: 0x7FFFE,
    },
    // Bosch ME7.x (1MB)
    {
      name: 'Bosch ME7.x (1MB)',
      fileSize: 1024 * 1024,
      algorithm: ChecksumAlgorithm.SUM16,
      startAddress: 0x10000,
      endAddress: 0xFFFDD,
      checksumAddress: 0xFFFDE,
    },
    // Siemens/Continental
    {
      name: 'Siemens MS43 (512KB)',
      fileSize: 512 * 1024,
      algorithm: ChecksumAlgorithm.CRC32,
      startAddress: 0x0000,
      endAddress: 0x7FFF7,
      checksumAddress: 0x7FFF8,
    },
  ];

  /**
   * Calculate checksum for data range
   */
  calculate(
    data: Uint8Array,
    algorithm: ChecksumAlgorithm,
    startAddress: number,
    endAddress: number
  ): number {
    switch (algorithm) {
      case ChecksumAlgorithm.SUM8:
        return this.sum8(data, startAddress, endAddress);
      case ChecksumAlgorithm.SUM16:
        return this.sum16(data, startAddress, endAddress);
      case ChecksumAlgorithm.SUM32:
        return this.sum32(data, startAddress, endAddress);
      case ChecksumAlgorithm.CRC16:
        return this.crc16(data, startAddress, endAddress);
      case ChecksumAlgorithm.CRC32:
        return this.crc32(data, startAddress, endAddress);
      case ChecksumAlgorithm.XOR:
        return this.xor(data, startAddress, endAddress);
      case ChecksumAlgorithm.TWOS_COMPLEMENT:
        return this.twosComplement(data, startAddress, endAddress);
      default:
        throw new Error(`Unknown checksum algorithm: ${algorithm}`);
    }
  }

  /**
   * Try to detect checksum configuration for a file
   */
  detectChecksum(ecuFile: EcuFile): ChecksumInfo | null {
    const fileSize = ecuFile.size;

    // Check against known configurations
    for (const known of ChecksumService.KNOWN_CHECKSUMS) {
      if (known.fileSize === fileSize) {
        const calculated = this.calculate(
          ecuFile.data,
          known.algorithm,
          known.startAddress,
          known.endAddress
        );

        const stored = this.readStoredChecksum(
          ecuFile.data,
          known.checksumAddress,
          known.algorithm
        );

        return {
          algorithm: known.algorithm,
          startAddress: known.startAddress,
          endAddress: known.endAddress,
          checksumAddress: known.checksumAddress,
          calculatedValue: calculated,
          storedValue: stored,
          isValid: calculated === stored,
        };
      }
    }

    // Try to detect by scanning common patterns
    return this.scanForChecksum(ecuFile);
  }

  /**
   * Validate checksum for ECU file
   */
  validate(ecuFile: EcuFile): { valid: boolean; info?: ChecksumInfo } {
    const checksumInfo = ecuFile.checksumInfo || this.detectChecksum(ecuFile);

    if (!checksumInfo) {
      return { valid: false };
    }

    const calculated = this.calculate(
      ecuFile.data,
      checksumInfo.algorithm,
      checksumInfo.startAddress,
      checksumInfo.endAddress
    );

    const stored = this.readStoredChecksum(
      ecuFile.data,
      checksumInfo.checksumAddress,
      checksumInfo.algorithm
    );

    const valid = calculated === stored;

    return {
      valid,
      info: {
        ...checksumInfo,
        calculatedValue: calculated,
        storedValue: stored,
        isValid: valid,
      },
    };
  }

  /**
   * Correct checksum in ECU file
   */
  correct(ecuFile: EcuFile): { success: boolean; checksumInfo?: ChecksumInfo } {
    const checksumInfo = ecuFile.checksumInfo || this.detectChecksum(ecuFile);

    if (!checksumInfo) {
      return { success: false };
    }

    const calculated = this.calculate(
      ecuFile.data,
      checksumInfo.algorithm,
      checksumInfo.startAddress,
      checksumInfo.endAddress
    );

    // Write the corrected checksum
    this.writeChecksum(
      ecuFile.data,
      checksumInfo.checksumAddress,
      checksumInfo.algorithm,
      calculated
    );

    const updatedInfo: ChecksumInfo = {
      ...checksumInfo,
      calculatedValue: calculated,
      storedValue: calculated,
      isValid: true,
    };

    ecuFile.setChecksumInfo(updatedInfo);

    return { success: true, checksumInfo: updatedInfo };
  }

  /**
   * Read stored checksum value from file
   */
  private readStoredChecksum(
    data: Uint8Array,
    address: number,
    algorithm: ChecksumAlgorithm
  ): number {
    const is32bit = algorithm === ChecksumAlgorithm.CRC32 || algorithm === ChecksumAlgorithm.SUM32;
    const is8bit = algorithm === ChecksumAlgorithm.SUM8 || algorithm === ChecksumAlgorithm.XOR;

    if (is32bit) {
      return (
        ((data[address] << 24) |
          (data[address + 1] << 16) |
          (data[address + 2] << 8) |
          data[address + 3]) >>>
        0
      );
    } else if (is8bit) {
      return data[address];
    } else {
      // 16-bit (big endian)
      return (data[address] << 8) | data[address + 1];
    }
  }

  /**
   * Write checksum value to file
   */
  private writeChecksum(
    data: Uint8Array,
    address: number,
    algorithm: ChecksumAlgorithm,
    value: number
  ): void {
    const is32bit = algorithm === ChecksumAlgorithm.CRC32 || algorithm === ChecksumAlgorithm.SUM32;
    const is8bit = algorithm === ChecksumAlgorithm.SUM8 || algorithm === ChecksumAlgorithm.XOR;

    if (is32bit) {
      data[address] = (value >>> 24) & 0xff;
      data[address + 1] = (value >>> 16) & 0xff;
      data[address + 2] = (value >>> 8) & 0xff;
      data[address + 3] = value & 0xff;
    } else if (is8bit) {
      data[address] = value & 0xff;
    } else {
      // 16-bit (big endian)
      data[address] = (value >>> 8) & 0xff;
      data[address + 1] = value & 0xff;
    }
  }

  /**
   * Scan file for possible checksum locations
   */
  private scanForChecksum(ecuFile: EcuFile): ChecksumInfo | null {
    // This is a simplified heuristic - real implementation would be more sophisticated
    const data = ecuFile.data;
    const size = data.length;

    // Check common end-of-file checksum locations
    const candidates = [
      size - 2, // Last 2 bytes (16-bit)
      size - 4, // Last 4 bytes (32-bit)
      0xFFFE,   // Common 64KB boundary
      0x7FFE,   // Common 32KB boundary
    ];

    for (const checksumAddr of candidates) {
      if (checksumAddr >= size) continue;

      // Try sum16 on the entire file minus checksum
      const sum16 = this.sum16(data, 0, checksumAddr - 1);
      const stored16 = (data[checksumAddr] << 8) | data[checksumAddr + 1];

      if (sum16 === stored16) {
        return {
          algorithm: ChecksumAlgorithm.SUM16,
          startAddress: 0,
          endAddress: checksumAddr - 1,
          checksumAddress: checksumAddr,
          calculatedValue: sum16,
          storedValue: stored16,
          isValid: true,
        };
      }
    }

    return null;
  }

  // Checksum algorithms

  private sum8(data: Uint8Array, start: number, end: number): number {
    let sum = 0;
    for (let i = start; i <= end && i < data.length; i++) {
      sum = (sum + data[i]) & 0xff;
    }
    return sum;
  }

  private sum16(data: Uint8Array, start: number, end: number): number {
    let sum = 0;
    for (let i = start; i <= end && i < data.length - 1; i += 2) {
      const word = (data[i] << 8) | (data[i + 1] || 0);
      sum = (sum + word) & 0xffff;
    }
    return sum;
  }

  private sum32(data: Uint8Array, start: number, end: number): number {
    let sum = 0;
    for (let i = start; i <= end && i < data.length - 3; i += 4) {
      const dword =
        ((data[i] || 0) << 24) |
        ((data[i + 1] || 0) << 16) |
        ((data[i + 2] || 0) << 8) |
        (data[i + 3] || 0);
      sum = (sum + dword) >>> 0;
    }
    return sum;
  }

  private crc16(data: Uint8Array, start: number, end: number): number {
    let crc = 0xffff;
    for (let i = start; i <= end && i < data.length; i++) {
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
  }

  private crc32(data: Uint8Array, start: number, end: number): number {
    const table: number[] = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }

    let crc = 0xffffffff;
    for (let i = start; i <= end && i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  private xor(data: Uint8Array, start: number, end: number): number {
    let result = 0;
    for (let i = start; i <= end && i < data.length; i++) {
      result ^= data[i];
    }
    return result;
  }

  private twosComplement(data: Uint8Array, start: number, end: number): number {
    let sum = 0;
    for (let i = start; i <= end && i < data.length - 1; i += 2) {
      const word = (data[i] << 8) | (data[i + 1] || 0);
      sum = (sum + word) & 0xffff;
    }
    return (~sum + 1) & 0xffff;
  }
}
