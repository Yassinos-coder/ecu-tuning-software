import { v4 as uuid } from 'uuid';
import type { FileMetadata, ChecksumAlgorithm } from './types';

/**
 * Checksum information for an ECU file
 */
export interface ChecksumInfo {
  algorithm: ChecksumAlgorithm;
  startAddress: number;
  endAddress: number;
  checksumAddress: number;
  calculatedValue?: number;
  storedValue?: number;
  isValid?: boolean;
}

/**
 * Represents a loaded ECU binary file
 */
export class EcuFile {
  readonly id: string;
  readonly metadata: FileMetadata;
  readonly originalData: Uint8Array;
  private _modifiedData: Uint8Array;
  private _checksumInfo?: ChecksumInfo;
  private _isDirty: boolean = false;

  constructor(
    metadata: FileMetadata,
    data: Uint8Array,
    checksumInfo?: ChecksumInfo
  ) {
    this.id = uuid();
    this.metadata = metadata;
    this.originalData = new Uint8Array(data);
    this._modifiedData = new Uint8Array(data);
    this._checksumInfo = checksumInfo;
  }

  /**
   * Get the current (possibly modified) data
   */
  get data(): Uint8Array {
    return this._modifiedData;
  }

  /**
   * Get file size in bytes
   */
  get size(): number {
    return this._modifiedData.length;
  }

  /**
   * Check if file has unsaved changes
   */
  get isDirty(): boolean {
    return this._isDirty;
  }

  /**
   * Get checksum information
   */
  get checksumInfo(): ChecksumInfo | undefined {
    return this._checksumInfo;
  }

  /**
   * Set checksum information
   */
  setChecksumInfo(info: ChecksumInfo): void {
    this._checksumInfo = info;
  }

  /**
   * Read a single byte at address
   */
  readByte(address: number): number {
    if (address < 0 || address >= this._modifiedData.length) {
      throw new Error(`Address ${address} out of bounds (0-${this._modifiedData.length - 1})`);
    }
    return this._modifiedData[address];
  }

  /**
   * Read multiple bytes at address
   */
  readBytes(address: number, length: number): Uint8Array {
    if (address < 0 || address + length > this._modifiedData.length) {
      throw new Error(`Address range ${address}-${address + length} out of bounds`);
    }
    return this._modifiedData.slice(address, address + length);
  }

  /**
   * Write a single byte at address
   */
  writeByte(address: number, value: number): void {
    if (address < 0 || address >= this._modifiedData.length) {
      throw new Error(`Address ${address} out of bounds`);
    }
    if (value < 0 || value > 255) {
      throw new Error(`Value ${value} out of byte range (0-255)`);
    }
    this._modifiedData[address] = value;
    this._isDirty = true;
  }

  /**
   * Write multiple bytes at address
   */
  writeBytes(address: number, values: Uint8Array): void {
    if (address < 0 || address + values.length > this._modifiedData.length) {
      throw new Error(`Address range ${address}-${address + values.length} out of bounds`);
    }
    for (let i = 0; i < values.length; i++) {
      this._modifiedData[address + i] = values[i];
    }
    this._isDirty = true;
  }

  /**
   * Get the original value at an address
   */
  getOriginalByte(address: number): number {
    if (address < 0 || address >= this.originalData.length) {
      throw new Error(`Address ${address} out of bounds`);
    }
    return this.originalData[address];
  }

  /**
   * Check if a specific address has been modified
   */
  isAddressModified(address: number): boolean {
    if (address < 0 || address >= this._modifiedData.length) {
      return false;
    }
    return this._modifiedData[address] !== this.originalData[address];
  }

  /**
   * Get list of all modified addresses
   */
  getModifiedAddresses(): number[] {
    const modified: number[] = [];
    for (let i = 0; i < this._modifiedData.length; i++) {
      if (this._modifiedData[i] !== this.originalData[i]) {
        modified.push(i);
      }
    }
    return modified;
  }

  /**
   * Restore all data to original values
   */
  restoreAll(): void {
    this._modifiedData = new Uint8Array(this.originalData);
    this._isDirty = false;
  }

  /**
   * Restore a range of addresses to original values
   */
  restoreRange(startAddress: number, endAddress: number): void {
    for (let i = startAddress; i <= endAddress && i < this._modifiedData.length; i++) {
      this._modifiedData[i] = this.originalData[i];
    }
    this._isDirty = this.getModifiedAddresses().length > 0;
  }

  /**
   * Apply corrected checksum data
   */
  applyChecksumCorrection(correctedData: Uint8Array): void {
    if (correctedData.length !== this._modifiedData.length) {
      throw new Error('Corrected data size mismatch');
    }
    this._modifiedData = correctedData;
    this._isDirty = true;
  }

  /**
   * Mark file as saved (no longer dirty)
   */
  markSaved(): void {
    this._isDirty = false;
  }

  /**
   * Get a hex dump of the data
   */
  getHexDump(startAddress: number, length: number): string {
    const lines: string[] = [];
    const endAddress = Math.min(startAddress + length, this._modifiedData.length);

    for (let addr = startAddress; addr < endAddress; addr += 16) {
      const bytes: string[] = [];
      const ascii: string[] = [];

      for (let i = 0; i < 16 && addr + i < endAddress; i++) {
        const byte = this._modifiedData[addr + i];
        bytes.push(byte.toString(16).padStart(2, '0').toUpperCase());
        ascii.push(byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.');
      }

      const addrStr = addr.toString(16).padStart(8, '0').toUpperCase();
      const byteStr = bytes.join(' ').padEnd(48, ' ');
      lines.push(`${addrStr}  ${byteStr} ${ascii.join('')}`);
    }

    return lines.join('\n');
  }
}
