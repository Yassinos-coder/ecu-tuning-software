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
    const parsed = this.parser.parse(xdfContent);
    const xdf = parsed.XDFFORMAT;

    if (!xdf) {
      throw new Error('Invalid XDF format: missing XDFFORMAT root element');
    }

    const header = xdf.XDFHEADER || {};
    const categories = this.parseCategories(header.CATEGORY);
    const baseOffset = this.parseBaseOffset(header.BASEOFFSET);
    const defaults = this.parseDefaults(header.DEFAULTS);

    // Parse tables (maps)
    const tables = this.ensureArray(xdf.XDFTABLE);
    const maps = tables.map(t => this.parseTable(t, categories, baseOffset, defaults));

    // Parse constants (scalars)
    const constants = this.ensureArray(xdf.XDFCONSTANT);
    const scalars = constants.map(c => this.parseConstant(c, categories, baseOffset, defaults));

    return {
      title: header['@_title'] || header.title || 'Unknown',
      description: header['@_description'] || header.description || '',
      author: header['@_author'] || header.author,
      baseOffset,
      defaults,
      categories,
      maps: maps.filter(Boolean) as CalibrationMap[],
      scalars: scalars.filter(Boolean) as Scalar[],
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
          name: String(obj['#text'] || obj['@_name'] || 'Unknown'),
          index: Number(obj['@_index'] || categories.length),
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
  private parseDefaults(defaultsData: unknown): { dataType: DataType; byteOrder: ByteOrder } {
    const defaults = {
      dataType: DataType.UINT8,
      byteOrder: ByteOrder.LITTLE_ENDIAN,
    };

    if (!defaultsData || typeof defaultsData !== 'object') {
      return defaults;
    }

    const obj = defaultsData as Record<string, unknown>;

    // Parse data size
    const dataSize = Number(obj['@_datasizeinbits'] || 8);
    const signed = obj['@_signed'] === '1' || obj['@_signed'] === true;

    switch (dataSize) {
      case 8:
        defaults.dataType = signed ? DataType.INT8 : DataType.UINT8;
        break;
      case 16:
        defaults.dataType = signed ? DataType.INT16 : DataType.UINT16;
        break;
      case 32:
        defaults.dataType = signed ? DataType.INT32 : DataType.UINT32;
        break;
    }

    // Parse byte order
    const lsbfirst = obj['@_lsbfirst'];
    if (lsbfirst === '0' || lsbfirst === false) {
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
    defaults: { dataType: DataType; byteOrder: ByteOrder }
  ): CalibrationMap | null {
    if (!tableData || typeof tableData !== 'object') {
      return null;
    }

    const table = tableData as Record<string, unknown>;
    const title = String(table['@_title'] || table.title || 'Unknown Map');

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
    let dataType = defaults.dataType;
    let byteOrder = defaults.byteOrder;

    if (zAxisData && typeof zAxisData === 'object') {
      const zAxis = zAxisData as Record<string, unknown>;
      const embeddedData = zAxis.EMBEDDEDDATA as Record<string, unknown> | undefined;

      if (embeddedData) {
        const address = this.parseHexOrDecimal(String(embeddedData['@_mmedaddress'] || '0'));
        const sizeBits = Number(embeddedData['@_mmedelementsizebits'] || 8);
        const signed = embeddedData['@_mmedsigned'] === '1';
        const lsbFirst = embeddedData['@_mmedlsbfirst'] !== '0';

        dataType = this.getDataType(sizeBits, signed);
        byteOrder = lsbFirst ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN;

        addressRef = {
          address: address + baseOffset,
          dataType,
          byteOrder,
        };
      } else {
        addressRef = {
          address: baseOffset,
          dataType,
          byteOrder,
        };
      }

      // Parse equation
      const mathData = zAxis.MATH as Record<string, unknown> | undefined;
      if (mathData) {
        equation = {
          expression: String(mathData['@_equation'] || 'X'),
        };
      }
    } else {
      addressRef = {
        address: baseOffset,
        dataType,
        byteOrder,
      };
    }

    // Determine category
    const categoryIndex = Number(table['@_categoryindex'] || 0);
    const category = categories[categoryIndex]?.name || 'Miscellaneous';
    const mapCategory = this.mapStringToCategory(category);

    // Parse units and decimal places
    const units = String(table['@_units'] || table.UNITS || '');
    const decimalPlaces = Number(table['@_decimalplaces'] || 2);

    return new CalibrationMap({
      title,
      description: String(table['@_description'] || ''),
      category: mapCategory,
      addressRef,
      rows,
      cols,
      units,
      decimalPlaces,
      equation,
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
    defaults: { dataType: DataType; byteOrder: ByteOrder }
  ): Axis | null {
    const embeddedData = axisData.EMBEDDEDDATA as Record<string, unknown> | undefined;
    const indexCount = Number(axisData['@_indexcount'] || 1);

    if (indexCount <= 0) return null;

    let address = 0;
    let dataType = defaults.dataType;
    let byteOrder = defaults.byteOrder;

    if (embeddedData) {
      address = this.parseHexOrDecimal(String(embeddedData['@_mmedaddress'] || '0'));
      const sizeBits = Number(embeddedData['@_mmedelementsizebits'] || 8);
      const signed = embeddedData['@_mmedsigned'] === '1';
      const lsbFirst = embeddedData['@_mmedlsbfirst'] !== '0';

      dataType = this.getDataType(sizeBits, signed);
      byteOrder = lsbFirst ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN;
    }

    // Parse equation
    let equation: ConversionEquation | undefined;
    const mathData = axisData.MATH as Record<string, unknown> | undefined;
    if (mathData) {
      equation = {
        expression: String(mathData['@_equation'] || 'X'),
      };
    }

    return new Axis({
      title: String(axisData['@_title'] || axisData.title || 'Axis'),
      units: String(axisData['@_units'] || ''),
      addressRef: {
        address: address + baseOffset,
        dataType,
        byteOrder,
      },
      count: indexCount,
      equation,
    });
  }

  /**
   * Parse a constant element into a Scalar
   */
  private parseConstant(
    constantData: unknown,
    categories: XdfCategory[],
    baseOffset: number,
    defaults: { dataType: DataType; byteOrder: ByteOrder }
  ): Scalar | null {
    if (!constantData || typeof constantData !== 'object') {
      return null;
    }

    const constant = constantData as Record<string, unknown>;
    const title = String(constant['@_title'] || constant.title || 'Unknown');

    const embeddedData = constant.EMBEDDEDDATA as Record<string, unknown> | undefined;

    let address = 0;
    let dataType = defaults.dataType;
    let byteOrder = defaults.byteOrder;

    if (embeddedData) {
      address = this.parseHexOrDecimal(String(embeddedData['@_mmedaddress'] || '0'));
      const sizeBits = Number(embeddedData['@_mmedelementsizebits'] || 8);
      const signed = embeddedData['@_mmedsigned'] === '1';
      const lsbFirst = embeddedData['@_mmedlsbfirst'] !== '0';

      dataType = this.getDataType(sizeBits, signed);
      byteOrder = lsbFirst ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN;
    }

    // Parse equation
    let equation: ConversionEquation | undefined;
    const mathData = constant.MATH as Record<string, unknown> | undefined;
    if (mathData) {
      equation = {
        expression: String(mathData['@_equation'] || 'X'),
      };
    }

    // Determine category
    const categoryIndex = Number(constant['@_categoryindex'] || 0);
    const category = categories[categoryIndex]?.name || 'Miscellaneous';
    const mapCategory = this.mapStringToCategory(category);

    return new Scalar({
      title,
      description: String(constant['@_description'] || ''),
      category: mapCategory,
      addressRef: {
        address: address + baseOffset,
        dataType,
        byteOrder,
      },
      units: String(constant['@_units'] || ''),
      decimalPlaces: Number(constant['@_decimalplaces'] || 2),
      equation,
    });
  }

  /**
   * Ensure value is an array
   */
  private ensureArray<T>(value: T | T[] | undefined | null): T[] {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
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
  private getDataType(sizeBits: number, signed: boolean): DataType {
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
