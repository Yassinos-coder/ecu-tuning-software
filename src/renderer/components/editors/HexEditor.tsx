import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useEcuStore } from '../../store/ecuStore';

const BYTES_PER_ROW = 16;
const ROWS_PER_PAGE = 100;

export function HexEditor() {
  const { ecuFile, getSelectedMap } = useEcuStore();
  const [offset, setOffset] = useState(0);
  const [gotoAddress, setGotoAddress] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedMap = getSelectedMap();

  // Jump to selected map's address
  useEffect(() => {
    if (selectedMap && ecuFile) {
      const mapOffset = Math.floor(selectedMap.addressRef.address / BYTES_PER_ROW) * BYTES_PER_ROW;
      setOffset(Math.max(0, mapOffset - BYTES_PER_ROW * 5)); // Show a few rows before
    }
  }, [selectedMap?.id]);

  const hexData = useMemo(() => {
    if (!ecuFile) return [];

    const rows: Array<{
      address: number;
      bytes: Array<{ value: number; modified: boolean }>;
      ascii: string;
    }> = [];

    const startAddr = offset;
    const endAddr = Math.min(offset + ROWS_PER_PAGE * BYTES_PER_ROW, ecuFile.size);

    for (let addr = startAddr; addr < endAddr; addr += BYTES_PER_ROW) {
      const bytes: Array<{ value: number; modified: boolean }> = [];
      let ascii = '';

      for (let i = 0; i < BYTES_PER_ROW && addr + i < ecuFile.size; i++) {
        const byteAddr = addr + i;
        const value = ecuFile.readByte(byteAddr);
        const modified = ecuFile.isAddressModified(byteAddr);

        bytes.push({ value, modified });

        // ASCII representation
        if (value >= 32 && value <= 126) {
          ascii += String.fromCharCode(value);
        } else {
          ascii += '.';
        }
      }

      rows.push({ address: addr, bytes, ascii });
    }

    return rows;
  }, [ecuFile, offset]);

  const formatAddress = (addr: number): string => {
    return addr.toString(16).padStart(8, '0').toUpperCase();
  };

  const formatByte = (value: number): string => {
    return value.toString(16).padStart(2, '0').toUpperCase();
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrollRatio = target.scrollTop / (target.scrollHeight - target.clientHeight);

    if (ecuFile) {
      const maxOffset = Math.max(0, ecuFile.size - ROWS_PER_PAGE * BYTES_PER_ROW);
      const newOffset = Math.floor(scrollRatio * maxOffset / BYTES_PER_ROW) * BYTES_PER_ROW;
      setOffset(newOffset);
    }
  };

  const handleGoto = () => {
    const address = parseInt(gotoAddress, 16);
    if (!isNaN(address) && ecuFile && address >= 0 && address < ecuFile.size) {
      const newOffset = Math.floor(address / BYTES_PER_ROW) * BYTES_PER_ROW;
      setOffset(Math.max(0, newOffset - BYTES_PER_ROW * 5));
    }
    setGotoAddress('');
  };

  // Check if address is within selected map's range
  const isInSelectedMap = (addr: number): boolean => {
    if (!selectedMap) return false;
    const mapStart = selectedMap.addressRef.address;
    const elementSize = selectedMap.addressRef.dataType === 'uint16' || selectedMap.addressRef.dataType === 'int16' ? 2 : 1;
    const mapEnd = mapStart + selectedMap.rows * selectedMap.cols * elementSize;
    return addr >= mapStart && addr < mapEnd;
  };

  if (!ecuFile) {
    return (
      <div className="hex-editor-empty">
        <p>Load a BIN file to view hex data</p>
      </div>
    );
  }

  return (
    <div className="hex-editor">
      <div className="hex-toolbar">
        <div className="hex-info">
          <span>Size: {ecuFile.size.toLocaleString()} bytes</span>
          <span>Offset: 0x{formatAddress(offset)}</span>
        </div>

        <div className="goto-section">
          <input
            type="text"
            placeholder="Go to address (hex)..."
            value={gotoAddress}
            onChange={(e) => setGotoAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGoto()}
            className="goto-input"
          />
          <button onClick={handleGoto} className="goto-btn">
            Go
          </button>
        </div>

        {selectedMap && (
          <div className="map-highlight-info">
            Highlighting: {selectedMap.title} (0x{formatAddress(selectedMap.addressRef.address)})
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className="hex-content"
        onScroll={handleScroll}
      >
        <div className="hex-header">
          <span className="address-col">Address</span>
          <span className="bytes-col">
            {Array.from({ length: BYTES_PER_ROW }, (_, i) =>
              i.toString(16).toUpperCase().padStart(2, '0')
            ).join(' ')}
          </span>
          <span className="ascii-col">ASCII</span>
        </div>

        {hexData.map((row) => (
          <div key={row.address} className="hex-row">
            <span className="address-col">{formatAddress(row.address)}</span>
            <span className="bytes-col">
              {row.bytes.map((byte, i) => (
                <span
                  key={i}
                  className={`hex-byte ${byte.modified ? 'modified' : ''} ${isInSelectedMap(row.address + i) ? 'highlighted' : ''}`}
                >
                  {formatByte(byte.value)}
                </span>
              ))}
            </span>
            <span className="ascii-col">{row.ascii}</span>
          </div>
        ))}
      </div>

      <style>{`
        .hex-editor {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--bg-secondary);
        }

        .hex-editor-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
        }

        .hex-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background-color: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
          gap: 16px;
        }

        .hex-info {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .goto-section {
          display: flex;
          gap: 4px;
        }

        .goto-input {
          width: 140px;
          padding: 4px 8px;
          font-size: 12px;
          font-family: var(--font-mono);
        }

        .goto-btn {
          padding: 4px 12px;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          font-size: 12px;
        }

        .goto-btn:hover {
          background-color: var(--bg-hover);
        }

        .map-highlight-info {
          font-size: 11px;
          color: var(--accent-primary);
        }

        .hex-content {
          flex: 1;
          overflow-y: auto;
          font-family: var(--font-mono);
          font-size: 12px;
          line-height: 1.6;
          padding: 4px 0;
        }

        .hex-header {
          display: flex;
          padding: 4px 12px;
          background-color: var(--bg-tertiary);
          color: var(--text-muted);
          font-weight: 500;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .hex-row {
          display: flex;
          padding: 2px 12px;
        }

        .hex-row:hover {
          background-color: var(--bg-hover);
        }

        .address-col {
          width: 80px;
          color: var(--text-muted);
        }

        .bytes-col {
          flex: 1;
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .ascii-col {
          width: 140px;
          color: var(--text-secondary);
          margin-left: 16px;
          word-break: break-all;
        }

        .hex-byte {
          width: 20px;
          text-align: center;
        }

        .hex-byte.modified {
          color: var(--accent-warning);
          font-weight: 600;
        }

        .hex-byte.highlighted {
          background-color: rgba(74, 144, 217, 0.2);
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
