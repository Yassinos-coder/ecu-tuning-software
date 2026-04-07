import React from 'react';
import { useEcuStore } from '../../store/ecuStore';
import { useUiStore } from '../../store/uiStore';

export function StatusBar() {
  const { ecuFile, xdfDefinition, maps, scalars, session, getSelectedMap } = useEcuStore();
  const { viewMode } = useUiStore();

  const selectedMap = getSelectedMap();
  const modifiedMaps = maps.filter((m) => m.isModified);
  const modifiedScalars = scalars.filter((s) => s.isModified);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="status-bar">
      <div className="status-left">
        {/* File info */}
        {ecuFile ? (
          <span className="status-item">
            📄 {ecuFile.metadata.filename} ({formatFileSize(ecuFile.size)})
            {ecuFile.isDirty && <span className="modified-badge">*</span>}
          </span>
        ) : (
          <span className="status-item text-muted">No file loaded</span>
        )}

        {xdfDefinition && (
          <span className="status-item">
            📋 {xdfDefinition.title}
          </span>
        )}
      </div>

      <div className="status-center">
        {/* Current map/params info */}
        {viewMode === 'params' ? (
          <>
            <span className="status-item">
              ⚙️ ECU Parameters
            </span>
            <span className="status-item text-muted">
              {scalars.length} parameters
            </span>
            {modifiedScalars.length > 0 && (
              <span className="status-item modified">
                {modifiedScalars.length} modified
              </span>
            )}
          </>
        ) : selectedMap && (
          <>
            <span className="status-item">
              {selectedMap.title}
            </span>
            <span className="status-item text-muted">
              {selectedMap.rows}×{selectedMap.cols}
            </span>
            <span className="status-item text-muted">
              {selectedMap.units}
            </span>
            {selectedMap.isModified && (
              <span className="status-item modified">
                {selectedMap.getModifiedCells().length} cells modified
              </span>
            )}
          </>
        )}
      </div>

      <div className="status-right">
        {/* Session info */}
        {session && (
          <span className="status-item text-muted">
            History: {session.undoCount} / {session.history.length}
          </span>
        )}

        {/* Modified maps count */}
        {modifiedMaps.length > 0 && (
          <span className="status-item warning">
            {modifiedMaps.length} map{modifiedMaps.length > 1 ? 's' : ''} modified
          </span>
        )}

        {/* View mode */}
        <span className="status-item view-mode">
          {viewMode === 'table' && '📊 Table'}
          {viewMode === '2d' && '📈 2D Chart'}
          {viewMode === '3d' && '🎲 3D Surface'}
          {viewMode === 'params' && '⚙️ Parameters'}
        </span>
      </div>

      <style>{`
        .status-bar {
          height: var(--statusbar-height);
          background-color: var(--bg-tertiary);
          border-top: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          padding: 0 12px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .status-left,
        .status-center,
        .status-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .status-left {
          flex: 1;
        }

        .status-center {
          flex: 1;
          justify-content: center;
        }

        .status-right {
          flex: 1;
          justify-content: flex-end;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .status-item.text-muted {
          color: var(--text-muted);
        }

        .status-item.modified {
          color: var(--accent-warning);
        }

        .status-item.warning {
          color: var(--accent-warning);
        }

        .modified-badge {
          color: var(--accent-warning);
          font-weight: bold;
          margin-left: 2px;
        }

        .view-mode {
          padding: 2px 8px;
          background-color: var(--bg-secondary);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}
