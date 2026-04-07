import { v4 as uuid } from 'uuid';
import { Axis } from './Axis';
import type { ConversionEquation, AddressRef, MapCategory, CellChange, CellRange } from './types';
import { RiskLevel, getAfrRiskLevel, getTimingRiskLevel, getBoostRiskLevel } from '../../shared/constants/safetyLimits';

/**
 * Represents a calibration map/table in an ECU
 */
export class CalibrationMap {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: MapCategory;
  readonly addressRef: AddressRef;
  readonly rows: number;
  readonly cols: number;
  readonly units: string;
  readonly decimalPlaces: number;
  readonly equation?: ConversionEquation;
  readonly min?: number;
  readonly max?: number;

  readonly xAxis?: Axis;
  readonly yAxis?: Axis;

  private _values: number[][];
  private _rawValues: number[][];
  private _originalValues: number[][];

  constructor(params: {
    id?: string;
    title: string;
    description?: string;
    category: MapCategory;
    addressRef: AddressRef;
    rows: number;
    cols: number;
    units: string;
    decimalPlaces?: number;
    equation?: ConversionEquation;
    min?: number;
    max?: number;
    xAxis?: Axis;
    yAxis?: Axis;
    values?: number[][];
    rawValues?: number[][];
  }) {
    this.id = params.id || uuid();
    this.title = params.title;
    this.description = params.description || '';
    this.category = params.category;
    this.addressRef = params.addressRef;
    this.rows = params.rows;
    this.cols = params.cols;
    this.units = params.units;
    this.decimalPlaces = params.decimalPlaces ?? 2;
    this.equation = params.equation;
    this.min = params.min;
    this.max = params.max;
    this.xAxis = params.xAxis;
    this.yAxis = params.yAxis;

    // Initialize values arrays
    this._values = params.values || this.createEmptyArray(this.rows, this.cols);
    this._rawValues = params.rawValues || this.createEmptyArray(this.rows, this.cols);
    this._originalValues = this.deepCopyArray(this._values);
  }

  /**
   * Get current display values
   */
  get values(): number[][] {
    return this._values.map(row => [...row]);
  }

  /**
   * Get raw values (before equation)
   */
  get rawValues(): number[][] {
    return this._rawValues.map(row => [...row]);
  }

  /**
   * Get original values (for comparison)
   */
  get originalValues(): number[][] {
    return this._originalValues.map(row => [...row]);
  }

  /**
   * Check if any values have been modified
   */
  get isModified(): boolean {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this._values[row][col] !== this._originalValues[row][col]) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get value at cell
   */
  getValue(row: number, col: number): number {
    this.validateCell(row, col);
    return this._values[row][col];
  }

  /**
   * Get raw value at cell
   */
  getRawValue(row: number, col: number): number {
    this.validateCell(row, col);
    return this._rawValues[row][col];
  }

  /**
   * Get original value at cell
   */
  getOriginalValue(row: number, col: number): number {
    this.validateCell(row, col);
    return this._originalValues[row][col];
  }

  /**
   * Set value at cell (returns the change for undo tracking)
   */
  setValue(row: number, col: number, value: number): CellChange {
    this.validateCell(row, col);

    const oldValue = this._values[row][col];
    this._values[row][col] = value;
    this._rawValues[row][col] = this.applyInverseEquation(value);

    return { row, col, oldValue, newValue: value };
  }

  /**
   * Set values from raw data
   */
  setRawValues(rawValues: number[][]): void {
    if (rawValues.length !== this.rows || rawValues[0]?.length !== this.cols) {
      throw new Error('Raw values dimensions do not match map dimensions');
    }

    this._rawValues = this.deepCopyArray(rawValues);
    this._values = rawValues.map(row =>
      row.map(v => this.applyEquation(v))
    );
    this._originalValues = this.deepCopyArray(this._values);
  }

