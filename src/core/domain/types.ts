/**
 * Core domain types for ECU tuning software
 */

/**
 * Data types for ECU binary values
 */
export enum DataType {
  UINT8 = 'uint8',
  INT8 = 'int8',
  UINT16 = 'uint16',
  INT16 = 'int16',
  UINT32 = 'uint32',
  INT32 = 'int32',
  FLOAT32 = 'float32',
  FLOAT64 = 'float64',
}

/**
 * Byte order for multi-byte values
 */
export enum ByteOrder {
  BIG_ENDIAN = 'big',
  LITTLE_ENDIAN = 'little',
}

/**
 * Data type sizes in bytes
 */
export const DataTypeSizes: Record<DataType, number> = {
  [DataType.UINT8]: 1,
  [DataType.INT8]: 1,
  [DataType.UINT16]: 2,
  [DataType.INT16]: 2,
  [DataType.UINT32]: 4,
  [DataType.INT32]: 4,
  [DataType.FLOAT32]: 4,
  [DataType.FLOAT64]: 8,
};

/**
 * Checksum algorithm types
 */
export enum ChecksumAlgorithm {
  SUM8 = 'sum8',
  SUM16 = 'sum16',
  SUM32 = 'sum32',
  CRC16 = 'crc16',
  CRC32 = 'crc32',
  XOR = 'xor',
  TWOS_COMPLEMENT = 'twosComplement',
}

/**
 * Map category for organization
 */
export enum MapCategory {
  FUEL = 'Fuel',
  IGNITION = 'Ignition',
  BOOST = 'Boost',
  IDLE = 'Idle',
  LIMITERS = 'Limiters',
  SENSORS = 'Sensors',
  TRANSMISSION = 'Transmission',
  EMISSIONS = 'Emissions',
  MISC = 'Miscellaneous',
}

/**
 * Edit action types for history tracking
 */
export enum EditActionType {
  CELL_EDIT = 'cell',
  RANGE_EDIT = 'range',
  BULK_EDIT = 'bulk',
  PASTE = 'paste',
  FILL = 'fill',
  INTERPOLATE = 'interpolate',
  PERCENTAGE = 'percentage',
  SMOOTH = 'smooth',
}

/**
 * Conversion equation for value transformation
 * Raw value from BIN -> Display value
 * Display value -> Raw value for storage
 */
export interface ConversionEquation {
  expression: string;        // e.g., "X*0.01172+0" or "(X-40)*1.8+32"
  inverseExpression?: string; // For converting back
  variables?: Record<string, number>;
}

/**
 * Address reference in BIN file
 */
export interface AddressRef {
  address: number;
  dataType: DataType;
  byteOrder: ByteOrder;
  bitMask?: number;
  bitShift?: number;
}

/**
 * Cell change for undo/redo
 */
export interface CellChange {
  row: number;
  col: number;
  oldValue: number;
  newValue: number;
}

/**
 * Range selection
 */
export interface CellRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/**
 * File metadata
 */
export interface FileMetadata {
  path: string;
  filename: string;
  size: number;
  lastModified: Date;
  md5Hash?: string;
}
