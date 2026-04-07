import { describe, expect, it } from 'vitest';
import { CalibrationMap } from '@core/domain/CalibrationMap';
import { ByteOrder, DataType, MapCategory } from '@core/domain/types';

describe('CalibrationMap', () => {
  it('applies conversion equations and restores edited cells', () => {
    const map = new CalibrationMap({
      title: 'Fuel Base Map',
      category: MapCategory.FUEL,
      addressRef: {
        address: 0x1000,
        dataType: DataType.UINT8,
        byteOrder: ByteOrder.LITTLE_ENDIAN,
      },
      rows: 2,
      cols: 2,
      units: 'ms',
      equation: {
        expression: 'X*0.5+1',
        inverseExpression: '(X-1)/0.5',
      },
    });

    map.setRawValues([
      [10, 12],
      [14, 16],
    ]);

    expect(map.getValue(0, 0)).toBe(6);
    expect(map.getValue(1, 1)).toBe(9);

    map.setValue(1, 1, 11);

    expect(map.getRawValue(1, 1)).toBe(20);
    expect(map.isModified).toBe(true);

    map.restoreCell(1, 1);

    expect(map.getValue(1, 1)).toBe(9);
    expect(map.isModified).toBe(false);
  });
});
