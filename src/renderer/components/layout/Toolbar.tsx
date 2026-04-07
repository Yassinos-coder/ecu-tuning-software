import React from 'react';
import { useEcuStore } from '../../store/ecuStore';
import { useUiStore } from '../../store/uiStore';
import { openBinFileFromDialog, openXdfFileFromDialog, saveBinFileFromDialog } from '../../lib/appCommands';
import { BrandMark } from './BrandMark';

export function Toolbar() {
  const {
    ecuFile,
    closeBinFile,
    undo,
    redo,
    canUndo,
    canRedo,
    correctChecksum,
    checksumStatus,
  } = useEcuStore();

  const {
    viewMode,
    setViewMode,
    showExplorer,
    showHexView,
    showAiPanel,
    togglePanel,
  } = useUiStore();

  return (
    <div className="toolbar">
      <div className="toolbar-brand">
        <BrandMark size={34} showLabel subtitle="Desktop Suite" />
      </div>

      <div className="toolbar-divider" />

      {/* File operations */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={() => void openBinFileFromDialog()} title="Open BIN File (Ctrl+O)">
          📁 Open BIN
        </button>
        <button className="toolbar-btn" onClick={() => void openXdfFileFromDialog()} title="Open XDF Definition">
          📋 Open XDF
        </button>
        <button
          className="toolbar-btn"
          onClick={() => void saveBinFileFromDialog()}
          disabled={!ecuFile}
          title="Save (Ctrl+S)"
        >
          💾 Save
        </button>
        <button
          className="toolbar-btn"
          onClick={closeBinFile}
          disabled={!ecuFile}
          title="Close File"
        >
          ✖ Close
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Edit operations */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={undo}
          disabled={!canUndo()}
          title="Undo (Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button
          className="toolbar-btn"
          onClick={redo}
          disabled={!canRedo()}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷ Redo
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* View mode */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${viewMode === 'table' ? 'active' : ''}`}
          onClick={() => setViewMode('table')}
          title="Table View"
        >
          📊 Table
        </button>
        <button
          className={`toolbar-btn ${viewMode === '2d' ? 'active' : ''}`}
          onClick={() => setViewMode('2d')}
          title="2D Chart View"
        >
          📈 2D
        </button>
        <button
          className={`toolbar-btn ${viewMode === '3d' ? 'active' : ''}`}
          onClick={() => setViewMode('3d')}
          title="3D Surface View"
        >
          🎲 3D
        </button>
        <button
          className={`toolbar-btn params-btn ${viewMode === 'params' ? 'active' : ''}`}
          onClick={() => setViewMode('params')}
          title="ECU Parameters (Rev limiter, Quick shifter, Fan control, etc.)"
        >
          ⚙️ Params
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Panel toggles */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${showExplorer ? 'active' : ''}`}
          onClick={() => togglePanel('explorer')}
          title="Toggle Explorer (Ctrl+1)"
        >
          📂 Explorer
        </button>
        <button
          className={`toolbar-btn ${showHexView ? 'active' : ''}`}
          onClick={() => togglePanel('hex')}
          title="Toggle Hex View (Ctrl+2)"
        >
          🔢 Hex
        </button>
        <button
          className={`toolbar-btn ${showAiPanel ? 'active' : ''}`}
          onClick={() => togglePanel('ai')}
          title="Toggle AI Assistant (Ctrl+3)"
        >
          🤖 AI
        </button>
      </div>

      <div className="toolbar-spacer" />

      {/* Checksum */}
      <div className="toolbar-group">
        <span className={`checksum-status ${checksumStatus}`}>
          {checksumStatus === 'valid' && '✓ Checksum OK'}
          {checksumStatus === 'invalid' && '⚠ Checksum Invalid'}
          {checksumStatus === 'unknown' && '? Checksum Unknown'}
        </span>
        <button
          className="toolbar-btn"
          onClick={correctChecksum}
          disabled={!ecuFile || checksumStatus !== 'invalid'}
          title="Correct Checksum"
        >
          🔧 Fix
        </button>
      </div>

      <style>{`
        .toolbar {
          height: var(--toolbar-height);
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          padding: 0 8px;
          gap: 4px;
        }

        .toolbar-group {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .toolbar-brand {
          display: flex;
          align-items: center;
          padding-right: 4px;
          min-width: 0;
        }

        .toolbar-btn {
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all var(--transition-fast);
        }

        .toolbar-btn:hover:not(:disabled) {
          background-color: var(--bg-hover);
        }

        .toolbar-btn.active {
          background-color: var(--bg-tertiary);
        }

        .toolbar-btn:disabled {
          opacity: 0.4;
        }

        .toolbar-divider {
          width: 1px;
          height: 24px;
          background-color: var(--border-color);
          margin: 0 8px;
        }

        .toolbar-spacer {
          flex: 1;
        }

        .checksum-status {
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 4px;
          margin-right: 8px;
        }

        .checksum-status.valid {
          color: var(--accent-success);
          background-color: rgba(34, 197, 94, 0.1);
        }

        .checksum-status.invalid {
          color: var(--accent-warning);
          background-color: rgba(234, 179, 8, 0.1);
        }

        .checksum-status.unknown {
          color: var(--text-muted);
          background-color: var(--bg-tertiary);
        }

        .toolbar-btn.params-btn {
          background-color: rgba(168, 85, 247, 0.1);
          border: 1px solid rgba(168, 85, 247, 0.3);
        }

        .toolbar-btn.params-btn:hover {
          background-color: rgba(168, 85, 247, 0.2);
        }

        .toolbar-btn.params-btn.active {
          background-color: rgba(168, 85, 247, 0.3);
          border-color: rgba(168, 85, 247, 0.5);
        }
      `}</style>
    </div>
  );
}
