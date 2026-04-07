import { Menu, BrowserWindow, dialog, app } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { IpcChannels, MenuActions, type MenuAction } from '../shared/types/ipc';

export function createApplicationMenu(mainWindow: BrowserWindow | null): Menu {
  const isMac = process.platform === 'darwin';
  const sendMenuAction = (action: MenuAction) => {
    mainWindow?.webContents.send(IpcChannels.MENU_ACTION, action);
  };

  const template: MenuItemConstructorOptions[] = [
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Open BIN File...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuAction(MenuActions.OPEN_BIN),
        },
        {
          label: 'Open XDF Definition...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendMenuAction(MenuActions.OPEN_XDF),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuAction(MenuActions.SAVE),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuAction(MenuActions.SAVE_AS),
        },
        { type: 'separator' },
        {
          label: 'Export Modified BIN...',
          click: () => sendMenuAction(MenuActions.EXPORT_BIN),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendMenuAction(MenuActions.UNDO),
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => sendMenuAction(MenuActions.REDO),
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        {
          label: 'Find Map...',
          accelerator: 'CmdOrCtrl+F',
          click: () => sendMenuAction(MenuActions.FIND_MAP),
        },
        { type: 'separator' },
        {
          label: 'Restore Original Values',
          click: () => sendMenuAction(MenuActions.RESTORE_ORIGINAL),
        },
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Map Explorer',
          accelerator: 'CmdOrCtrl+1',
          click: () => sendMenuAction(MenuActions.TOGGLE_EXPLORER),
        },
        {
          label: 'Toggle Hex View',
          accelerator: 'CmdOrCtrl+2',
          click: () => sendMenuAction(MenuActions.TOGGLE_HEX),
        },
        {
          label: 'Toggle AI Assistant',
          accelerator: 'CmdOrCtrl+3',
          click: () => sendMenuAction(MenuActions.TOGGLE_AI),
        },
        { type: 'separator' },
        {
          label: '2D Chart View',
          accelerator: 'CmdOrCtrl+4',
          click: () => sendMenuAction(MenuActions.VIEW_2D),
        },
        {
          label: '3D Surface View',
          accelerator: 'CmdOrCtrl+5',
          click: () => sendMenuAction(MenuActions.VIEW_3D),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // Tools menu
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Validate Checksum',
          click: () => sendMenuAction(MenuActions.VALIDATE_CHECKSUM),
        },
        {
          label: 'Correct Checksum',
          click: () => sendMenuAction(MenuActions.CORRECT_CHECKSUM),
        },
        { type: 'separator' },
        {
          label: 'Compare with Original',
          click: () => sendMenuAction(MenuActions.COMPARE_ORIGINAL),
        },
        {
          label: 'Show All Modified Cells',
          click: () => sendMenuAction(MenuActions.SHOW_MODIFIED),
        },
        { type: 'separator' },
        {
          label: 'AI Settings...',
          click: () => sendMenuAction(MenuActions.AI_SETTINGS),
        },
      ],
    },

    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'About ECU Tuning Software',
          click: async () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About ECU Tuning Software',
              message: 'ECU Tuning Software',
              detail: `Version: ${app.getVersion()}\n\nProfessional ECU calibration tool with AI assistance.\n\nWARNING: Improper tuning can damage your engine. Always use professional judgment.`,
            });
          },
        },
        { type: 'separator' },
        {
          label: 'Safety Guidelines',
          click: () => sendMenuAction(MenuActions.SAFETY_GUIDELINES),
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => sendMenuAction(MenuActions.SHORTCUTS),
        },
      ],
    },
  ];

  // Add app menu on macOS
  if (isMac) {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  return Menu.buildFromTemplate(template);
}
