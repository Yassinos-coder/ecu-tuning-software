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
});
