import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { EcuFile } from '../../core/domain/EcuFile';
import { CalibrationMap } from '../../core/domain/CalibrationMap';
import { Scalar } from '../../core/domain/Scalar';
import { Session } from '../../core/domain/Session';
import { XdfInterpreter, XdfDefinition } from '../../core/services/XdfInterpreter';
import { BinMapper } from '../../core/services/BinMapper';
import { ChecksumService } from '../../core/services/ChecksumService';
import { EditActionType, CellChange, CellRange } from '../../core/domain/types';

interface EcuState {
  // Loaded files
  ecuFile: EcuFile | null;
  xdfDefinition: XdfDefinition | null;

  // Parsed data
  maps: CalibrationMap[];
  scalars: Scalar[];

  // Current selection
  selectedMapId: string | null;
  selectedCell: { row: number; col: number } | null;
  selectedRange: CellRange | null;

  // Session
  session: Session | null;

  // Services (initialized once)
  xdfInterpreter: XdfInterpreter;
  binMapper: BinMapper;
  checksumService: ChecksumService;

  // Status
  isLoading: boolean;
  error: string | null;
  checksumStatus: 'unknown' | 'valid' | 'invalid';
}

interface EcuActions {
  // File operations
  loadBinFile: (path: string, filename: string, data: Uint8Array) => void;
  loadXdfFile: (content: string) => void;
  saveBinFile: () => Uint8Array | null;
  closeBinFile: () => void;

  // Map operations
  selectMap: (mapId: string | null) => void;
  selectCell: (row: number, col: number) => void;
  selectRange: (range: CellRange | null) => void;

  // Editing
  editCell: (mapId: string, row: number, col: number, value: number) => void;
  editRange: (mapId: string, range: CellRange, values: number[][]) => void;
  applyPercentageChange: (mapId: string, range: CellRange, percentage: number) => void;
  applyFlatChange: (mapId: string, range: CellRange, delta: number) => void;
  fillRange: (mapId: string, range: CellRange, value: number) => void;
  interpolateRange: (mapId: string, range: CellRange) => void;
  smoothRange: (mapId: string, range: CellRange, strength: number) => void;
  restoreCell: (mapId: string, row: number, col: number) => void;
  restoreMap: (mapId: string) => void;
  editScalar: (scalarId: string, value: number) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Checksum
  validateChecksum: () => void;
  correctChecksum: () => void;

  // Utilities
  getSelectedMap: () => CalibrationMap | null;
  syncMapToBin: (mapId: string) => void;
  setError: (error: string | null) => void;
}

type EcuStore = EcuState & EcuActions;

