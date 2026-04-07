import { EcuFile } from '../domain/EcuFile';
import { CalibrationMap } from '../domain/CalibrationMap';
import { Axis } from '../domain/Axis';
import { Scalar } from '../domain/Scalar';
import { DataTypeSizes } from '../domain/types';
import { BinaryReader, BinaryWriter, calculate2DAddress } from '../utils/binary';
import type { XdfDefinition } from './XdfInterpreter';

/**
 * Maps XDF definitions to BIN file data
 */
export class BinMapper {
  /**
   * Load all maps from BIN file using XDF definition
   */
  loadMaps(ecuFile: EcuFile, xdfDefinition: XdfDefinition): CalibrationMap[] {
    const maps: CalibrationMap[] = [];

    for (const mapDef of xdfDefinition.maps) {
      try {
        const loadedMap = this.loadMap(ecuFile, mapDef);
        maps.push(loadedMap);
      } catch (error) {
        console.warn(`Failed to load map "${mapDef.title}":`, error);
      }
    }

    return maps;
  }

  /**
   * Load a single map from BIN file
   */
  loadMap(ecuFile: EcuFile, mapDef: CalibrationMap): CalibrationMap {
    const reader = new BinaryReader(ecuFile.data, mapDef.addressRef.byteOrder);

    // Load axis values if present
    let xAxis: Axis | undefined;
    let yAxis: Axis | undefined;

    if (mapDef.xAxis) {
      xAxis = this.loadAxis(ecuFile, mapDef.xAxis);
    }

    if (mapDef.yAxis) {
      yAxis = this.loadAxis(ecuFile, mapDef.yAxis);
    }

    // Load map data
    const rawValues: number[][] = [];
    const baseAddress = mapDef.addressRef.address;
    const dataType = mapDef.addressRef.dataType;

    reader.seek(baseAddress);

    for (let row = 0; row < mapDef.rows; row++) {
      const rowValues: number[] = [];
      for (let col = 0; col < mapDef.cols; col++) {
        rowValues.push(reader.read(dataType));
      }
      rawValues.push(rowValues);
    }

    // Create new map with loaded values
    const loadedMap = new CalibrationMap({
      id: mapDef.id,
      title: mapDef.title,
      description: mapDef.description,
      category: mapDef.category,
      addressRef: mapDef.addressRef,
      rows: mapDef.rows,
      cols: mapDef.cols,
      units: mapDef.units,
      decimalPlaces: mapDef.decimalPlaces,
      equation: mapDef.equation,
      min: mapDef.min,
      max: mapDef.max,
      xAxis,
      yAxis,
    });

    loadedMap.setRawValues(rawValues);

    return loadedMap;
  }

  /**
   * Load axis values from BIN file
   */
  loadAxis(ecuFile: EcuFile, axisDef: Axis): Axis {
    const reader = new BinaryReader(ecuFile.data, axisDef.addressRef.byteOrder);
    reader.seek(axisDef.addressRef.address);

    const rawValues = reader.readArray(axisDef.addressRef.dataType, axisDef.count);

    const loadedAxis = new Axis({
      id: axisDef.id,
      title: axisDef.title,
      units: axisDef.units,
      addressRef: axisDef.addressRef,
      count: axisDef.count,
      equation: axisDef.equation,
      min: axisDef.min,
      max: axisDef.max,
    });

    loadedAxis.setRawValues(rawValues);

    return loadedAxis;
  }

  /**
   * Load all scalars from BIN file
   */
  loadScalars(ecuFile: EcuFile, xdfDefinition: XdfDefinition): Scalar[] {
    const scalars: Scalar[] = [];

    for (const scalarDef of xdfDefinition.scalars) {
      try {
        const loadedScalar = this.loadScalar(ecuFile, scalarDef);
        scalars.push(loadedScalar);
      } catch (error) {
        console.warn(`Failed to load scalar "${scalarDef.title}":`, error);
      }
    }

    return scalars;
  }

