import { v4 as uuid } from 'uuid';
import type { ConversionEquation, AddressRef } from './types';

/**
 * Represents an axis for a calibration map (X or Y axis)
 */
export class Axis {
  readonly id: string;
  readonly title: string;
  readonly units: string;
  readonly addressRef: AddressRef;
  readonly count: number;
  readonly equation?: ConversionEquation;
  readonly min?: number;
  readonly max?: number;

  private _values: number[];
  private _rawValues: number[];

  constructor(params: {
    id?: string;
    title: string;
    units: string;
    addressRef: AddressRef;
    count: number;
    equation?: ConversionEquation;
    min?: number;
    max?: number;
    values?: number[];
    rawValues?: number[];
  }) {
    this.id = params.id || uuid();
    this.title = params.title;
    this.units = params.units;
    this.addressRef = params.addressRef;
    this.count = params.count;
    this.equation = params.equation;
    this.min = params.min;
    this.max = params.max;
    this._values = params.values || [];
    this._rawValues = params.rawValues || [];
  }

  /**
   * Get display values (after equation applied)
   */
  get values(): number[] {
    return [...this._values];
  }

  /**
   * Get raw values (before equation)
   */
  get rawValues(): number[] {
    return [...this._rawValues];
  }

  /**
   * Set values from raw data
   */
  setRawValues(rawValues: number[]): void {
    this._rawValues = rawValues;
    this._values = rawValues.map((v) => this.applyEquation(v));
  }

  /**
   * Set display values (will calculate raw values)
   */
  setValues(values: number[]): void {
    this._values = values;
    this._rawValues = values.map((v) => this.applyInverseEquation(v));
  }

  /**
   * Apply conversion equation to raw value
   */
  applyEquation(rawValue: number): number {
    if (!this.equation?.expression) {
      return rawValue;
    }

    try {
      // Simple equation parser for common formats: X*A+B
      const expr = this.equation.expression;
      const x = rawValue;

      // Handle common patterns
      if (expr.includes('X')) {
        // Replace X with the value and evaluate
        const evalExpr = expr.replace(/X/g, x.toString());
        // Safe evaluation using Function (limited to math operations)
        const result = new Function(`return ${evalExpr}`)();
        return typeof result === 'number' ? result : rawValue;
      }

      return rawValue;
    } catch {
      return rawValue;
    }
  }

  /**
   * Apply inverse equation to get raw value from display value
   */
  applyInverseEquation(displayValue: number): number {
    if (!this.equation?.inverseExpression) {
      // Try to auto-invert simple linear equations: X*A+B -> (X-B)/A
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
      const x = displayValue;
      const evalExpr = expr.replace(/X/g, x.toString());
      const result = new Function(`return ${evalExpr}`)();
      return typeof result === 'number' ? result : displayValue;
    } catch {
      return displayValue;
    }
  }

  /**
   * Get value at index
   */
  getValueAt(index: number): number {
    if (index < 0 || index >= this._values.length) {
      throw new Error(`Axis index ${index} out of bounds (0-${this._values.length - 1})`);
    }
    return this._values[index];
  }

  /**
   * Find the closest axis index for a given value
   */
  findClosestIndex(value: number): number {
    let closestIndex = 0;
    let closestDiff = Math.abs(this._values[0] - value);

    for (let i = 1; i < this._values.length; i++) {
      const diff = Math.abs(this._values[i] - value);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  /**
   * Get interpolation indices and weights for a value
   */
  getInterpolationParams(value: number): { lowIndex: number; highIndex: number; weight: number } {
    // Find the two axis values that bracket the input value
    for (let i = 0; i < this._values.length - 1; i++) {
      const low = this._values[i];
      const high = this._values[i + 1];

      if (value >= low && value <= high) {
        const weight = high !== low ? (value - low) / (high - low) : 0;
        return { lowIndex: i, highIndex: i + 1, weight };
      }
    }

    // Value is outside axis range
    if (value < this._values[0]) {
      return { lowIndex: 0, highIndex: 0, weight: 0 };
    }
    const lastIndex = this._values.length - 1;
    return { lowIndex: lastIndex, highIndex: lastIndex, weight: 0 };
  }

  /**
   * Clone the axis
   */
  clone(): Axis {
    return new Axis({
      id: this.id,
      title: this.title,
      units: this.units,
      addressRef: { ...this.addressRef },
      count: this.count,
      equation: this.equation ? { ...this.equation } : undefined,
      min: this.min,
      max: this.max,
      values: [...this._values],
      rawValues: [...this._rawValues],
    });
  }
}