  /**
   * Apply bulk percentage change to a range
   */
  applyPercentageChange(range: CellRange, percentage: number): CellChange[] {
    const changes: CellChange[] = [];
    const multiplier = 1 + (percentage / 100);

    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        const oldValue = this._values[row][col];
        const newValue = oldValue * multiplier;
        changes.push(this.setValue(row, col, newValue));
      }
    }

    return changes;
  }

  /**
   * Apply flat value change to a range
   */
  applyFlatChange(range: CellRange, delta: number): CellChange[] {
    const changes: CellChange[] = [];

    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        const oldValue = this._values[row][col];
        const newValue = oldValue + delta;
        changes.push(this.setValue(row, col, newValue));
      }
    }

    return changes;
  }

  /**
   * Fill range with a specific value
   */
  fillRange(range: CellRange, value: number): CellChange[] {
    const changes: CellChange[] = [];

    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        changes.push(this.setValue(row, col, value));
      }
    }

    return changes;
  }

  /**
   * Interpolate values across a range
   */
  interpolateRange(range: CellRange): CellChange[] {
    const changes: CellChange[] = [];
    const { startRow, startCol, endRow, endCol } = range;

    // Get corner values
    const topLeft = this._values[startRow][startCol];
    const topRight = this._values[startRow][endCol];
    const bottomLeft = this._values[endRow][startCol];
    const bottomRight = this._values[endRow][endCol];

    const rowSpan = endRow - startRow;
    const colSpan = endCol - startCol;

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        // Skip corners
        if ((row === startRow || row === endRow) && (col === startCol || col === endCol)) {
          continue;
        }

        const rowWeight = rowSpan > 0 ? (row - startRow) / rowSpan : 0;
        const colWeight = colSpan > 0 ? (col - startCol) / colSpan : 0;

        // Bilinear interpolation
        const top = topLeft + (topRight - topLeft) * colWeight;
        const bottom = bottomLeft + (bottomRight - bottomLeft) * colWeight;
        const newValue = top + (bottom - top) * rowWeight;

        changes.push(this.setValue(row, col, newValue));
      }
    }

    return changes;
  }

  /**
   * Smooth values in a range (average with neighbors)
   */
  smoothRange(range: CellRange, strength: number = 0.5): CellChange[] {
    const changes: CellChange[] = [];
    const { startRow, startCol, endRow, endCol } = range;

    // Create a copy to work with
    const smoothed = this.deepCopyArray(this._values);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const neighbors: number[] = [];

        // Collect neighbor values
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
              neighbors.push(this._values[nr][nc]);
            }
          }
        }

        const avg = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
        smoothed[row][col] = this._values[row][col] * (1 - strength) + avg * strength;
      }
    }

    // Apply changes
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (smoothed[row][col] !== this._values[row][col]) {
          changes.push(this.setValue(row, col, smoothed[row][col]));
        }
      }
    }

    return changes;
  }

  /**
   * Check if a cell has been modified from original
   */
  isCellModified(row: number, col: number): boolean {
    this.validateCell(row, col);
    return this._values[row][col] !== this._originalValues[row][col];
  }

  /**
   * Get list of all modified cells
   */
  getModifiedCells(): Array<{ row: number; col: number; original: number; current: number }> {
    const modified: Array<{ row: number; col: number; original: number; current: number }> = [];

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this._values[row][col] !== this._originalValues[row][col]) {
          modified.push({
            row,
            col,
            original: this._originalValues[row][col],
            current: this._values[row][col],
          });
        }
      }
    }

    return modified;
  }

  /**
   * Restore cell to original value
   */
  restoreCell(row: number, col: number): CellChange {
    this.validateCell(row, col);
    const oldValue = this._values[row][col];
    const newValue = this._originalValues[row][col];
    this._values[row][col] = newValue;
    this._rawValues[row][col] = this.applyInverseEquation(newValue);
    return { row, col, oldValue, newValue };
  }

  /**
   * Restore all cells to original values
   */
  restoreAll(): CellChange[] {
    const changes: CellChange[] = [];

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this._values[row][col] !== this._originalValues[row][col]) {
          changes.push(this.restoreCell(row, col));
        }
      }
    }

    return changes;
  }

  /**
   * Get risk level for a cell value based on map category
   */
  getCellRiskLevel(row: number, col: number): RiskLevel {
    this.validateCell(row, col);
    const value = this._values[row][col];

    // Determine risk based on map category
    const titleLower = this.title.toLowerCase();
    const categoryLower = this.category.toLowerCase();

    if (titleLower.includes('afr') || titleLower.includes('lambda') || categoryLower === 'fuel') {
      // Check for load condition (rough heuristic based on row position)
      const isUnderLoad = row > this.rows / 2;
      return getAfrRiskLevel(value, isUnderLoad);
    }

    if (titleLower.includes('timing') || titleLower.includes('ignition') || categoryLower === 'ignition') {
      // Check for boost (rough heuristic)
      const estimatedBoost = row > this.rows * 0.7 ? 10 : 0;
      return getTimingRiskLevel(value, estimatedBoost);
    }

    if (titleLower.includes('boost') || categoryLower === 'boost') {
      return getBoostRiskLevel(value);
    }

    return RiskLevel.SAFE;
  }

  /**
   * Get statistics for the map
   */
  getStatistics(): {
    min: number;
    max: number;
    avg: number;
    stdDev: number;
  } {
    const flat = this._values.flat();
    const min = Math.min(...flat);
    const max = Math.max(...flat);
    const avg = flat.reduce((a, b) => a + b, 0) / flat.length;
    const variance = flat.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / flat.length;
    const stdDev = Math.sqrt(variance);

    return { min, max, avg, stdDev };
  }

  /**
   * Apply conversion equation to raw value
   */
  private applyEquation(rawValue: number): number {
    if (!this.equation?.expression) {
      return rawValue;
    }

    try {
      const expr = this.equation.expression;
      if (expr.includes('X')) {
        const evalExpr = expr.replace(/X/g, rawValue.toString());
        const result = new Function(`return ${evalExpr}`)();
        return typeof result === 'number' ? result : rawValue;
      }
      return rawValue;
    } catch {
      return rawValue;
    }
  }

  /**
   * Apply inverse equation to get raw value
   */
  private applyInverseEquation(displayValue: number): number {
    if (!this.equation?.inverseExpression) {
      if (this.equation?.expression) {
        const match = this.equation.expression.match(/X\s*\*\s*([\d.]+)\s*\+\s*([\d.-]+)/);
        if (match) {
          const a = parseFloat(match[1]);
          const b = parseFloat(match[2]);
          return (displayValue - b) / a;
        }
      }
      return displayValue;
    }

    try {
      const expr = this.equation.inverseExpression;
      const evalExpr = expr.replace(/X/g, displayValue.toString());
      const result = new Function(`return ${evalExpr}`)();
      return typeof result === 'number' ? result : displayValue;
    } catch {
      return displayValue;
    }
  }

  /**
   * Validate cell coordinates
   */
  private validateCell(row: number, col: number): void {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      throw new Error(`Cell (${row}, ${col}) out of bounds (${this.rows}x${this.cols})`);
    }
  }

  /**
   * Create empty 2D array
   */
  private createEmptyArray(rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
  }

  /**
   * Deep copy 2D array
   */
  private deepCopyArray(arr: number[][]): number[][] {
    return arr.map(row => [...row]);
  }
}
