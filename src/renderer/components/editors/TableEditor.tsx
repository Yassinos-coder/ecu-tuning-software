import React, { useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, CellValueChangedEvent, CellClassParams, GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { CalibrationMap } from '../../../core/domain/CalibrationMap';
import { useEcuStore } from '../../store/ecuStore';
import { useUiStore } from '../../store/uiStore';
import { RiskLevel } from '../../../shared/constants/safetyLimits';

interface TableEditorProps {
  map: CalibrationMap;
}

interface TableRow {
  rowIndex: number;
  rowHeader: number | string;
  [key: string]: number | string;
}

export function TableEditor({ map }: TableEditorProps) {
  const gridRef = useRef<AgGridReact<TableRow>>(null);
  const { editCell, applyPercentageChange, interpolateRange, smoothRange, selectRange } = useEcuStore();
  const { highlightModified, showRiskColors } = useUiStore();

  // Build column definitions
  const columnDefs = useMemo((): ColDef<TableRow>[] => {
    const cols: ColDef<TableRow>[] = [];

    // Row header column (Y-axis values)
    if (map.yAxis && map.yAxis.values.length > 0) {
      cols.push({
        headerName: map.yAxis.title || 'Y',
        field: 'rowHeader',
        pinned: 'left',
        width: 100,
        editable: false,
        cellClass: 'axis-cell',
        valueFormatter: (params) => {
          const value = params.value;
          return typeof value === 'number' ? value.toFixed(map.yAxis?.units ? 1 : 0) : value;
        },
      });
    }

    // Data columns (X-axis)
    for (let col = 0; col < map.cols; col++) {
      const xValue = map.xAxis?.values[col];
      const headerName = xValue !== undefined ? xValue.toFixed(map.xAxis?.units ? 0 : 0) : `Col ${col}`;

      cols.push({
        headerName: headerName.toString(),
        field: `col${col}`,
        width: 80,
        editable: true,
        cellClass: (params: CellClassParams) => getCellClass(params, col),
        valueFormatter: (params) => {
          if (typeof params.value === 'number') {
            return params.value.toFixed(map.decimalPlaces);
          }
          return params.value;
        },
        valueParser: (params) => {
          const newValue = parseFloat(params.newValue);
          return isNaN(newValue) ? params.oldValue : newValue;
        },
      });
    }

    return cols;
  }, [map, highlightModified, showRiskColors]);

  // Build row data
  const rowData = useMemo(() => {
    const rows: TableRow[] = [];

    for (let row = 0; row < map.rows; row++) {
      const rowObj: TableRow = {
        rowIndex: row,
        rowHeader: map.yAxis?.values[row] ?? row,
      };

      for (let col = 0; col < map.cols; col++) {
        rowObj[`col${col}`] = map.getValue(row, col);
      }

      rows.push(rowObj);
    }

    return rows;
  }, [map]);

  // Get cell class based on modification status and risk level
  const getCellClass = useCallback(
    (params: CellClassParams, col: number): string[] => {
      const classes: string[] = ['data-cell'];
      const row = params.data?.rowIndex;

      if (row === undefined) return classes;

      // Check if modified
      if (highlightModified && map.isCellModified(row, col)) {
        classes.push('cell-modified');
      }

      // Check risk level
      if (showRiskColors) {
        const riskLevel = map.getCellRiskLevel(row, col);
        if (riskLevel !== RiskLevel.SAFE) {
          classes.push(`cell-${riskLevel}`);
        }
      }

      return classes;
    },
    [map, highlightModified, showRiskColors]
  );

  // Handle cell value change
  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent) => {
      const row = event.data.rowIndex;
      const colField = event.colDef.field;
      if (!colField?.startsWith('col')) return;

      const col = parseInt(colField.replace('col', ''), 10);
      const newValue = parseFloat(event.newValue);

      if (!isNaN(newValue) && newValue !== event.oldValue) {
        editCell(map.id, row, col, newValue);
      }
    },
    [map.id, editCell]
  );

  // Handle range selection
  const onRangeSelectionChanged = useCallback(() => {
    const grid = gridRef.current?.api;
    if (!grid) return;

    const ranges = grid.getCellRanges();
    if (!ranges || ranges.length === 0) {
      selectRange(null);
      return;
    }

    const range = ranges[0];
    const startRow = Math.min(range.startRow?.rowIndex ?? 0, range.endRow?.rowIndex ?? 0);
    const endRow = Math.max(range.startRow?.rowIndex ?? 0, range.endRow?.rowIndex ?? 0);

    const columns = range.columns.map((col) => col.getColId());
    const colIndices = columns
      .filter((c) => c.startsWith('col'))
      .map((c) => parseInt(c.replace('col', ''), 10));

    if (colIndices.length > 0) {
      selectRange({
        startRow,
        startCol: Math.min(...colIndices),
        endRow,
        endCol: Math.max(...colIndices),
      });
    }
  }, [selectRange]);

  // Toolbar handlers
  const handlePercentageChange = (percentage: number) => {
    const { selectedRange } = useEcuStore.getState();
    if (selectedRange) {
      applyPercentageChange(map.id, selectedRange, percentage);
      gridRef.current?.api?.refreshCells();
    }
  };

  const handleInterpolate = () => {
    const { selectedRange } = useEcuStore.getState();
    if (selectedRange) {
      interpolateRange(map.id, selectedRange);
      gridRef.current?.api?.refreshCells();
    }
  };

  const handleSmooth = () => {
    const { selectedRange } = useEcuStore.getState();
    if (selectedRange) {
      smoothRange(map.id, selectedRange, 0.5);
      gridRef.current?.api?.refreshCells();
    }
  };

  const onGridReady = (params: GridReadyEvent) => {
    params.api.sizeColumnsToFit();
  };

  return (
    <div className="table-editor">
      <div className="editor-toolbar">
        <div className="toolbar-section">
          <span className="map-title">{map.title}</span>
          <span className="map-info">
            {map.rows}×{map.cols} | {map.units}
          </span>
        </div>

        <div className="toolbar-section">
          <button className="edit-btn" onClick={() => handlePercentageChange(-5)}>
            -5%
          </button>
          <button className="edit-btn" onClick={() => handlePercentageChange(-1)}>
            -1%
          </button>
          <button className="edit-btn" onClick={() => handlePercentageChange(1)}>
            +1%
          </button>
          <button className="edit-btn" onClick={() => handlePercentageChange(5)}>
            +5%
          </button>
          <div className="btn-divider" />
          <button className="edit-btn" onClick={handleInterpolate} title="Interpolate selection">
            🔀 Interp
          </button>
          <button className="edit-btn" onClick={handleSmooth} title="Smooth selection">
            🌊 Smooth
          </button>
        </div>

        <div className="toolbar-section">
          {map.isModified && (
            <span className="modified-badge">
              {map.getModifiedCells().length} cells modified
            </span>
          )}
        </div>
      </div>

      <div className="grid-container ag-theme-alpine-dark">
        <AgGridReact
          ref={gridRef}
          columnDefs={columnDefs}
          rowData={rowData}
          onCellValueChanged={onCellValueChanged}
          onRangeSelectionChanged={onRangeSelectionChanged}
          onGridReady={onGridReady}
          enableRangeSelection={true}
          suppressRowClickSelection={true}
          rowSelection="multiple"
          getRowId={(params) => String(params.data.rowIndex)}
          defaultColDef={{
            resizable: true,
            sortable: false,
            filter: false,
          }}
        />
      </div>

      <style>{`
        .table-editor {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .editor-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          gap: 16px;
        }

        .toolbar-section {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .map-title {
          font-weight: 600;
          font-size: 14px;
        }

        .map-info {
          color: var(--text-muted);
          font-size: 12px;
        }

        .edit-btn {
          padding: 4px 10px;
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          font-size: 12px;
          transition: all var(--transition-fast);
        }

        .edit-btn:hover {
          background-color: var(--bg-hover);
          border-color: var(--border-light);
        }

        .btn-divider {
          width: 1px;
          height: 20px;
          background-color: var(--border-color);
          margin: 0 4px;
        }

        .modified-badge {
          padding: 4px 8px;
          background-color: rgba(234, 179, 8, 0.2);
          color: var(--accent-warning);
          border-radius: 4px;
          font-size: 12px;
        }

        .grid-container {
          flex: 1;
          overflow: hidden;
        }

        .axis-cell {
          background-color: var(--bg-tertiary) !important;
          font-weight: 500;
        }

        .data-cell {
          font-family: var(--font-mono);
          text-align: right;
        }
      `}</style>
    </div>
  );
}
