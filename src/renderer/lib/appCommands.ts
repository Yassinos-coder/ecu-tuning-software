import { MenuActions, type MenuAction } from '@shared/types/ipc';
import { useEcuStore } from '../store/ecuStore';
import { useUiStore } from '../store/uiStore';

function getElectronApi() {
  if (typeof window === 'undefined' || !window.electronAPI) {
    return null;
  }

  return window.electronAPI;
}

export async function openBinFileFromDialog(): Promise<void> {
  const electronAPI = getElectronApi();
  if (!electronAPI) {
    return;
  }

  const { loadBinFile, setError } = useEcuStore.getState();
  setError(null);

  const result = await electronAPI.file.openDialog({
    title: 'Open ECU Binary File',
    filters: [
      { name: 'Binary Files', extensions: ['bin', 'BIN'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return;
  }

  const filePath = result.filePaths[0];
  const fileResult = await electronAPI.file.readBin(filePath);

  if (fileResult.success && fileResult.data) {
    loadBinFile(fileResult.path, fileResult.filename, fileResult.data);
    return;
  }

  setError(fileResult.error || 'Failed to open BIN file.');
}

export async function openXdfFileFromDialog(): Promise<void> {
  const electronAPI = getElectronApi();
  if (!electronAPI) {
    return;
  }

  const { loadXdfFile, setError } = useEcuStore.getState();
  setError(null);

  const result = await electronAPI.file.openDialog({
    title: 'Open XDF Definition File',
    filters: [
      { name: 'XDF Files', extensions: ['xdf', 'XDF'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return;
  }

  const filePath = result.filePaths[0];
  const fileResult = await electronAPI.file.readXdf(filePath);

  if (fileResult.success && fileResult.content) {
    loadXdfFile(fileResult.content);
    return;
  }

  setError(fileResult.error || 'Failed to open XDF file.');
}

export async function saveBinFileFromDialog(): Promise<void> {
  const electronAPI = getElectronApi();
  const { ecuFile, saveBinFile, setError } = useEcuStore.getState();

  if (!ecuFile || !electronAPI) {
    return;
  }

  setError(null);

  const result = await electronAPI.file.saveDialog({
    title: 'Save ECU Binary File',
    defaultPath: ecuFile.metadata.path || ecuFile.metadata.filename,
    filters: [
      { name: 'Binary Files', extensions: ['bin'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return;
  }

  const data = saveBinFile();
  if (!data) {
    setError('There is no loaded BIN file to save.');
    return;
  }

  const writeResult = await electronAPI.file.writeBin(result.filePaths[0], data);
  if (!writeResult.success) {
    setError(writeResult.error || 'Failed to save BIN file.');
  }
}

export function executeMenuAction(action: MenuAction): void {
  const ecuStore = useEcuStore.getState();
  const uiStore = useUiStore.getState();

  switch (action) {
    case MenuActions.OPEN_BIN:
      void openBinFileFromDialog();
      return;
    case MenuActions.OPEN_XDF:
      void openXdfFileFromDialog();
      return;
    case MenuActions.SAVE:
    case MenuActions.SAVE_AS:
    case MenuActions.EXPORT_BIN:
      void saveBinFileFromDialog();
      return;
    case MenuActions.UNDO:
      ecuStore.undo();
      return;
    case MenuActions.REDO:
      ecuStore.redo();
      return;
    case MenuActions.RESTORE_ORIGINAL:
      if (ecuStore.selectedMapId) {
        ecuStore.restoreMap(ecuStore.selectedMapId);
      } else {
        ecuStore.setError('Select a map before restoring original values.');
      }
      return;
    case MenuActions.TOGGLE_EXPLORER:
      uiStore.togglePanel('explorer');
      return;
    case MenuActions.TOGGLE_HEX:
      uiStore.togglePanel('hex');
      return;
    case MenuActions.TOGGLE_AI:
      uiStore.togglePanel('ai');
      return;
    case MenuActions.VIEW_2D:
      uiStore.setViewMode('2d');
      return;
    case MenuActions.VIEW_3D:
      uiStore.setViewMode('3d');
      return;
    case MenuActions.VALIDATE_CHECKSUM:
      ecuStore.validateChecksum();
      return;
    case MenuActions.CORRECT_CHECKSUM:
      ecuStore.correctChecksum();
      return;
    case MenuActions.AI_SETTINGS:
      if (!uiStore.showAiPanel) {
        uiStore.togglePanel('ai');
      }
      return;
    case MenuActions.SAFETY_GUIDELINES:
      window.alert(
        'Safety first:\n\n- Make small changes and data log every step.\n- Verify fueling, knock, and temperatures under load.\n- Keep a known-good backup before flashing any calibration.'
      );
      return;
    case MenuActions.SHORTCUTS:
      window.alert(
        'Keyboard shortcuts:\n\nCtrl/Cmd+O Open BIN\nCtrl/Cmd+Shift+O Open XDF\nCtrl/Cmd+S Save\nCtrl/Cmd+Z Undo\nCtrl/Cmd+Shift+Z Redo\nCtrl/Cmd+1 Explorer\nCtrl/Cmd+2 Hex\nCtrl/Cmd+3 AI'
      );
      return;
    default:
      ecuStore.setError(`Menu action "${action}" is not implemented yet.`);
  }
}