export const useEcuStore = create<EcuStore>()(
  immer((set, get) => ({
    // Initial state
    ecuFile: null,
    xdfDefinition: null,
    maps: [],
    scalars: [],
    selectedMapId: null,
    selectedCell: null,
    selectedRange: null,
    session: null,
    xdfInterpreter: new XdfInterpreter(),
    binMapper: new BinMapper(),
    checksumService: new ChecksumService(),
    isLoading: false,
    error: null,
    checksumStatus: 'unknown',

    // Actions
    loadBinFile: (path, filename, data) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const ecuFile = new EcuFile(
          {
            path,
            filename,
            size: data.length,
            lastModified: new Date(),
          },
          data
        );

        // Create new session
        const session = new Session(ecuFile.id);
        const existingXdfDefinition = get().xdfDefinition;
        const binMapper = get().binMapper;
        const loadedMaps = existingXdfDefinition
          ? binMapper.loadMaps(ecuFile, existingXdfDefinition)
          : [];
        const loadedScalars = existingXdfDefinition
          ? binMapper.loadScalars(ecuFile, existingXdfDefinition)
          : [];

        set((state) => {
          state.ecuFile = ecuFile;
          state.session = session;
          state.isLoading = false;
          state.checksumStatus = 'unknown';
          state.maps = loadedMaps;
          state.scalars = loadedScalars;
        });

        // Try to validate checksum
        get().validateChecksum();
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to load BIN file';
          state.isLoading = false;
        });
      }
    },

    loadXdfFile: (content) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const xdfInterpreter = get().xdfInterpreter;
        const xdfDefinition = xdfInterpreter.parse(content);
        const currentEcuFile = get().ecuFile;
        const binMapper = get().binMapper;
        const loadedMaps = currentEcuFile
          ? binMapper.loadMaps(currentEcuFile, xdfDefinition)
          : [];
        const loadedScalars = currentEcuFile
          ? binMapper.loadScalars(currentEcuFile, xdfDefinition)
          : [];

        set((state) => {
          state.xdfDefinition = xdfDefinition;
          state.isLoading = false;
          state.maps = loadedMaps;
          state.scalars = loadedScalars;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to parse XDF file';
          state.isLoading = false;
        });
      }
    },

    saveBinFile: () => {
      const state = get();
      if (!state.ecuFile) return null;

      // Sync all maps to BIN
      for (const map of state.maps) {
        if (map.isModified) {
          state.binMapper.writeMap(state.ecuFile, map);
        }
      }

      for (const scalar of state.scalars) {
        if (scalar.isModified) {
          state.binMapper.writeScalar(state.ecuFile, scalar);
        }
      }

      // Correct checksum
      state.checksumService.correct(state.ecuFile);

      state.ecuFile.markSaved();

      set((draft) => {
        draft.checksumStatus = 'valid';
      });

      return state.ecuFile.data;
    },

    closeBinFile: () => {
      set((state) => {
        state.ecuFile = null;
        state.xdfDefinition = null;
        state.maps = [];
        state.scalars = [];
        state.selectedMapId = null;
        state.selectedCell = null;
        state.selectedRange = null;
        state.session = null;
        state.checksumStatus = 'unknown';
        state.error = null;
      });
    },

    selectMap: (mapId) => {
      set((state) => {
        state.selectedMapId = mapId;
        state.selectedCell = null;
        state.selectedRange = null;
      });
    },

    selectCell: (row, col) => {
      set((state) => {
        state.selectedCell = { row, col };
      });
    },

    selectRange: (range) => {
      set((state) => {
        state.selectedRange = range;
      });
    },

    editCell: (mapId, row, col, value) => {
      const state = get();
      const mapIndex = state.maps.findIndex((m) => m.id === mapId);
      if (mapIndex === -1) return;

      const map = state.maps[mapIndex];
      const change = map.setValue(row, col, value);

      // Record in session
      if (state.session) {
        state.session.addAction(
          EditActionType.CELL_EDIT,
          mapId,
          map.title,
          [change]
        );
      }

      // Sync to BIN
      if (state.ecuFile) {
        state.binMapper.writeCell(state.ecuFile, map, row, col, map.getRawValue(row, col));
      }

      set((state) => {
        state.maps[mapIndex] = map;
        state.checksumStatus = 'invalid';
      });
    },

    editRange: (mapId, range, values) => {
      const state = get();
      const mapIndex = state.maps.findIndex((m) => m.id === mapId);
      if (mapIndex === -1) return;

      const map = state.maps[mapIndex];
      const changes: CellChange[] = [];

      for (let row = range.startRow; row <= range.endRow; row++) {
        for (let col = range.startCol; col <= range.endCol; col++) {
          const valueRow = row - range.startRow;
          const valueCol = col - range.startCol;
          if (values[valueRow]?.[valueCol] !== undefined) {
            changes.push(map.setValue(row, col, values[valueRow][valueCol]));
          }
        }
      }

      if (state.session && changes.length > 0) {
        state.session.addAction(EditActionType.RANGE_EDIT, mapId, map.title, changes);
      }

      get().syncMapToBin(mapId);

      set((state) => {
        state.maps[mapIndex] = map;
        state.checksumStatus = 'invalid';
      });
    },

    applyPercentageChange: (mapId, range, percentage) => {
      const state = get();
      const mapIndex = state.maps.findIndex((m) => m.id === mapId);
      if (mapIndex === -1) return;

      const map = state.maps[mapIndex];
      const changes = map.applyPercentageChange(range, percentage);

      if (state.session && changes.length > 0) {
        state.session.addAction(
          EditActionType.PERCENTAGE,
          mapId,
          map.title,
          changes,
          `${percentage > 0 ? '+' : ''}${percentage}% change`
        );
      }

      get().syncMapToBin(mapId);

      set((state) => {
        state.maps[mapIndex] = map;
        state.checksumStatus = 'invalid';
      });
    },

    applyFlatChange: (mapId, range, delta) => {
      const state = get();
      const mapIndex = state.maps.findIndex((m) => m.id === mapId);
      if (mapIndex === -1) return;

      const map = state.maps[mapIndex];
      const changes = map.applyFlatChange(range, delta);

      if (state.session && changes.length > 0) {
        state.session.addAction(
          EditActionType.BULK_EDIT,
          mapId,
          map.title,
          changes,
          `${delta > 0 ? '+' : ''}${delta} flat change`
        );
      }

      get().syncMapToBin(mapId);

      set((state) => {
        state.maps[mapIndex] = map;
        state.checksumStatus = 'invalid';
      });
    },

    fillRange: (mapId, range, value) => {
      const state = get();
      const mapIndex = state.maps.findIndex((m) => m.id === mapId);
      if (mapIndex === -1) return;

      const map = state.maps[mapIndex];
      const changes = map.fillRange(range, value);

      if (state.session && changes.length > 0) {
        state.session.addAction(
          EditActionType.FILL,
          mapId,
          map.title,
          changes,
          `Fill with ${value}`
        );
      }

      get().syncMapToBin(mapId);

      set((state) => {
        state.maps[mapIndex] = map;
        state.checksumStatus = 'invalid';
      });
    },

    interpolateRange: (mapId, range) => {
      const state = get();
      const mapIndex = state.maps.findIndex((m) => m.id === mapId);
      if (mapIndex === -1) return;

      const map = state.maps[mapIndex];
      const changes = map.interpolateRange(range);

      if (state.session && changes.length > 0) {
        state.session.addAction(EditActionType.INTERPOLATE, mapId, map.title, changes);
      }

      get().syncMapToBin(mapId);

      set((state) => {
        state.maps[mapIndex] = map;
        state.checksumStatus = 'invalid';
      });
    },

    smoothRange: (mapId, range, strength) => {
      const state = get();
      const mapIndex = state.maps.findIndex((m) => m.id === mapId);
      if (mapIndex === -1) return;

      const map = state.maps[mapIndex];
      const changes = map.smoothRange(range, strength);

      if (state.session && changes.length > 0) {
        state.session.addAction(EditActionType.SMOOTH, mapId, map.title, changes);
      }

      get().syncMapToBin(mapId);

      set((state) => {
        state.maps[mapIndex] = map;
        state.checksumStatus = 'invalid';
      });
    },

    restoreCell: (mapId, row, col) => {
      const state = get();
      const mapIndex = state.maps.findIndex((m) => m.id === mapId);
      if (mapIndex === -1) return;

      const map = state.maps[mapIndex];
      map.restoreCell(row, col);

      get().syncMapToBin(mapId);

      set((state) => {
        state.maps[mapIndex] = map;
        state.checksumStatus = 'invalid';
      });
    },

    restoreMap: (mapId) => {
      const state = get();
      const mapIndex = state.maps.findIndex((m) => m.id === mapId);
      if (mapIndex === -1) return;

      const map = state.maps[mapIndex];
      map.restoreAll();

      get().syncMapToBin(mapId);

      set((state) => {
        state.maps[mapIndex] = map;
        state.checksumStatus = 'invalid';
      });
    },

    editScalar: (scalarId, value) => {
      const state = get();
      const scalarIndex = state.scalars.findIndex((scalar) => scalar.id === scalarId);
      if (scalarIndex === -1 || !state.ecuFile) return;

      const scalar = state.scalars[scalarIndex];
      const validation = scalar.validateValue(value);

      if (!validation.valid) {
        set((draft) => {
          draft.error = validation.message || `Invalid value for ${scalar.title}.`;
        });
        return;
      }

      const change = scalar.setValue(value);

      if (state.session) {
        state.session.addAction(
          EditActionType.CELL_EDIT,
          scalar.id,
          scalar.title,
          [{ row: 0, col: 0, oldValue: change.oldValue, newValue: change.newValue }],
          `Updated scalar "${scalar.title}"`
        );
      }

      state.binMapper.writeScalar(state.ecuFile, scalar);

      set((draft) => {
        draft.scalars[scalarIndex] = scalar;
        draft.checksumStatus = 'invalid';
        draft.error = null;
      });
    },

    undo: () => {
      const state = get();
      if (!state.session?.canUndo) return;

      const action = state.session.undo();
      if (!action) return;

      const mapIndex = state.maps.findIndex((m) => m.id === action.mapId);
      if (mapIndex !== -1) {
        const map = state.maps[mapIndex];

        for (const change of action.changes) {
          map.setValue(change.row, change.col, change.oldValue);
        }

        get().syncMapToBin(action.mapId);

        set((draft) => {
          draft.maps[mapIndex] = map;
          draft.checksumStatus = 'invalid';
        });
        return;
      }

      const scalarIndex = state.scalars.findIndex((scalar) => scalar.id === action.mapId);
      if (scalarIndex === -1 || !state.ecuFile) return;

      const scalar = state.scalars[scalarIndex];
      const previousValue = action.changes[action.changes.length - 1]?.oldValue;
      if (previousValue === undefined) return;

      scalar.setValue(previousValue);
      state.binMapper.writeScalar(state.ecuFile, scalar);

      set((draft) => {
        draft.scalars[scalarIndex] = scalar;
        draft.checksumStatus = 'invalid';
      });
    },

    redo: () => {
      const state = get();
      if (!state.session?.canRedo) return;

      const action = state.session.redo();
      if (!action) return;

      const mapIndex = state.maps.findIndex((m) => m.id === action.mapId);
      if (mapIndex !== -1) {
        const map = state.maps[mapIndex];

        for (const change of action.changes) {
          map.setValue(change.row, change.col, change.newValue);
        }

        get().syncMapToBin(action.mapId);

        set((draft) => {
          draft.maps[mapIndex] = map;
          draft.checksumStatus = 'invalid';
        });
        return;
      }

      const scalarIndex = state.scalars.findIndex((scalar) => scalar.id === action.mapId);
      if (scalarIndex === -1 || !state.ecuFile) return;

      const scalar = state.scalars[scalarIndex];
      const nextValue = action.changes[action.changes.length - 1]?.newValue;
      if (nextValue === undefined) return;

      scalar.setValue(nextValue);
      state.binMapper.writeScalar(state.ecuFile, scalar);

      set((draft) => {
        draft.scalars[scalarIndex] = scalar;
        draft.checksumStatus = 'invalid';
      });
    },

    canUndo: () => {
      return get().session?.canUndo ?? false;
    },

    canRedo: () => {
      return get().session?.canRedo ?? false;
    },

    validateChecksum: () => {
      const state = get();
      if (!state.ecuFile) return;

      const result = state.checksumService.validate(state.ecuFile);

      set((s) => {
        s.checksumStatus = result.valid ? 'valid' : 'invalid';
        if (result.info && s.ecuFile) {
          s.ecuFile.setChecksumInfo(result.info);
        }
      });
    },

    correctChecksum: () => {
      const state = get();
      if (!state.ecuFile) return;

      const result = state.checksumService.correct(state.ecuFile);

      if (result.success) {
        set((s) => {
          s.checksumStatus = 'valid';
        });
      }
    },

    getSelectedMap: () => {
      const state = get();
      if (!state.selectedMapId) return null;
      return state.maps.find((m) => m.id === state.selectedMapId) || null;
    },

    syncMapToBin: (mapId) => {
      const state = get();
      if (!state.ecuFile) return;

      const map = state.maps.find((m) => m.id === mapId);
      if (!map) return;

      state.binMapper.writeMap(state.ecuFile, map);
    },

    setError: (error) => {
      set((state) => {
        state.error = error;
      });
    },
  }))
);
