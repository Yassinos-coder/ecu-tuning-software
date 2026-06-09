import React from 'react';
import { useEcuStore } from '../../store/ecuStore';
import { useUiStore } from '../../store/uiStore';

export function StatusBar() {
  const {
    ecuFile,
    xdfDefinition,
    xdfFile,
    maps,
    scalars,
    session,
    isLoading,
    loadingMessage,
    checksumStatus,
    getSelectedMap,
  } = useEcuStore();
  const { viewMode } = useUiStore();

  const selectedMap = getSelectedMap();
  const modifiedMaps = maps.filter((m) => m.isModified);
  const modifiedScalars = scalars.filter((s) => s.isModified);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const xdfDisplayName = xdfFile?.filename || xdfDefinition?.title || 'No XDF loaded';
  const xdfDetail =
    xdfFile?.size !== undefined
      ? `${formatFileSize(xdfFile.size)}${xdfDefinition ? `, ${maps.length} maps, ${scalars.length} params` : ''}`
      : xdfDefinition
        ? `${maps.length} maps, ${scalars.length} params`
        : 'Definition inactive';

  return (
    <div className="status-shell">
      {isLoading && (
        <div className="status-progress" role="progressbar" aria-label={loadingMessage || 'File operation in progress'}>
          <span />
        </div>
      )}

      <div className="status-bar">
        <div className="status-left">
          <span className={`file-status ${ecuFile ? 'active' : 'inactive'}`} title={ecuFile?.metadata.path || 'No BIN loaded'}>
            <span className="file-label">BIN</span>
            <span className="file-name">
              {ecuFile ? ecuFile.metadata.filename : 'No BIN loaded'}
              {ecuFile?.isDirty && <span className="modified-badge">*</span>}
            </span>
            <span className="file-detail">
              {ecuFile ? formatFileSize(ecuFile.size) : 'Binary inactive'}
            </span>
          </span>

          <span className={`file-status ${xdfDefinition ? 'active' : 'inactive'}`} title={xdfFile?.path || 'No XDF loaded'}>
            <span className="file-label">XDF</span>
            <span className="file-name">{xdfDisplayName}</span>
            <span className="file-detail">{xdfDetail}</span>
          </span>
        </div>

        <div className="status-center">
          {isLoading ? (
            <span className="status-item loading-message">
              {loadingMessage || 'Working...'}
            </span>
          ) : viewMode === 'params' ? (
            <>
              <span className="status-item">
                ECU Parameters
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
          ) : selectedMap ? (
            <>
              <span className="status-item">
                {selectedMap.title}
              </span>
              <span className="status-item text-muted">
                {selectedMap.rows}x{selectedMap.cols}
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
          ) : (
            <span className="status-item text-muted">
              {xdfDefinition ? 'Select a map to edit' : 'Load BIN and XDF files'}
            </span>
          )}
        </div>

        <div className="status-right">
          <span className={`status-item checksum ${checksumStatus}`}>
            Checksum: {checksumStatus}
          </span>

          {session && (
            <span className="status-item text-muted">
              History: {session.undoCount} / {session.history.length}
            </span>
          )}

          {modifiedMaps.length > 0 && (
            <span className="status-item warning">
              {modifiedMaps.length} map{modifiedMaps.length > 1 ? 's' : ''} modified
            </span>
          )}

          <span className="status-item view-mode">
            {viewMode === 'table' && 'Table'}
            {viewMode === '2d' && '2D Chart'}
            {viewMode === '3d' && '3D Surface'}
            {viewMode === 'params' && 'Parameters'}
          </span>
        </div>
      </div>

      <style>{`
        .status-shell {
          flex-shrink: 0;
          background-color: var(--bg-tertiary);
          border-top: 1px solid var(--border-color);
        }

        .status-progress {
          height: 3px;
          overflow: hidden;
          background-color: var(--bg-secondary);
        }

        .status-progress span {
          display: block;
          width: 36%;
          height: 100%;
          background-color: var(--accent-primary);
          animation: status-progress-slide 1.1s ease-in-out infinite;
        }

        @keyframes status-progress-slide {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(290%); }
        }

        .status-bar {
          height: var(--statusbar-height);
          display: flex;
          align-items: center;
          padding: 0 12px;
          gap: 12px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .status-left,
        .status-center,
        .status-right {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .status-left {
          flex: 1.25;
        }

        .status-center {
          flex: 1;
          justify-content: center;
        }

        .status-right {
          flex: 1.15;
          justify-content: flex-end;
        }

        .file-status {
          display: grid;
          grid-template-columns: auto minmax(80px, 1fr) auto;
          align-items: center;
          gap: 6px;
          min-width: 0;
          max-width: 50%;
          padding: 2px 7px;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
        }

        .file-status.active {
          color: var(--text-primary);
        }

        .file-status.inactive {
          color: var(--text-muted);
        }

        .file-label {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          color: var(--text-muted);
        }

        .file-name,
        .file-detail {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-name {
          font-weight: 500;
        }

        .file-detail {
          color: var(--text-muted);
          font-size: 11px;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 4px;
          min-width: 0;
          white-space: nowrap;
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

        .loading-message {
          color: var(--accent-primary);
          font-weight: 500;
        }

        .checksum {
          padding: 2px 7px;
          border-radius: 3px;
          background-color: var(--bg-secondary);
          text-transform: capitalize;
        }

        .checksum.valid {
          color: var(--accent-success);
        }

        .checksum.invalid {
          color: var(--accent-warning);
        }

        .checksum.unknown {
          color: var(--text-muted);
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

        @media (max-width: 1100px) {
          .file-detail,
          .status-right .text-muted {
            display: none;
          }

          .file-status {
            grid-template-columns: auto minmax(70px, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
