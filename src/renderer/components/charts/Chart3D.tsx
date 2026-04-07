import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { CalibrationMap } from '../../../core/domain/CalibrationMap';

interface Chart3DProps {
  map: CalibrationMap;
}

export function Chart3D({ map }: Chart3DProps) {
  const stats = map.getStatistics();

  return (
    <div className="chart-3d">
      <div className="chart-header">
        <h3>{map.title}</h3>
        <span className="chart-info">
          3D Surface View | {map.rows}×{map.cols} | {map.units}
        </span>
      </div>

      <div className="chart-container">
        <Canvas
          camera={{ position: [10, 8, 10], fov: 50 }}
          style={{ background: '#1a1a2e' }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <pointLight position={[-10, -10, -5]} intensity={0.5} />

          <Surface map={map} />

          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={50}
          />

          <Grid
            args={[20, 20]}
            position={[0, -0.01, 0]}
            cellColor="#2d3748"
            sectionColor="#3d4758"
            fadeDistance={50}
          />

          {/* Axis labels */}
          <Text
            position={[6, -1, 0]}
            fontSize={0.5}
            color="#a0a0a0"
            anchorX="center"
          >
            {map.xAxis?.title || 'X'}
          </Text>
          <Text
            position={[0, -1, 6]}
            fontSize={0.5}
            color="#a0a0a0"
            anchorX="center"
            rotation={[0, Math.PI / 2, 0]}
          >
            {map.yAxis?.title || 'Y'}
          </Text>
          <Text
            position={[-6, 3, 0]}
            fontSize={0.5}
            color="#a0a0a0"
            anchorX="center"
            rotation={[0, 0, Math.PI / 2]}
          >
            {map.units}
          </Text>
        </Canvas>
      </div>

      <div className="chart-legend">
        <div className="legend-bar">
          <div
            className="legend-gradient"
            style={{
              background: 'linear-gradient(to right, #3b82f6, #22c55e, #eab308, #ef4444)',
            }}
          />
        </div>
        <div className="legend-labels">
          <span>{stats.min.toFixed(map.decimalPlaces)}</span>
          <span>{((stats.min + stats.max) / 2).toFixed(map.decimalPlaces)}</span>
          <span>{stats.max.toFixed(map.decimalPlaces)}</span>
        </div>
      </div>

      <div className="chart-controls">
        <span className="control-hint">🖱️ Drag to rotate | Scroll to zoom | Right-click to pan</span>
      </div>

      <style>{`
        .chart-3d {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--bg-secondary);
        }

        .chart-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid var(--border-color);
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
          min-height: 400px;
        }

        .chart-legend {
          padding: 12px 16px;
          border-top: 1px solid var(--border-color);
        }

        .legend-bar {
          height: 12px;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 4px;
        }

        .legend-gradient {
          height: 100%;
          width: 100%;
        }

        .legend-labels {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .chart-controls {
          padding: 8px 16px;
          background-color: var(--bg-tertiary);
          text-align: center;
        }

        .control-hint {
          font-size: 11px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}

interface SurfaceProps {
  map: CalibrationMap;
}

function Surface({ map }: SurfaceProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, material } = useMemo(() => {
    const rows = map.rows;
    const cols = map.cols;
    const values = map.values;
    const stats = map.getStatistics();

    // Create geometry
    const geo = new THREE.PlaneGeometry(10, 10, cols - 1, rows - 1);

    // Modify vertices based on map values
    const positions = geo.attributes.position;
    const colors: number[] = [];

    const valueRange = stats.max - stats.min || 1;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      // Map x,z to row,col indices
      const col = Math.round(((x + 5) / 10) * (cols - 1));
      const row = Math.round(((z + 5) / 10) * (rows - 1));

      const clampedRow = Math.max(0, Math.min(rows - 1, row));
      const clampedCol = Math.max(0, Math.min(cols - 1, col));

      const value = values[clampedRow]?.[clampedCol] ?? 0;

      // Normalize value to 0-1 range for height
      const normalizedValue = (value - stats.min) / valueRange;
      const height = normalizedValue * 4; // Scale height

      positions.setY(i, height);

      // Color based on value
      const color = getValueColor(normalizedValue);
      colors.push(color.r, color.g, color.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    // Create material
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      flatShading: false,
      metalness: 0.1,
      roughness: 0.7,
    });

    return { geometry: geo, material: mat };
  }, [map]);

  // Optional: subtle animation
  useFrame((state) => {
    if (meshRef.current) {
      // Very subtle hover effect
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.02;
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
    />
  );
}

/**
 * Get color for a normalized value (0-1)
 */
function getValueColor(value: number): THREE.Color {
  // Blue -> Green -> Yellow -> Red gradient
  const color = new THREE.Color();

  if (value < 0.33) {
    // Blue to Green
    const t = value / 0.33;
    color.setRGB(
      0.23 * (1 - t) + 0.13 * t,
      0.51 * (1 - t) + 0.77 * t,
      0.96 * (1 - t) + 0.35 * t
    );
  } else if (value < 0.66) {
    // Green to Yellow
    const t = (value - 0.33) / 0.33;
    color.setRGB(
      0.13 * (1 - t) + 0.92 * t,
      0.77 * (1 - t) + 0.70 * t,
      0.35 * (1 - t) + 0.03 * t
    );
  } else {
    // Yellow to Red
    const t = (value - 0.66) / 0.34;
    color.setRGB(
      0.92 * (1 - t) + 0.94 * t,
      0.70 * (1 - t) + 0.27 * t,
      0.03 * (1 - t) + 0.27 * t
    );
  }

  return color;
}
