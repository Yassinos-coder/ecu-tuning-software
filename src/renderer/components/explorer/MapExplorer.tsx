import React, { useMemo } from 'react';
import { useEcuStore } from '../../store/ecuStore';
import { useUiStore } from '../../store/uiStore';
import { CalibrationMap } from '../../../core/domain/CalibrationMap';
import { MapCategory } from '../../../core/domain/types';

export function MapExplorer() {
  const { maps, selectedMapId, selectMap } = useEcuStore();
  const { expandedCategories, toggleCategory, searchQuery, setSearchQuery, showModifiedOnly } = useUiStore();

  // Group maps by category
  const groupedMaps = useMemo(() => {
    const groups: Record<string, CalibrationMap[]> = {};

    let filteredMaps = maps;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredMaps = maps.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          m.category.toLowerCase().includes(query) ||
          m.description.toLowerCase().includes(query)
      );
    }

    // Filter by modified only
    if (showModifiedOnly) {
      filteredMaps = filteredMaps.filter((m) => m.isModified);
    }

    // Group by category
    for (const map of filteredMaps) {
      const category = map.category || MapCategory.MISC;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(map);
    }

    // Sort maps within each category
    for (const category of Object.keys(groups)) {
      groups[category].sort((a, b) => a.title.localeCompare(b.title));
    }

    return groups;
  }, [maps, searchQuery, showModifiedOnly]);

  const categories = Object.keys(groupedMaps).sort();

  return (
    <div className="map-explorer">
      <div className="explorer-header">
        <h3>Maps</h3>
        <span className="map-count">{maps.length}</span>
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search maps..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button
            className="search-clear"
            onClick={() => setSearchQuery('')}
          >
            ×
          </button>
        )}
      </div>

      <div className="explorer-options">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showModifiedOnly}
            onChange={(e) =>
              useUiStore.getState().setShowModifiedOnly(e.target.checked)
            }
          />
          Show modified only
        </label>
      </div>

      <div className="map-tree">
        {categories.length === 0 ? (
          <div className="no-maps">
            {maps.length === 0
              ? 'Load an XDF file to see maps'
              : 'No maps match your search'}
          </div>
        ) : (
          categories.map((category) => (
            <div key={category} className="category-group">
              <button
                className="category-header"
                onClick={() => toggleCategory(category)}
              >
                <span className="expand-icon">
                  {expandedCategories.includes(category) ? '▼' : '▶'}
                </span>
                <span className="category-name">{category}</span>
                <span className="category-count">
                  {groupedMaps[category].length}
                </span>
              </button>

              {expandedCategories.includes(category) && (
                <div className="category-maps">
                  {groupedMaps[category].map((map) => (
                    <button
                      key={map.id}
                      className={`map-item ${selectedMapId === map.id ? 'selected' : ''} ${map.isModified ? 'modified' : ''}`}
                      onClick={() => selectMap(map.id)}
                    >
                      <span className="map-icon">
                        {map.rows > 1 && map.cols > 1 ? '📊' : '📈'}
                      </span>
                      <span className="map-title">{map.title}</span>
                      {map.isModified && (
                        <span className="modified-indicator">●</span>
                      )}
                      <span className="map-size">
                        {map.rows}×{map.cols}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <style>{`
        .map-explorer {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .explorer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .explorer-header h3 {
          font-size: 14px;
          font-weight: 600;
          margin: 0;
        }

        .map-count {
          background-color: var(--bg-tertiary);
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .search-box {
          padding: 8px 12px;
          position: relative;
        }

        .search-input {
          width: 100%;
          padding: 8px 28px 8px 12px;
          font-size: 13px;
        }

        .search-clear {
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-size: 16px;
          color: var(--text-muted);
        }

        .search-clear:hover {
          background-color: var(--bg-hover);
        }

        .explorer-options {
          padding: 4px 16px 8px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary);
          cursor: pointer;
        }

        .checkbox-label input {
          cursor: pointer;
        }

        .map-tree {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }

        .no-maps {
          padding: 16px;
          text-align: center;
          color: var(--text-muted);
          font-size: 13px;
        }

        .category-group {
          margin-bottom: 4px;
        }

        .category-header {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          text-align: left;
          font-size: 13px;
          font-weight: 500;
          transition: background-color var(--transition-fast);
        }

        .category-header:hover {
          background-color: var(--bg-hover);
        }

        .expand-icon {
          font-size: 10px;
          color: var(--text-muted);
          width: 12px;
        }

        .category-name {
          flex: 1;
        }

        .category-count {
          color: var(--text-muted);
          font-size: 12px;
          font-weight: normal;
        }

        .category-maps {
          padding-left: 12px;
        }

        .map-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          text-align: left;
          font-size: 12px;
          transition: background-color var(--transition-fast);
          border-left: 2px solid transparent;
        }

        .map-item:hover {
          background-color: var(--bg-hover);
        }

        .map-item.selected {
          background-color: var(--bg-selected);
          border-left-color: var(--accent-primary);
        }

        .map-item.modified {
          color: var(--accent-warning);
        }

        .map-icon {
          font-size: 14px;
        }

        .map-title {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .modified-indicator {
          color: var(--accent-warning);
          font-size: 10px;
        }

        .map-size {
          color: var(--text-muted);
          font-size: 11px;
          font-family: var(--font-mono);
        }
      `}</style>
    </div>
  );
}
