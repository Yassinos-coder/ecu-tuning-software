import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { CalibrationMap } from '../../../core/domain/CalibrationMap';

interface Chart2DProps {
  map: CalibrationMap;
}

export function Chart2D({ map }: Chart2DProps) {
  // Transform map data for Recharts
  const chartData = useMemo(() => {
    // For 2D chart, we'll show each row as a separate line
    const data: Array<Record<string, number>> = [];

    // Use X-axis values if available
    for (let col = 0; col < map.cols; col++) {
      const point: Record<string, number> = {
        x: map.xAxis?.values[col] ?? col,
      };

      for (let row = 0; row < map.rows; row++) {
        point[`row_${row}`] = map.getValue(row, col);
      }

      data.push(point);
    }

    return data;
  }, [map]);

  // Generate colors for each line
  const lineColors = [
    '#4a90d9', '#22c55e', '#f97316', '#ef4444', '#a855f7',
    '#ec4899', '#14b8a6', '#f59e0b', '#6366f1', '#84cc16',
  ];

  // Get Y-axis domain
  const stats = map.getStatistics();
  const yMin = Math.floor(stats.min * 0.95);
  const yMax = Math.ceil(stats.max * 1.05);

  return (
    <div className="chart-2d">
      <div className="chart-header">
        <h3>{map.title}</h3>
        <span className="chart-info">
          {map.xAxis?.title || 'X'} vs {map.units}
        </span>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
            <XAxis
              dataKey="x"
              stroke="#a0a0a0"
              label={{
                value: map.xAxis?.title || 'X Axis',
                position: 'insideBottom',
                offset: -10,
                fill: '#a0a0a0',
              }}
            />
            <YAxis
              stroke="#a0a0a0"
              domain={[yMin, yMax]}
              label={{
                value: map.units,
                angle: -90,
                position: 'insideLeft',
                fill: '#a0a0a0',
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a2e',
                border: '1px solid #2d3748',
                borderRadius: '4px',
              }}
              labelStyle={{ color: '#e8e8e8' }}
              itemStyle={{ color: '#a0a0a0' }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => {
                const rowIndex = parseInt(value.replace('row_', ''), 10);
                const yValue = map.yAxis?.values[rowIndex];
                return yValue !== undefined
                  ? `${map.yAxis?.title || 'Y'}: ${yValue.toFixed(0)}`
                  : value;
              }}
            />

            {Array.from({ length: Math.min(map.rows, 10) }, (_, row) => (
              <Line
                key={row}
                type="monotone"
                dataKey={`row_${row}`}
                stroke={lineColors[row % lineColors.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-stats">
        <div className="stat">
          <span className="stat-label">Min:</span>
          <span className="stat-value">{stats.min.toFixed(map.decimalPlaces)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Max:</span>
          <span className="stat-value">{stats.max.toFixed(map.decimalPlaces)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Avg:</span>
          <span className="stat-value">{stats.avg.toFixed(map.decimalPlaces)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">StdDev:</span>
          <span className="stat-value">{stats.stdDev.toFixed(map.decimalPlaces)}</span>
        </div>
      </div>

      <style>{`
        .chart-2d {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 16px;
          background-color: var(--bg-secondary);
        }

        .chart-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .chart-header h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }

        .chart-info {
          color: var(--text-muted);
          font-size: 13px;
        }

        .chart-container {
          flex: 1;
          min-height: 300px;
        }

        .chart-stats {
          display: flex;
          justify-content: center;
          gap: 32px;
          padding-top: 16px;
          border-top: 1px solid var(--border-color);
          margin-top: 16px;
        }

        .stat {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stat-label {
          color: var(--text-muted);
          font-size: 12px;
        }

        .stat-value {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
