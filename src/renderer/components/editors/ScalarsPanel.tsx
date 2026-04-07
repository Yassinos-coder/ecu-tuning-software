import React, { useState, useMemo } from 'react';
import { useEcuStore } from '../../store/ecuStore';
import { Scalar } from '../../../core/domain/Scalar';
import { MapCategory } from '../../../core/domain/types';

interface ScalarItemProps {
  scalar: Scalar;
  onValueChange: (id: string, value: number) => void;
}

function ScalarItem({ scalar, onValueChange }: ScalarItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(scalar.value.toString());

  const handleSave = () => {
    const newValue = parseFloat(tempValue);
    if (!isNaN(newValue)) {
      onValueChange(scalar.id, newValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setTempValue(scalar.value.toString());
      setIsEditing(false);
    }
  };

  const getRiskClass = (): string => {
    const title = scalar.title.toLowerCase();
    const value = scalar.value;

    // Rev limiter checks
    if (title.includes('rev') || title.includes('rpm limit')) {
      if (value > 9000) return 'danger';
      if (value > 8000) return 'warning';
      if (value > 7000) return 'caution';
    }

    // Temperature checks
    if (title.includes('temp') || title.includes('fan')) {
      if (value > 110) return 'danger';
      if (value > 100) return 'warning';
    }

    // Boost checks
    if (title.includes('boost') || title.includes('psi')) {
      if (value > 25) return 'danger';
      if (value > 18) return 'warning';
      if (value > 12) return 'caution';
    }

    return '';
  };

  return (
    <div className={`scalar-item ${scalar.isModified ? 'modified' : ''} ${getRiskClass()}`}>
      <div className="scalar-info">
        <span className="scalar-title">{scalar.title}</span>
        {scalar.description && (
          <span className="scalar-description">{scalar.description}</span>
        )}
      </div>

      <div className="scalar-value-container">
        {isEditing ? (
          <input
            type="text"
            className="scalar-input"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <span
            className="scalar-value"
            onClick={() => {
              setTempValue(scalar.value.toString());
              setIsEditing(true);
            }}
          >
            {scalar.value.toFixed(scalar.decimalPlaces)}
          </span>
        )}
        <span className="scalar-units">{scalar.units}</span>
      </div>

      {scalar.isModified && (
        <span className="original-value" title="Original value">
          (was: {scalar.originalValue.toFixed(scalar.decimalPlaces)})
        </span>
      )}
    </div>
  );
}

export function ScalarsPanel() {
  const { scalars, ecuFile, editScalar } = useEcuStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);

  // Common ECU parameter presets
  const quickSettings = [
    { name: 'Rev Limiter', keywords: ['rev', 'rpm limit', 'redline'] },
    { name: 'Speed Limiter', keywords: ['speed limit', 'vmax', 'top speed'] },
    { name: 'Launch Control', keywords: ['launch', 'anti-lag', 'als'] },
    { name: 'Quick Shifter', keywords: ['quick shift', 'cut time', 'shift cut'] },
    { name: 'Fan Control', keywords: ['fan', 'cooling', 'thermo'] },
    { name: 'Idle Speed', keywords: ['idle', 'target rpm'] },
    { name: 'Fuel Pump', keywords: ['fuel pump', 'prime'] },
    { name: 'O2 Sensors', keywords: ['o2', 'lambda', 'oxygen'] },
    { name: 'EGR/Emissions', keywords: ['egr', 'emission', 'cat'] },
  ];

  // Group scalars by category
  const groupedScalars = useMemo(() => {
    const groups: Record<string, Scalar[]> = {};

    let filtered = scalars;

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = scalars.filter(
        (s) =>
          s.title.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.category.toLowerCase().includes(query)
      );
    }

    // Filter by modified only
    if (showModifiedOnly) {
      filtered = filtered.filter((s) => s.isModified);
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      const preset = quickSettings.find((p) => p.name === selectedCategory);
      if (preset) {
        filtered = filtered.filter((s) =>
          preset.keywords.some(
            (kw) =>
              s.title.toLowerCase().includes(kw) ||
              s.description.toLowerCase().includes(kw)
          )
        );
      } else {
        filtered = filtered.filter((s) => s.category === selectedCategory);
      }
    }

    // Group by category
    for (const scalar of filtered) {
      const category = scalar.category || MapCategory.MISC;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(scalar);
    }

    // Sort within groups
    for (const category of Object.keys(groups)) {
      groups[category].sort((a, b) => a.title.localeCompare(b.title));
    }

    return groups;
  }, [scalars, searchQuery, selectedCategory, showModifiedOnly]);

  const handleValueChange = (scalarId: string, newValue: number) => {
    editScalar(scalarId, newValue);
  };

  const categories = Object.keys(groupedScalars).sort();
  const totalModified = scalars.filter((s) => s.isModified).length;

  if (!ecuFile) {
    return (
      <div className="scalars-panel empty">
        <p>Load a BIN file and XDF definition to edit parameters</p>
      </div>
    );
  }

  if (scalars.length === 0) {
    return (
      <div className="scalars-panel empty">
        <p>No scalar parameters found in the XDF definition</p>
        <p className="hint">Make sure your XDF file contains XDFCONSTANT definitions</p>
      </div>
    );
  }

  return (
    <div className="scalars-panel">
      <div className="panel-header">
        <h3>⚙️ ECU Parameters</h3>
        <span className="param-count">{scalars.length} parameters</span>
      </div>

      <div className="panel-toolbar">
        <input
          type="text"
          placeholder="Search parameters..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="category-select"
        >
          <option value="all">All Categories</option>
          <optgroup label="Quick Filters">
            {quickSettings.map((preset) => (
              <option key={preset.name} value={preset.name}>
                {preset.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="XDF Categories">
            {Object.values(MapCategory).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </optgroup>
        </select>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showModifiedOnly}
            onChange={(e) => setShowModifiedOnly(e.target.checked)}
          />
          Modified only
        </label>
      </div>

      {totalModified > 0 && (
        <div className="modified-summary">
          ⚠️ {totalModified} parameter{totalModified > 1 ? 's' : ''} modified
        </div>
      )}

      <div className="scalars-list">
        {categories.length === 0 ? (
          <div className="no-results">No parameters match your search</div>
        ) : (
          categories.map((category) => (
            <div key={category} className="scalar-category">
              <h4 className="category-header">
                {category}
                <span className="category-count">{groupedScalars[category].length}</span>
              </h4>
              <div className="category-items">
                {groupedScalars[category].map((scalar) => (
                  <ScalarItem
                    key={scalar.id}
                    scalar={scalar}
                    onValueChange={handleValueChange}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="panel-footer">
        <div className="legend">
          <span className="legend-item caution">⚠ Caution</span>
          <span className="legend-item warning">⚠ Warning</span>
          <span className="legend-item danger">⛔ Danger</span>
        </div>
      </div>

      <style>{`
        .scalars-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--bg-secondary);
        }

        .scalars-panel.empty {
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          text-align: center;
          padding: 40px;
        }

        .scalars-panel.empty .hint {
          font-size: 12px;
          margin-top: 8px;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .panel-header h3 {
          font-size: 14px;
          font-weight: 600;
          margin: 0;
        }

        .param-count {
          font-size: 12px;
          color: var(--text-muted);
          background-color: var(--bg-tertiary);
          padding: 2px 8px;
          border-radius: 10px;
        }

        .panel-toolbar {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          flex-wrap: wrap;
        }

        .search-input {
          flex: 1;
          min-width: 150px;
          padding: 8px 12px;
          font-size: 13px;
        }

        .category-select {
          padding: 8px 12px;
          font-size: 13px;
          min-width: 140px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-secondary);
          cursor: pointer;
          white-space: nowrap;
        }

        .modified-summary {
          padding: 8px 16px;
          background-color: rgba(234, 179, 8, 0.1);
          color: var(--accent-warning);
          font-size: 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .scalars-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }

        .no-results {
          padding: 32px 16px;
          text-align: center;
          color: var(--text-muted);
        }

        .scalar-category {
          margin-bottom: 8px;
        }

        .category-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--text-secondary);
          background-color: var(--bg-tertiary);
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .category-count {
          font-weight: normal;
          color: var(--text-muted);
        }

        .category-items {
          padding: 4px 0;
        }

        .scalar-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          border-left: 3px solid transparent;
          transition: all var(--transition-fast);
        }

        .scalar-item:hover {
          background-color: var(--bg-hover);
        }

        .scalar-item.modified {
          background-color: rgba(234, 179, 8, 0.05);
          border-left-color: var(--accent-warning);
        }

        .scalar-item.caution {
          border-left-color: var(--accent-warning);
        }

        .scalar-item.warning {
          background-color: rgba(249, 115, 22, 0.1);
          border-left-color: #f97316;
        }

        .scalar-item.danger {
          background-color: rgba(239, 68, 68, 0.1);
          border-left-color: var(--accent-danger);
        }

        .scalar-info {
          flex: 1;
          min-width: 0;
        }

        .scalar-title {
          display: block;
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .scalar-description {
          display: block;
          font-size: 11px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .scalar-value-container {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .scalar-value {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 600;
          padding: 4px 10px;
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          cursor: pointer;
          min-width: 80px;
          text-align: right;
          transition: all var(--transition-fast);
        }

        .scalar-value:hover {
          border-color: var(--accent-primary);
          background-color: var(--bg-hover);
        }

        .scalar-input {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 600;
          padding: 4px 10px;
          width: 100px;
          text-align: right;
        }

        .scalar-units {
          font-size: 11px;
          color: var(--text-muted);
          min-width: 40px;
        }

        .original-value {
          font-size: 11px;
          color: var(--text-muted);
          white-space: nowrap;
        }

        .panel-footer {
          padding: 8px 16px;
          border-top: 1px solid var(--border-color);
          background-color: var(--bg-tertiary);
        }

        .legend {
          display: flex;
          gap: 16px;
          justify-content: center;
          font-size: 11px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .legend-item.caution { color: var(--accent-warning); }
        .legend-item.warning { color: #f97316; }
        .legend-item.danger { color: var(--accent-danger); }
      `}</style>
    </div>
  );
}
