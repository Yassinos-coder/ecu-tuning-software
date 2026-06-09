import { describe, expect, it } from 'vitest';
import { XdfInterpreter } from '@core/services/XdfInterpreter';
import { DataType, MapCategory } from '@core/domain/types';

describe('XdfInterpreter', () => {
  it('parses categories, tables, constants, and base offsets', () => {
    const xdf = `
      <XDFFORMAT>
        <XDFHEADER title="Demo XDF" description="Smoke test">
          <CATEGORY index="0">Fuel</CATEGORY>
          <BASEOFFSET offset="0x1000" />
          <DEFAULTS datasizeinbits="16" signed="0" lsbfirst="1" />
        </XDFHEADER>
        <XDFTABLE title="Fuel Main" categoryindex="0" units="ms" decimalplaces="1">
          <XDFAXIS id="x" title="RPM" indexcount="2">
            <EMBEDDEDDATA mmedaddress="0x20" mmedelementsizebits="16" mmedsigned="0" mmedlsbfirst="1" />
          </XDFAXIS>
          <XDFAXIS id="y" title="Load" indexcount="3">
            <EMBEDDEDDATA mmedaddress="0x30" mmedelementsizebits="16" mmedsigned="0" mmedlsbfirst="1" />
          </XDFAXIS>
          <XDFAXIS id="z">
            <EMBEDDEDDATA mmedaddress="0x40" mmedelementsizebits="16" mmedsigned="0" mmedlsbfirst="1" />
            <MATH equation="X*0.5+1" />
          </XDFAXIS>
        </XDFTABLE>
        <XDFCONSTANT title="Rev Limiter" categoryindex="0" units="rpm" decimalplaces="0">
          <EMBEDDEDDATA mmedaddress="0x50" mmedelementsizebits="16" mmedsigned="0" mmedlsbfirst="1" />
          <MATH equation="X" />
        </XDFCONSTANT>
      </XDFFORMAT>
    `;

    const interpreter = new XdfInterpreter();
    const parsed = interpreter.parse(xdf);

    expect(parsed.title).toBe('Demo XDF');
    expect(parsed.baseOffset).toBe(0x1000);
    expect(parsed.maps).toHaveLength(1);
    expect(parsed.scalars).toHaveLength(1);

    const map = parsed.maps[0];
    expect(map.title).toBe('Fuel Main');
    expect(map.category).toBe(MapCategory.FUEL);
    expect(map.addressRef.address).toBe(0x1040);
    expect(map.addressRef.dataType).toBe(DataType.UINT16);
    expect(map.rows).toBe(3);
    expect(map.cols).toBe(2);

    const scalar = parsed.scalars[0];
    expect(scalar.title).toBe('Rev Limiter');
    expect(scalar.addressRef.address).toBe(0x1050);
  });

  it('reports binary XDF files as unsupported instead of parsing corrupt text', () => {
    const interpreter = new XdfInterpreter();
    const binaryContent = String.fromCharCode(0x05, 0x22, 0x97, 0x00);

    expect(() => interpreter.parse(binaryContent)).toThrow(/Unsupported binary XDF format/);
  });

  it('treats single-cell XDFTABLE definitions as scalar parameters', () => {
    const xdf = `
      <XDFFORMAT>
        <XDFHEADER title="Table Scalar XDF">
          <CATEGORY index="0">Limiters</CATEGORY>
          <DEFAULTS datasizeinbits="16" signed="0" lsbfirst="0" />
        </XDFHEADER>
        <XDFTABLE title="Rev Limiter" categoryindex="0" units="rpm" decimalplaces="0">
          <XDFAXIS id="z">
            <EMBEDDEDDATA mmedaddress="0x200" mmedelementsizebits="16" mmedsigned="0" mmedlsbfirst="0" />
            <MATH equation="X" />
          </XDFAXIS>
        </XDFTABLE>
      </XDFFORMAT>
    `;

    const interpreter = new XdfInterpreter();
    const parsed = interpreter.parse(xdf);

    expect(parsed.maps).toHaveLength(1);
    expect(parsed.scalars).toHaveLength(1);
    expect(parsed.scalars[0].title).toBe('Rev Limiter');
    expect(parsed.scalars[0].addressRef.address).toBe(0x200);
  });

  it('parses child-node XML XDF metadata, category members, type flags, and dimensions', () => {
    const xdf = `
      <XDFFORMAT>
        <XDFHEADER>
          <deftitle>Child Node XDF</deftitle>
          <CATEGORY index="0" name="Axis" />
          <CATEGORY index="1" name="Fuel" />
          <DEFAULTS datasizeinbits="16" signed="0" lsbfirst="0" />
        </XDFHEADER>
        <XDFTABLE flags="0x20">
          <title>Fuel Table</title>
          <description>Main fuel table</description>
          <CATEGORYMEM index="0" category="2" />
          <XDFAXIS id="z">
            <EMBEDDEDDATA
              mmedaddress="0x120"
              mmedelementsizebits="16"
              mmedtypeflags="0x01"
              mmedrowcount="3"
              mmedcolcount="2"
            />
            <decimalpl>1</decimalpl>
            <min>0</min>
            <max>255</max>
            <units>ms</units>
            <MATH equation="X / 10" />
          </XDFAXIS>
        </XDFTABLE>
        <XDFCONSTANT>
          <title>Float Constant</title>
          <CATEGORYMEM index="0" category="2" />
          <EMBEDDEDDATA mmedaddress="0x140" mmedelementsizebits="32" mmedtypeflags="0x10000" />
          <units>ratio</units>
          <MATH equation="X" />
        </XDFCONSTANT>
      </XDFFORMAT>
    `;

    const interpreter = new XdfInterpreter();
    const parsed = interpreter.parse(xdf);

    expect(parsed.title).toBe('Child Node XDF');
    expect(parsed.maps).toHaveLength(1);
    expect(parsed.scalars).toHaveLength(1);

    const map = parsed.maps[0];
    expect(map.title).toBe('Fuel Table');
    expect(map.description).toBe('Main fuel table');
    expect(map.category).toBe(MapCategory.FUEL);
    expect(map.rows).toBe(3);
    expect(map.cols).toBe(2);
    expect(map.units).toBe('ms');
    expect(map.decimalPlaces).toBe(1);
    expect(map.min).toBe(0);
    expect(map.max).toBe(255);
    expect(map.addressRef.address).toBe(0x120);
    expect(map.addressRef.dataType).toBe(DataType.INT16);
    expect(map.equation?.inverseExpression).toBe('(X - (0)) / (0.1)');

    const scalar = parsed.scalars[0];
    expect(scalar.title).toBe('Float Constant');
    expect(scalar.category).toBe(MapCategory.FUEL);
    expect(scalar.addressRef.dataType).toBe(DataType.FLOAT32);
  });
});
