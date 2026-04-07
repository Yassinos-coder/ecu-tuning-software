import { v4 as uuid } from 'uuid';
import type { ConversionEquation, AddressRef, MapCategory } from './types';

/**
 * Represents a single scalar value in an ECU (e.g., rev limit, speed limit)
 */
export class Scalar {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: MapCategory;
  readonly addressRef: AddressRef;
  readonly units: string;
  readonly decimalPlaces: number;
  readonly equation?: ConversionEquation;
  readonly min?: number;
  readonly max?: number;

  private _value: number;
  private _rawValue: number;
  private _originalValue: number;

  constructor(params: {
    id?: string;
    title: string;
    description?: string;
    category: MapCategory;
    addressRef: AddressRef;
    units: string;
    decimalPlaces?: number;
    equation?: ConversionEquation;
    min?: number;
    max?: number;
    value?: number;
    rawValue?: number;
  }) {
    this.id = params.id || uuid();
    this.title = params.title;
    this.description = params.description || '';
    this.category = params.category;
    this.addressRef = params.addressRef;
    this.units = params.units;
    this.decimalPlaces = params.decimalPlaces ?? 2;
    this.equation = params.equation;
    this.min = params.min;
    this.max = params.max;

    this._value = params.value ?? 0;
    this._rawValue = params.rawValue ?? 0;
    this._originalValue = this._value;
  }

  /**
   * Get current display value
   */
  get value(): number {
    return this._value;
  }

  /**
   * Get raw value (before equation)
   */
  get rawValue(): number {
    return this._rawValue;
  }

  /**
   * Get original value
   */
  get originalValue(): number {
    return this._originalValue;
  }

  /**
   * Check if value has been modified
   */
  get isModified(): boolean {
    return this._value !== this._originalValue;
  }

  /**
   * Set value
   */
  setValue(value: number): { oldValue: number; newValue: number } {
    const oldValue = this._value;
    this._value = value;
    this._rawValue = this.applyInverseEquation(value);
    return { oldValue, newValue: value };
  }

  /**
   * Set from raw value
   */
  setRawValue(rawValue: number): void {
    this._rawValue = rawValue;
    this._value = this.applyEquation(rawValue);
    this._originalValue = this._value;
  }

  /**
   * Restore to original value
   */
  restore(): { oldValue: number; newValue: number } {
    const oldValue = this._value;
    this._value = this._originalValue;
    this._rawValue = this.applyInverseEquation(this._originalValue);
    return { oldValue, newValue: this._originalValue };
  }

  /**
   * Get formatted value string
   */
  getFormattedValue(): string {
    return `${this._value.toFixed(this.decimalPlaces)} ${this.units}`;
  }

  /**
   * Validate value against min/max
   */
  validateValue(value: number): { valid: boolean; message?: string } {
    if (this.min !== undefined && value < this.min) {
      return { valid: false, message: `Value ${value} is below minimum ${this.min}` };
    }
    if (this.max !== undefined && value > this.max) {
      return { valid: false, message: `Value ${value} is above maximum ${this.max}` };
    }
    return { valid: true };
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
}
