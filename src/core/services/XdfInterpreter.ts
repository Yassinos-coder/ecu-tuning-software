import { XMLParser } from 'fast-xml-parser';
import { v4 as uuid } from 'uuid';
import { CalibrationMap } from '../domain/CalibrationMap';
import { Axis } from '../domain/Axis';
import { Scalar } from '../domain/Scalar';
import {
  DataType,
  ByteOrder,
  MapCategory,
  type ConversionEquation,
  type AddressRef,
} from '../domain/types';

/**
 * XDF file structure (parsed)
 */
export interface XdfDefinition {
  title: string;
  description: string;
  author?: string;
  baseOffset: number;
  defaults: {
    dataType: DataType;
    byteOrder: ByteOrder;
  };
  categories: XdfCategory[];
  maps: CalibrationMap[];
  scalars: Scalar[];
}

export interface XdfCategory {
  id: string;
  name: string;
  index: number;
}

type XdfDefaults = {
  dataType: DataType;
  byteOrder: ByteOrder;
};

interface ParsedEmbeddedData {
  addressRef: AddressRef;
  rows?: number;
  cols?: number;
}

/**
 * Parses TunerPro XDF definition files
 */
export class XdfInterpreter {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
      parseAttributeValue: true,
      trimValues: true,
    });
  }

  /**
   * Parse XDF file content
   */
  parse(xdfContent: string): XdfDefinition {
    const normalizedContent = xdfContent.replace(/^\uFEFF/, '').trimStart();
    if (!normalizedContent.startsWith('<')) {
      throw new Error(
        'Unsupported binary XDF format. This app currently supports XML-based TunerPro XDF files only.'
      );
    }

    const parsed = this.parser.parse(normalizedContent);
    const xdf = parsed.XDFFORMAT;

    if (!xdf) {
      throw new Error('Invalid XDF format: missing XDFFORMAT root element');
    }

    const header = xdf.XDFHEADER || {};
    const categories = this.parseCategories(header.CATEGORY);
    const baseOffset = this.parseBaseOffset(header.BASEOFFSET);
    const defaults = this.parseDefaults(header.DEFAULTS);

    const tables = this.ensureArray(xdf.XDFTABLE);
    const maps = tables
      .map(t => this.parseTable(t, categories, baseOffset, defaults))
      .filter((map): map is CalibrationMap => Boolean(map));

    const constants = this.ensureArray(xdf.XDFCONSTANT);
    const constantScalars = constants
      .map(c => this.parseConstant(c, categories, baseOffset, defaults))
      .filter((scalar): scalar is Scalar => Boolean(scalar));
    const tableScalars = maps
      .filter(map => map.rows === 1 && map.cols === 1)
      .map(map => this.createScalarFromTable(map));
    const scalars = [...constantScalars];

    for (const scalar of tableScalars) {
      const alreadyDefined = scalars.some(
        existing =>
          existing.title === scalar.title &&
          existing.addressRef.address === scalar.addressRef.address
      );
      if (!alreadyDefined) {
        scalars.push(scalar);
      }
    }

    return {
      title: this.readString(header, ['@_title', 'title', 'deftitle'], 'Unknown'),
      description: this.readString(header, ['@_description', 'description'], ''),
      author: this.readString(header, ['@_author', 'author']),
      baseOffset,
      defaults,
      categories,
      maps,
      scalars,
    };
  }

  /**
   * Parse categories
   */
  private parseCategories(categoryData: unknown): XdfCategory[] {
    const categories: XdfCategory[] = [];
    const items = this.ensureArray(categoryData);

    for (const item of items) {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        categories.push({
          id: uuid(),
          name: this.readString(obj, ['#text', '@_name', 'name'], 'Unknown'),
          index: this.readNumber(obj, ['@_index', 'index'], categories.length),
        });
      } else if (typeof item === 'string') {
        categories.push({
          id: uuid(),
          name: item,
          index: categories.length,
        });
      }
    }

    // Add default category if empty
    if (categories.length === 0) {
      categories.push({ id: uuid(), name: 'Uncategorized', index: 0 });
    }

    return categories;
  }

  /**
   * Parse base offset
   */
  private parseBaseOffset(offsetData: unknown): number {
    if (!offsetData) return 0;

    if (typeof offsetData === 'object' && offsetData !== null) {
      const obj = offsetData as Record<string, unknown>;
      const value = obj['@_offset'] || obj['@_value'] || obj['#text'];
      return this.parseHexOrDecimal(String(value || '0'));
    }

    return this.parseHexOrDecimal(String(offsetData));
  }

  /**
   * Parse defaults
   */
  private parseDefaults(defaultsData: unknown): XdfDefaults {
    const defaults = {
      dataType: DataType.UINT8,
      byteOrder: ByteOrder.LITTLE_ENDIAN,
    };

    if (!defaultsData || typeof defaultsData !== 'object') {
      return defaults;
    }

    const obj = defaultsData as Record<string, unknown>;

    // Parse data size
    const dataSize = this.readNumber(obj, ['@_datasizeinbits', 'datasizeinbits'], 8);
    const signed = this.readBoolean(obj, ['@_signed', 'signed'], false);
    defaults.dataType = this.getDataType(dataSize, signed);

    // Parse byte order
    if (!this.readBoolean(obj, ['@_lsbfirst', 'lsbfirst'], true)) {
      defaults.byteOrder = ByteOrder.BIG_ENDIAN;
    }

    return defaults;
  }

  /**
   * Parse a table element into a CalibrationMap
   */
  private parseTable(
    tableData: unknown,
    categories: XdfCategory[],
    baseOffset: number,
    defaults: XdfDefaults
  ): CalibrationMap | null {
    if (!tableData || typeof tableData !== 'object') {
      return null;
    }

    const table = tableData as Record<string, unknown>;
    const title = this.readString(table, ['@_title', 'title'], 'Unknown Map');

    // Parse axes
    const axesData = this.ensureArray(table.XDFAXIS);
    let xAxis: Axis | undefined;
    let yAxis: Axis | undefined;
    let rows = 1;
    let cols = 1;

    for (const axisData of axesData) {
      if (!axisData || typeof axisData !== 'object') continue;
      const axis = axisData as Record<string, unknown>;
      const id = String(axis['@_id'] || '').toLowerCase();

      const parsedAxis = this.parseAxis(axis, baseOffset, defaults);
      if (!parsedAxis) continue;

      if (id === 'x') {
        xAxis = parsedAxis;
        cols = parsedAxis.count;
      } else if (id === 'y') {
        yAxis = parsedAxis;
        rows = parsedAxis.count;
      }
    }

    // Parse Z axis (data)
    const zAxisData = axesData.find((a: unknown) => {
      if (!a || typeof a !== 'object') return false;
      const obj = a as Record<string, unknown>;
      return String(obj['@_id'] || '').toLowerCase() === 'z';
    });

    let addressRef: AddressRef;
    let equation: ConversionEquation | undefined;
    let zUnits = '';
    let decimalPlaces = 2;
    let min: number | undefined;
    let max: number | undefined;

    if (zAxisData && typeof zAxisData === 'object') {
      const zAxis = zAxisData as Record<string, unknown>;
      const embeddedData = this.parseEmbeddedData(zAxis, baseOffset, defaults);
      if (!embeddedData) return null;

      addressRef = embeddedData.addressRef;
      rows = embeddedData.rows ?? rows;
      cols = embeddedData.cols ?? cols;
      equation = this.parseEquation(zAxis);
      zUnits = this.readString(zAxis, ['@_units', 'units', 'UNITS'], '');
      decimalPlaces = this.readNumber(zAxis, ['@_decimalplaces', '@_decimalpl', 'decimalplaces', 'decimalpl'], 2);
      min = this.readOptionalNumber(zAxis, ['@_min', 'min']);
      max = this.readOptionalNumber(zAxis, ['@_max', 'max']);
    } else {
      return null;
    }

    // Determine category
    const category = this.resolveCategory(table, categories);
    const mapCategory = this.mapStringToCategory(category);

    // Parse units and decimal places
    const units = zUnits || this.readString(table, ['@_units', 'units', 'UNITS'], '');
    decimalPlaces = this.readNumber(table, ['@_decimalplaces', '@_decimalpl', 'decimalplaces', 'decimalpl'], decimalPlaces);

    return new CalibrationMap({
      title,
      description: this.readString(table, ['@_description', 'description'], ''),
      category: mapCategory,
      addressRef,
      rows,
      cols,
      units,
      decimalPlaces,
      equation,
      min,
      max,
      xAxis,
      yAxis,
    });
  }

  /**
   * Parse an axis element
   */
  private parseAxis(
    axisData: Record<string, unknown>,
    baseOffset: number,
    defaults: XdfDefaults
  ): Axis | null {
    const embeddedData = this.parseEmbeddedData(axisData, baseOffset, defaults);
    const indexCount = this.readNumber(axisData, ['@_indexcount', 'indexcount'], 1);

    if (indexCount <= 0) return null;
    if (!embeddedData) return null;

    const embeddedCount = embeddedData.cols && embeddedData.cols > 1
      ? embeddedData.cols
      : embeddedData.rows;

    return new Axis({
      title: this.readString(axisData, ['@_title', 'title'], 'Axis'),
      units: this.readString(axisData, ['@_units', 'units', 'UNITS'], ''),
      addressRef: embeddedData.addressRef,
      count: embeddedCount ?? indexCount,
      equation: this.parseEquation(axisData),
      min: this.readOptionalNumber(axisData, ['@_min', 'min']),
      max: this.readOptionalNumber(axisData, ['@_max', 'max']),
    });
  }

  /**
   * Parse a constant element into a Scalar
   */
  private parseConstant(
    constantData: unknown,
    categories: XdfCategory[],
    baseOffset: number,
    defaults: XdfDefaults
  ): Scalar | null {
    if (!constantData || typeof constantData !== 'object') {
      return null;
    }

    const constant = constantData as Record<string, unknown>;
    const title = this.readString(constant, ['@_title', 'title'], 'Unknown');
    const embeddedData = this.parseEmbeddedData(constant, baseOffset, defaults);
    if (!embeddedData) return null;

    // Determine category
    const category = this.resolveCategory(constant, categories);
    const mapCategory = this.mapStringToCategory(category);

    return new Scalar({
      title,
      description: this.readString(constant, ['@_description', 'description'], ''),
      category: mapCategory,
      addressRef: embeddedData.addressRef,
      units: this.readString(constant, ['@_units', 'units', 'UNITS'], ''),
      decimalPlaces: this.readNumber(constant, ['@_decimalplaces', '@_decimalpl', 'decimalplaces', 'decimalpl'], 2),
      equation: this.parseEquation(constant),
      min: this.readOptionalNumber(constant, ['@_min', 'min']),
      max: this.readOptionalNumber(constant, ['@_max', 'max']),
    });
  }

  private createScalarFromTable(table: CalibrationMap): Scalar {
    return new Scalar({
      title: table.title,
      description: table.description,
      category: table.category,
      addressRef: table.addressRef,
      units: table.units,
      decimalPlaces: table.decimalPlaces,
      equation: table.equation,
      min: table.min,
      max: table.max,
    });
  }

  /**
   * Ensure value is an array
   */
  private ensureArray<T>(value: T | T[] | undefined | null): T[] {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }

  private parseEmbeddedData(
    element: Record<string, unknown>,
    baseOffset: number,
    defaults: XdfDefaults
  ): ParsedEmbeddedData | null {
    const embeddedData = this.asObject(element.EMBEDDEDDATA) || this.asObject(element.embeddedData);
    if (!embeddedData) return null;

    const addressText = this.readString(embeddedData, ['@_mmedaddress', 'mmedaddress']);
    if (!addressText) return null;

    const address = this.parseHexOrDecimal(addressText);
    if (address === 0xFFFFFFFF) return null;

    const sizeBits = this.readNumber(embeddedData, ['@_mmedelementsizebits', 'mmedelementsizebits'], 8);
    const typeFlags = this.readNumber(embeddedData, ['@_mmedtypeflags', 'mmedtypeflags'], 0);
    const signed = this.hasAnyKey(embeddedData, ['@_mmedsigned', 'mmedsigned'])
      ? this.readBoolean(embeddedData, ['@_mmedsigned', 'mmedsigned'], false)
      : (typeFlags & 0x01) !== 0;
    const lsbFirst = this.hasAnyKey(embeddedData, ['@_mmedlsbfirst', 'mmedlsbfirst'])
      ? this.readBoolean(embeddedData, ['@_mmedlsbfirst', 'mmedlsbfirst'], true)
      : defaults.byteOrder === ByteOrder.LITTLE_ENDIAN;

    return {
      addressRef: {
        address: address + baseOffset,
        dataType: this.getDataType(sizeBits, signed, typeFlags),
        byteOrder: lsbFirst ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN,
      },
      rows: this.readOptionalNumber(embeddedData, ['@_mmedrowcount', 'mmedrowcount']),
      cols: this.readOptionalNumber(embeddedData, ['@_mmedcolcount', 'mmedcolcount']),
    };
  }

  private parseEquation(element: Record<string, unknown>): ConversionEquation | undefined {
    const mathData = this.asObject(element.MATH);
    if (!mathData) return undefined;

    const expression = this.readString(mathData, ['@_equation', 'equation'], 'X')
      .trim()
      .replace(/\b[xX]\b/g, 'X');
    if (!expression) return undefined;

    const linear = this.parseLinearEquation(expression);
    if (!linear || linear.factor === 0) {
      return { expression };
    }

    if (linear.factor === 1 && linear.offset === 0) {
      return { expression, inverseExpression: 'X' };
    }

    return {
      expression,
      inverseExpression: `(X - (${linear.offset})) / (${linear.factor})`,
    };
  }

  private parseLinearEquation(equation: string): { factor: number; offset: number } | null {
    const normalized = equation.trim();
    const numberPattern = '([\\d.\\-+eE]+)';

    if (/^X$/i.test(normalized)) return { factor: 1, offset: 0 };

    const rational = normalized.match(
      new RegExp(`^\\(\\s*\\(\\s*${numberPattern}\\s*\\*\\s*X\\s*\\)\\s*([+-])\\s*${numberPattern}\\s*\\)\\s*/\\s*\\(\\s*${numberPattern}\\s*([+-])\\s*\\(\\s*${numberPattern}\\s*\\*\\s*X\\s*\\)\\s*\\)$`, 'i')
    );
    if (rational) {
      const a = this.parseFloatToken(rational[1]);
      const b = this.parseFloatToken(rational[3]) * (rational[2] === '-' ? -1 : 1);
      const c = this.parseFloatToken(rational[4]);
      const d = this.parseFloatToken(rational[6]) * (rational[5] === '-' ? -1 : 1);
      if (d === 0 && c !== 0) return { factor: a / c, offset: b / c };
      return null;
    }

    const div = normalized.match(new RegExp(`^X\\s*/\\s*${numberPattern}$`, 'i'));
    if (div) return { factor: 1 / this.parseFloatToken(div[1]), offset: 0 };

    const mulOffset = normalized.match(new RegExp(`^X\\s*\\*\\s*${numberPattern}\\s*([+-])\\s*${numberPattern}$`, 'i'));
    if (mulOffset) {
      return {
        factor: this.parseFloatToken(mulOffset[1]),
        offset: this.parseFloatToken(mulOffset[3]) * (mulOffset[2] === '-' ? -1 : 1),
      };
    }

    const offsetMul = normalized.match(new RegExp(`^${numberPattern}\\s*\\*\\s*X\\s*([+-])\\s*${numberPattern}$`, 'i'));
    if (offsetMul) {
      return {
        factor: this.parseFloatToken(offsetMul[1]),
        offset: this.parseFloatToken(offsetMul[3]) * (offsetMul[2] === '-' ? -1 : 1),
      };
    }

    const mul = normalized.match(new RegExp(`^X\\s*\\*\\s*${numberPattern}$`, 'i'));
    if (mul) return { factor: this.parseFloatToken(mul[1]), offset: 0 };

    const reverseMul = normalized.match(new RegExp(`^${numberPattern}\\s*\\*\\s*X$`, 'i'));
    if (reverseMul) return { factor: this.parseFloatToken(reverseMul[1]), offset: 0 };

    const addSub = normalized.match(new RegExp(`^X\\s*([+-])\\s*${numberPattern}$`, 'i'));
    if (addSub) {
      return {
        factor: 1,
        offset: this.parseFloatToken(addSub[2]) * (addSub[1] === '-' ? -1 : 1),
      };
    }

    return null;
  }

  private parseFloatToken(value: string): number {
    const trimmed = value.trim();
    const firstDot = trimmed.indexOf('.');
    if (firstDot >= 0) {
      const secondDot = trimmed.indexOf('.', firstDot + 1);
      if (secondDot >= 0) {
        return parseFloat(trimmed.slice(0, secondDot));
      }
    }
    return parseFloat(trimmed);
  }

  private resolveCategory(element: Record<string, unknown>, categories: XdfCategory[]): string {
    const categoryMembers = this.ensureArray(element.CATEGORYMEM);
    const resolved = categoryMembers
      .map((categoryMember): { level: number; name: string } | null => {
        const obj = this.asObject(categoryMember);
        if (!obj) return null;

        const level = this.readNumber(obj, ['@_index', 'index'], 0);
        const categoryIndex = this.readOptionalNumber(obj, ['@_category', 'category']);
        if (categoryIndex === undefined) return null;

        const category = this.findCategory(categories, categoryIndex);
        if (!category || category.name.toLowerCase() === 'axis') return null;

        return { level, name: category.name };
      })
      .filter((entry): entry is { level: number; name: string } => Boolean(entry))
      .sort((a, b) => a.level - b.level)
      .map(entry => entry.name);

    if (resolved.length > 1 && resolved[resolved.length - 1].toLowerCase() === 'misc') {
      resolved.pop();
    }

    if (resolved.length > 0) {
      return resolved.join(' / ');
    }

    const categoryIndex = this.readNumber(element, ['@_categoryindex', 'categoryindex'], 0);
    return this.findCategory(categories, categoryIndex)?.name || 'Miscellaneous';
  }

  private findCategory(categories: XdfCategory[], index: number): XdfCategory | undefined {
    return (
      categories.find(category => category.index === index) ||
      categories.find(category => category.index === index - 1) ||
      categories[index] ||
      categories[index - 1]
    );
  }

  private readString(
    obj: Record<string, unknown>,
    keys: string[],
    fallback?: string
  ): string {
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      const value = this.stringifyValue(obj[key]);
      if (value !== undefined) return value;
    }
    return fallback ?? '';
  }

  private stringifyValue(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      return this.stringifyValue(obj['#text']);
    }
    return undefined;
  }

  private readNumber(obj: Record<string, unknown>, keys: string[], fallback: number): number {
    return this.readOptionalNumber(obj, keys) ?? fallback;
  }

  private readOptionalNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      const rawValue = obj[key];
      if (typeof rawValue === 'number' && !Number.isNaN(rawValue)) return rawValue;

      const value = this.stringifyValue(obj[key]);
      if (value === undefined || value.trim() === '') continue;

      const parsed = this.parseNumber(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return undefined;
  }

  private parseNumber(value: string): number {
    const trimmed = value.trim();
    if (trimmed.includes('.') || /e/i.test(trimmed)) {
      return parseFloat(trimmed);
    }
    return this.parseHexOrDecimal(trimmed);
  }

  private readBoolean(obj: Record<string, unknown>, keys: string[], fallback: boolean): boolean {
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      const value = obj[key];
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === '0' || normalized === 'false') return false;
        if (normalized === '1' || normalized === 'true') return true;
      }
    }
    return fallback;
  }

  private hasAnyKey(obj: Record<string, unknown>, keys: string[]): boolean {
    return keys.some(key => Object.prototype.hasOwnProperty.call(obj, key));
  }

  private asObject(value: unknown): Record<string, unknown> | undefined {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : undefined;
  }

  /**
   * Parse hex or decimal string
   */
  private parseHexOrDecimal(value: string): number {
    const trimmed = value.trim();
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      return parseInt(trimmed, 16);
    }
    if (/^[0-9A-Fa-f]+$/.test(trimmed) && trimmed.length > 4) {
      // Likely hex without prefix
      return parseInt(trimmed, 16);
    }
    return parseInt(trimmed, 10) || 0;
  }

  /**
   * Get DataType from size in bits and signed flag
   */
  private getDataType(sizeBits: number, signed: boolean, typeFlags = 0): DataType {
    if ((typeFlags & 0x10000) !== 0 && sizeBits === 32) {
      return DataType.FLOAT32;
    }

    switch (sizeBits) {
      case 8:
        return signed ? DataType.INT8 : DataType.UINT8;
      case 16:
        return signed ? DataType.INT16 : DataType.UINT16;
      case 32:
        return signed ? DataType.INT32 : DataType.UINT32;
      default:
        return DataType.UINT8;
    }
  }

  /**
   * Map string category name to MapCategory enum
   */
  private mapStringToCategory(name: string): MapCategory {
    const lower = name.toLowerCase();

    if (lower.includes('fuel') || lower.includes('inj')) return MapCategory.FUEL;
    if (lower.includes('ign') || lower.includes('spark') || lower.includes('timing')) return MapCategory.IGNITION;
    if (lower.includes('boost') || lower.includes('turbo') || lower.includes('wastegate')) return MapCategory.BOOST;
    if (lower.includes('idle')) return MapCategory.IDLE;
    if (lower.includes('limit') || lower.includes('rev') || lower.includes('speed')) return MapCategory.LIMITERS;
    if (lower.includes('sensor') || lower.includes('temp') || lower.includes('pressure')) return MapCategory.SENSORS;
    if (lower.includes('trans') || lower.includes('gear') || lower.includes('shift')) return MapCategory.TRANSMISSION;
    if (lower.includes('emis') || lower.includes('egr') || lower.includes('cat')) return MapCategory.EMISSIONS;

    return MapCategory.MISC;
  }
}