  /**
   * Load a single scalar from BIN file
   */
  loadScalar(ecuFile: EcuFile, scalarDef: Scalar): Scalar {
    const reader = new BinaryReader(ecuFile.data, scalarDef.addressRef.byteOrder);
    const rawValue = reader.readAt(scalarDef.addressRef.address, scalarDef.addressRef.dataType);

    const loadedScalar = new Scalar({
      id: scalarDef.id,
      title: scalarDef.title,
      description: scalarDef.description,
      category: scalarDef.category,
      addressRef: scalarDef.addressRef,
      units: scalarDef.units,
      decimalPlaces: scalarDef.decimalPlaces,
      equation: scalarDef.equation,
      min: scalarDef.min,
      max: scalarDef.max,
    });

    loadedScalar.setRawValue(rawValue);

    return loadedScalar;
  }

  /**
   * Write map values back to ECU file
   */
  writeMap(ecuFile: EcuFile, map: CalibrationMap): void {
    const writer = new BinaryWriter(ecuFile.data, map.addressRef.byteOrder);
    const baseAddress = map.addressRef.address;
    const dataType = map.addressRef.dataType;

    writer.write2DArray(baseAddress, dataType, map.rawValues);
  }

  /**
   * Write scalar value back to ECU file
   */
  writeScalar(ecuFile: EcuFile, scalar: Scalar): void {
    const writer = new BinaryWriter(ecuFile.data, scalar.addressRef.byteOrder);
    writer.write(scalar.addressRef.address, scalar.addressRef.dataType, scalar.rawValue);
  }

  /**
   * Write a single cell value to ECU file
   */
  writeCell(
    ecuFile: EcuFile,
    map: CalibrationMap,
    row: number,
    col: number,
    rawValue: number
  ): void {
    const address = calculate2DAddress(
      map.addressRef.address,
      row,
      col,
      map.cols,
      map.addressRef.dataType
    );

    const writer = new BinaryWriter(ecuFile.data, map.addressRef.byteOrder);
    writer.write(address, map.addressRef.dataType, rawValue);
  }

  /**
   * Sync all map changes to ECU file
   */
  syncAllMaps(ecuFile: EcuFile, maps: CalibrationMap[]): void {
    for (const map of maps) {
      if (map.isModified) {
        this.writeMap(ecuFile, map);
      }
    }
  }

  /**
   * Sync all scalar changes to ECU file
   */
  syncAllScalars(ecuFile: EcuFile, scalars: Scalar[]): void {
    for (const scalar of scalars) {
      if (scalar.isModified) {
        this.writeScalar(ecuFile, scalar);
      }
    }
  }

  /**
   * Get raw hex view of a map's data region
   */
  getMapHexView(ecuFile: EcuFile, map: CalibrationMap): string {
    const elementSize = DataTypeSizes[map.addressRef.dataType];
    const length = map.rows * map.cols * elementSize;
    return ecuFile.getHexDump(map.addressRef.address, length);
  }

  /**
   * Find maps that use a specific address range
   */
  findMapsAtAddress(
    maps: CalibrationMap[],
    address: number
  ): CalibrationMap[] {
    return maps.filter(map => {
      const elementSize = DataTypeSizes[map.addressRef.dataType];
      const mapEnd = map.addressRef.address + (map.rows * map.cols * elementSize);
      return address >= map.addressRef.address && address < mapEnd;
    });
  }

  /**
   * Validate that a map's address range is within file bounds
   */
  validateMapBounds(ecuFile: EcuFile, map: CalibrationMap): boolean {
    const elementSize = DataTypeSizes[map.addressRef.dataType];
    const requiredLength = map.rows * map.cols * elementSize;
    const endAddress = map.addressRef.address + requiredLength;

    return map.addressRef.address >= 0 && endAddress <= ecuFile.size;
  }
}
