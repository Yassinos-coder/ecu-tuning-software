import { afterEach, describe, expect, it } from 'vitest';
import { useEcuStore } from '@renderer/store/ecuStore';

describe('ecuStore checksum status', () => {
  afterEach(() => {
    useEcuStore.getState().closeBinFile();
  });

  it('keeps unsupported checksum files unknown instead of invalid', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

    useEcuStore.getState().loadBinFile('unsupported.bin', 'unsupported.bin', data);

    expect(useEcuStore.getState().checksumStatus).toBe('unknown');

    useEcuStore.getState().saveBinFile();

    expect(useEcuStore.getState().checksumStatus).toBe('unknown');
  });
});
