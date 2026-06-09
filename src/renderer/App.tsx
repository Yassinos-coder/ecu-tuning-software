import React, { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { Toolbar } from './components/layout/Toolbar';
import { StatusBar } from './components/layout/StatusBar';
import { MapExplorer } from './components/explorer/MapExplorer';
import { TableEditor } from './components/editors/TableEditor';
import { HexEditor } from './components/editors/HexEditor';
import { Chart2D } from './components/charts/Chart2D';
import { Chart3D } from './components/charts/Chart3D';
import { ScalarsPanel } from './components/editors/ScalarsPanel';
import { AiChatPanel } from './components/ai/AiChatPanel';
import { BrandMark } from './components/layout/BrandMark';
import { useEcuStore } from './store/ecuStore';
import { useUiStore } from './store/uiStore';
import { executeMenuAction, openBinFileFromDialog, openXdfFileFromDialog } from './lib/appCommands';

function App() {
  const { ecuFile, error, setError, getSelectedMap } = useEcuStore();
  const { showExplorer, showHexView, showAiPanel, viewMode, theme } = useUiStore();

  // Set theme on body
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    return window.electronAPI?.menu?.onAction((action) => {
      executeMenuAction(action);
    });
  }, []);

  const selectedMap = getSelectedMap();

  return (
    <AppShell>
      <Toolbar />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="app-content">
        {/* Left sidebar - Map Explorer */}
        {showExplorer && (
          <aside className="sidebar sidebar-left">
            <MapExplorer />
          </aside>
        )}

        {/* Main content area */}
        <main className="main-content">
          {!ecuFile ? (
            <WelcomeScreen />
          ) : viewMode === 'params' ? (
            <div className="editor-container">
              <ScalarsPanel />
            </div>
          ) : !selectedMap ? (
            <NoMapSelected />
          ) : (
            <div className="editor-container">
              {viewMode === 'table' && <TableEditor map={selectedMap} />}
              {viewMode === '2d' && <Chart2D map={selectedMap} />}
              {viewMode === '3d' && <Chart3D map={selectedMap} />}
            </div>
          )}

          {/* Hex view (below editor) */}
          {showHexView && ecuFile && (
            <div className="hex-panel">
              <HexEditor />
            </div>
          )}
        </main>

        {/* Right sidebar - AI Panel */}
        {showAiPanel && (
          <aside className="sidebar sidebar-right">
            <AiChatPanel />
          </aside>
        )}
      </div>

      <StatusBar />

      <style>{`
        .app-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .sidebar {
          background-color: var(--bg-secondary);
          border-color: var(--border-color);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .sidebar-left {
          width: var(--sidebar-width);
          border-right: 1px solid var(--border-color);
        }

        .sidebar-right {
          width: var(--ai-panel-width);
          border-left: 1px solid var(--border-color);
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background-color: var(--bg-primary);
        }

        .editor-container {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .hex-panel {
          height: 200px;
          border-top: 1px solid var(--border-color);
          overflow: hidden;
        }
      `}</style>
    </AppShell>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="error-banner">
      <span className="error-message">{message}</span>
      <button className="error-dismiss" onClick={onDismiss} title="Dismiss error">
        ×
      </button>

      <style>{`
        .error-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background-color: rgba(239, 68, 68, 0.14);
          border-bottom: 1px solid rgba(239, 68, 68, 0.35);
          color: var(--accent-danger);
          font-size: 13px;
        }

        .error-message {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .error-dismiss {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          color: inherit;
          font-size: 18px;
          line-height: 1;
        }

        .error-dismiss:hover {
          background-color: rgba(239, 68, 68, 0.16);
        }
      `}</style>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-brand">
          <BrandMark size={120} showLabel subtitle="Calibration Studio" />
        </div>
        <h1>ECU Tuning Software</h1>
        <p className="welcome-subtitle">Professional ECU calibration with AI assistance</p>

        <div className="welcome-actions">
          <button className="welcome-btn primary" onClick={() => void openBinFileFromDialog()}>
            <span className="btn-icon">📁</span>
            Open BIN File
          </button>
          <button className="welcome-btn secondary" onClick={() => void openXdfFileFromDialog()}>
            <span className="btn-icon">📋</span>
            Open XDF Definition
          </button>
        </div>

        <div className="welcome-info">
          <h3>Getting Started</h3>
          <ol>
            <li>Load your ECU binary file (.bin)</li>
            <li>Load the matching XDF definition file</li>
            <li>Browse and edit calibration maps</li>
            <li>Use the AI assistant for guidance</li>
            <li>Save your modified file</li>
          </ol>
        </div>

        <p className="welcome-warning">
          ⚠️ <strong>Warning:</strong> Improper ECU tuning can damage your engine.
          Always verify changes with proper equipment.
        </p>
      </div>

      <style>{`
        .welcome-screen {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }

        .welcome-content {
          max-width: 560px;
          text-align: center;
        }

        .welcome-brand {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
        }

        .welcome-content h1 {
          font-size: 28px;
          margin-bottom: 8px;
          color: var(--text-primary);
        }

        .welcome-subtitle {
          color: var(--text-secondary);
          margin-bottom: 32px;
        }

        .welcome-actions {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin-bottom: 40px;
        }

        .welcome-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          transition: all var(--transition-fast);
        }

        .welcome-btn.primary {
          background-color: var(--accent-primary);
          color: white;
        }

        .welcome-btn.primary:hover {
          background-color: var(--accent-secondary);
        }

        .welcome-btn.secondary {
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
        }

        .welcome-btn.secondary:hover {
          background-color: var(--bg-hover);
        }

        .btn-icon {
          font-size: 18px;
        }

        .welcome-info {
          text-align: left;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .welcome-info h3 {
          margin-bottom: 12px;
          color: var(--text-primary);
        }

        .welcome-info ol {
          padding-left: 20px;
          color: var(--text-secondary);
        }

        .welcome-info li {
          margin-bottom: 6px;
        }

        .welcome-warning {
          color: var(--accent-warning);
          font-size: 12px;
          padding: 12px;
          background-color: rgba(234, 179, 8, 0.1);
          border-radius: 6px;
        }
      `}</style>
    </div>
  );
}

function NoMapSelected() {
  return (
    <div className="no-map-selected">
      <p>Select a map from the explorer to begin editing</p>
      <style>{`
        .no-map-selected {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}

export default App;
