import { v4 as uuid } from 'uuid';
import type { EditActionType, CellChange } from './types';

/**
 * Represents a single edit action for undo/redo
 */
export interface EditAction {
  id: string;
  type: EditActionType;
  mapId: string;
  mapTitle: string;
  timestamp: Date;
  description: string;
  changes: CellChange[];
}

/**
 * Represents a tuning session with edit history
 */
export class Session {
  readonly id: string;
  readonly ecuFileId: string;
  readonly createdAt: Date;
  private _history: EditAction[] = [];
  private _currentIndex: number = -1;
  private _notes: string = '';
  private _maxHistorySize: number = 1000;

  constructor(ecuFileId: string, id?: string) {
    this.id = id || uuid();
    this.ecuFileId = ecuFileId;
    this.createdAt = new Date();
  }

  /**
   * Get all history entries
   */
  get history(): EditAction[] {
    return [...this._history];
  }

  /**
   * Get current history index
   */
  get currentIndex(): number {
    return this._currentIndex;
  }

  /**
   * Get session notes
   */
  get notes(): string {
    return this._notes;
  }

  /**
   * Set session notes
   */
  setNotes(notes: string): void {
    this._notes = notes;
  }

  /**
   * Check if undo is available
   */
  get canUndo(): boolean {
    return this._currentIndex >= 0;
  }

  /**
   * Check if redo is available
   */
  get canRedo(): boolean {
    return this._currentIndex < this._history.length - 1;
  }

  /**
   * Get the number of changes that can be undone
   */
  get undoCount(): number {
    return this._currentIndex + 1;
  }

  /**
   * Get the number of changes that can be redone
   */
  get redoCount(): number {
    return this._history.length - this._currentIndex - 1;
  }

  /**
   * Add an edit action to history
   */
  addAction(
    type: EditActionType,
    mapId: string,
    mapTitle: string,
    changes: CellChange[],
    description?: string
  ): EditAction {
    // Remove any redo history (actions after current index)
    if (this._currentIndex < this._history.length - 1) {
      this._history = this._history.slice(0, this._currentIndex + 1);
    }

    // Create the action
    const action: EditAction = {
      id: uuid(),
      type,
      mapId,
      mapTitle,
      timestamp: new Date(),
      description: description || this.generateDescription(type, changes),
      changes,
    };

    // Add to history
    this._history.push(action);
    this._currentIndex = this._history.length - 1;

    // Trim history if it exceeds max size
    if (this._history.length > this._maxHistorySize) {
      const excess = this._history.length - this._maxHistorySize;
      this._history = this._history.slice(excess);
      this._currentIndex -= excess;
    }

    return action;
  }

  /**
   * Get the action to undo (returns null if nothing to undo)
   */
  getUndoAction(): EditAction | null {
    if (!this.canUndo) {
      return null;
    }
    return this._history[this._currentIndex];
  }

  /**
   * Perform undo (moves history pointer, returns action that was undone)
   */
  undo(): EditAction | null {
    const action = this.getUndoAction();
    if (action) {
      this._currentIndex--;
    }
    return action;
  }

  /**
   * Get the action to redo (returns null if nothing to redo)
   */
  getRedoAction(): EditAction | null {
    if (!this.canRedo) {
      return null;
    }
    return this._history[this._currentIndex + 1];
  }

  /**
   * Perform redo (moves history pointer, returns action that was redone)
   */
  redo(): EditAction | null {
    if (!this.canRedo) {
      return null;
    }
    this._currentIndex++;
    return this._history[this._currentIndex];
  }

  /**
   * Get history for a specific map
   */
  getMapHistory(mapId: string): EditAction[] {
    return this._history.filter(action => action.mapId === mapId);
  }

  /**
   * Get recent actions
   */
  getRecentActions(count: number = 10): EditAction[] {
    const start = Math.max(0, this._currentIndex - count + 1);
    return this._history.slice(start, this._currentIndex + 1).reverse();
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this._history = [];
    this._currentIndex = -1;
  }

  /**
   * Generate a changelog of all modifications
   */
  generateChangelog(): string {
    const lines: string[] = [
      `ECU Tuning Session Changelog`,
      `Session ID: ${this.id}`,
      `Created: ${this.createdAt.toISOString()}`,
      `Total modifications: ${this._history.length}`,
      '',
      '--- Changes ---',
      '',
    ];

    // Group changes by map
    const changesByMap = new Map<string, EditAction[]>();
    for (const action of this._history) {
      const existing = changesByMap.get(action.mapTitle) || [];
      existing.push(action);
      changesByMap.set(action.mapTitle, existing);
    }

    for (const [mapTitle, actions] of changesByMap) {
      lines.push(`## ${mapTitle}`);
      lines.push(`   ${actions.length} modification(s)`);

      for (const action of actions.slice(-5)) { // Show last 5 per map
        lines.push(`   - ${action.timestamp.toLocaleTimeString()}: ${action.description}`);
      }
      lines.push('');
    }

    if (this._notes) {
      lines.push('--- Notes ---');
      lines.push(this._notes);
    }

    return lines.join('\n');
  }

  /**
   * Export session data for saving
   */
  exportData(): {
    id: string;
    ecuFileId: string;
    createdAt: string;
    history: EditAction[];
    currentIndex: number;
    notes: string;
  } {
    return {
      id: this.id,
      ecuFileId: this.ecuFileId,
      createdAt: this.createdAt.toISOString(),
      history: this._history,
      currentIndex: this._currentIndex,
      notes: this._notes,
    };
  }

  /**
   * Import session data
   */
  static fromData(data: {
    id: string;
    ecuFileId: string;
    createdAt: string;
    history: EditAction[];
    currentIndex: number;
    notes: string;
  }): Session {
    const session = new Session(data.ecuFileId, data.id);
    session._history = data.history;
    session._currentIndex = data.currentIndex;
    session._notes = data.notes;
    return session;
  }

  /**
   * Generate description for an action
   */
  private generateDescription(type: EditActionType, changes: CellChange[]): string {
    const count = changes.length;

    switch (type) {
      case 'cell':
        if (count === 1) {
          const c = changes[0];
          return `Changed cell (${c.row},${c.col}) from ${c.oldValue.toFixed(2)} to ${c.newValue.toFixed(2)}`;
        }
        return `Changed ${count} cells`;

      case 'range':
        return `Modified range of ${count} cells`;

      case 'bulk':
        return `Bulk edit of ${count} cells`;

      case 'paste':
        return `Pasted ${count} cells`;

      case 'fill':
        return `Filled ${count} cells`;

      case 'interpolate':
        return `Interpolated ${count} cells`;

      case 'percentage':
        return `Percentage change on ${count} cells`;

      case 'smooth':
        return `Smoothed ${count} cells`;

      default:
        return `Modified ${count} cells`;
    }
  }
}
