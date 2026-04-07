import { DataType, DataTypeSizes, ByteOrder } from '../domain/types';

/**
 * Binary data reading utilities
 */
export class BinaryReader {
  private data: Uint8Array;
  private view: DataView;
  private position: number = 0;
  private byteOrder: ByteOrder;

  constructor(data: Uint8Array, byteOrder: ByteOrder = ByteOrder.LITTLE_ENDIAN) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.byteOrder = byteOrder;
  }

  /**
   * Get current position
   */
  get pos(): number {
    return this.position;
  }

  /**
   * Get data length
   */
  get length(): number {
    return this.data.length;
  }

  /**
   * Check if end of data reached
   */
  get eof(): boolean {
    return this.position >= this.data.length;
  }

  /**
   * Seek to position
   */
  seek(position: number): void {
    if (position < 0 || position > this.data.length) {
      throw new Error(`Position ${position} out of bounds (0-${this.data.length})`);
    }
    this.position = position;
  }

  /**
   * Skip bytes
   */
  skip(count: number): void {
    this.seek(this.position + count);
  }

  /**
   * Read value by data type
   */
  read(dataType: DataType): number {
    const isLittleEndian = this.byteOrder === ByteOrder.LITTLE_ENDIAN;

    let value: number;
    switch (dataType) {
      case DataType.UINT8:
        value = this.view.getUint8(this.position);
        break;
      case DataType.INT8:
        value = this.view.getInt8(this.position);
        break;
      case DataType.UINT16:
        value = this.view.getUint16(this.position, isLittleEndian);
        break;
      case DataType.INT16:
        value = this.view.getInt16(this.position, isLittleEndian);
        break;
      case DataType.UINT32:
        value = this.view.getUint32(this.position, isLittleEndian);
        break;
      case DataType.INT32:
        value = this.view.getInt32(this.position, isLittleEndian);
        break;
      case DataType.FLOAT32:
        value = this.view.getFloat32(this.position, isLittleEndian);
        break;
      case DataType.FLOAT64:
        value = this.view.getFloat64(this.position, isLittleEndian);
        break;
      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }

    this.position += DataTypeSizes[dataType];
    return value;
  }

  /**
   * Read value at specific address without moving position
   */
  readAt(address: number, dataType: DataType): number {
    const savedPos = this.position;
    this.seek(address);
    const value = this.read(dataType);
    this.position = savedPos;
    return value;
  }

  /**
   * Read array of values
   */
  readArray(dataType: DataType, count: number): number[] {
    const values: number[] = [];
    for (let i = 0; i < count; i++) {
      values.push(this.read(dataType));
    }
    return values;
  }

  /**
   * Read bytes
   */
  readBytes(count: number): Uint8Array {
    const bytes = this.data.slice(this.position, this.position + count);
    this.position += count;
    return bytes;
  }

  /**
   * Read 2D array (for maps)
   */
  read2DArray(dataType: DataType, rows: number, cols: number): number[][] {
    const result: number[][] = [];
    for (let row = 0; row < rows; row++) {
      result.push(this.readArray(dataType, cols));
    }
    return result;
  }
}

/**
 * Binary data writing utilities
 */
export class BinaryWriter {
  private data: Uint8Array;
  private view: DataView;
  private byteOrder: ByteOrder;

  constructor(data: Uint8Array, byteOrder: ByteOrder = ByteOrder.LITTLE_ENDIAN) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.byteOrder = byteOrder;
  }

  /**
   * Write value at address
   */
  write(address: number, dataType: DataType, value: number): void {
    const isLittleEndian = this.byteOrder === ByteOrder.LITTLE_ENDIAN;

    switch (dataType) {
      case DataType.UINT8:
        this.view.setUint8(address, value & 0xff);
        break;
      case DataType.INT8:
        this.view.setInt8(address, value);
        break;
      case DataType.UINT16:
        this.view.setUint16(address, value & 0xffff, isLittleEndian);
        break;
      case DataType.INT16:
        this.view.setInt16(address, value, isLittleEndian);
        break;
      case DataType.UINT32:
        this.view.setUint32(address, value >>> 0, isLittleEndian);
        break;
      case DataType.INT32:
        this.view.setInt32(address, value, isLittleEndian);
        break;
      case DataType.FLOAT32:
        this.view.setFloat32(address, value, isLittleEndian);
        break;
      case DataType.FLOAT64:
        this.view.setFloat64(address, value, isLittleEndian);
        break;
      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }
  }

  /**
   * Write array of values starting at address
   */
  writeArray(address: number, dataType: DataType, values: number[]): void {
    const size = DataTypeSizes[dataType];
    for (let i = 0; i < values.length; i++) {
      this.write(address + i * size, dataType, values[i]);
    }
  }

  /**
   * Write 2D array starting at address
   */
  write2DArray(address: number, dataType: DataType, values: number[][]): void {
    const size = DataTypeSizes[dataType];
    let offset = 0;
    for (const row of values) {
      for (const value of row) {
        this.write(address + offset, dataType, value);
        offset += size;
      }
    }
  }

  /**
   * Get the underlying data
   */
  getData(): Uint8Array {
    return this.data;
  }
}

/**
 * Convert hex string to byte array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/\s/g, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert byte array to hex string
 */
export function bytesToHex(bytes: Uint8Array, separator: string = ' '): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(separator);
}

/**
 * Calculate address for 2D map cell
 */
export function calculate2DAddress(
  baseAddress: number,
  row: number,
  col: number,
  cols: number,
  dataType: DataType
): number {
  const size = DataTypeSizes[dataType];
  return baseAddress + (row * cols + col) * size;
}
