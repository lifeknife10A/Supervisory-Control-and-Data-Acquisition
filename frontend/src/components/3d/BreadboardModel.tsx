import React, { useMemo, useState, useRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { WorkbenchComponent, PinDefinition } from '../../types/workbench';
import { useWorkbenchStore } from '../../store/workbenchStore';

interface BreadboardModelProps {
  component: WorkbenchComponent;
  isSelected: boolean;
  onPointerDown: (e: any) => void;
}

// Generate an ultra-high-resolution procedural breadboard texture with all tie points, rails, and silk-screen markings
function createBreadboardTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1100;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Base ivory / off-white breadboard plastic body
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  // Subtle beveled border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  // 2. Center DIP divider trough (trench between rows e and f)
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(80, 520, width - 160, 60);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(80, 546, width - 160, 8);

  // Helper function to draw a single socket tie-point hole
  const drawSocketHole = (x: number, y: number, isPower = false) => {
    const size = isPower ? 18 : 16;
    // Outer shadow rim
    ctx.fillStyle = '#334155';
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    // Inner dark cavity
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - (size - 4) / 2, y - (size - 4) / 2, size - 4, size - 4);
    // Metallic spring contact glint
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x - 2, y - 2, 4, 4);
  };

  // 3. Top Power Rails (+ and -)
  // Red (+) line
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(120, 100);
  ctx.lineTo(width - 120, 100);
  ctx.stroke();

  // Blue (-) line
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(120, 180);
  ctx.lineTo(width - 120, 180);
  ctx.stroke();

  // Rail labels (+ and -)
  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('+', 85, 110);
  ctx.fillText('+', width - 105, 110);

  ctx.fillStyle = '#2563eb';
  ctx.fillText('—', 85, 188);
  ctx.fillText('—', width - 105, 188);

  // Top power rail holes (30 columns in 5 groups of 5 with gaps)
  const xStart = 150;
  const xSpacing = 58;

  for (let col = 0; col < 30; col++) {
    const x = xStart + col * xSpacing;
    drawSocketHole(x, 100, true); // VCC (+)
    drawSocketHole(x, 180, true); // GND (-)
  }

  // 4. Middle Terminal Columns: rows 1 to 30, columns a-e and f-j
  // Row numbers (top and bottom)
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';

  for (let col = 0; col < 30; col++) {
    const x = xStart + col * xSpacing;
    const num = col + 1;
    // Show numbers on 1, 5, 10, 15, 20, 25, 30
    if (num === 1 || num % 5 === 0) {
      ctx.fillText(num.toString(), x, 235);
      ctx.fillText(num.toString(), x, 895);
    }
  }

  // Column letters (a, b, c, d, e)
  const lettersTop = ['a', 'b', 'c', 'd', 'e'];
  const yTopRows = [270, 320, 370, 420, 470];
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#64748b';

  for (let r = 0; r < 5; r++) {
    ctx.fillText(lettersTop[r], 105, yTopRows[r] + 6);
    ctx.fillText(lettersTop[r], width - 105, yTopRows[r] + 6);
    for (let col = 0; col < 30; col++) {
      const x = xStart + col * xSpacing;
      drawSocketHole(x, yTopRows[r]);
    }
  }

  // Column letters (f, g, h, i, j)
  const lettersBot = ['f', 'g', 'h', 'i', 'j'];
  const yBotRows = [630, 680, 730, 780, 830];

  for (let r = 0; r < 5; r++) {
    ctx.fillText(lettersBot[r], 105, yBotRows[r] + 6);
    ctx.fillText(lettersBot[r], width - 105, yBotRows[r] + 6);
    for (let col = 0; col < 30; col++) {
      const x = xStart + col * xSpacing;
      drawSocketHole(x, yBotRows[r]);
    }
  }

  // 5. Bottom Power Rails (+ and -)
  // Blue (-) line
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(120, 935);
  ctx.lineTo(width - 120, 935);
  ctx.stroke();

  // Red (+) line
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(120, 1015);
  ctx.lineTo(width - 120, 1015);
  ctx.stroke();

  // Bottom Rail labels
  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = '#2563eb';
  ctx.fillText('—', 85, 943);
  ctx.fillText('—', width - 105, 943);

  ctx.fillStyle = '#ef4444';
  ctx.fillText('+', 85, 1025);
  ctx.fillText('+', width - 105, 1025);

  for (let col = 0; col < 30; col++) {
    const x = xStart + col * xSpacing;
    drawSocketHole(x, 935, true);  // GND (-)
    drawSocketHole(x, 1015, true); // VCC (+)
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export const BreadboardModel: React.FC<BreadboardModelProps> = ({
  component,
  isSelected,
  onPointerDown,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useMemo(() => createBreadboardTexture(), []);
  const [hoveredPin, setHoveredPin] = useState<PinDefinition | null>(null);

  const activeDraft = useWorkbenchStore((s) => s.activeDraft);
  const startWireDraft = useWorkbenchStore((s) => s.startWireDraft);
  const completeWireDraft = useWorkbenchStore((s) => s.completeWireDraft);

  // Standard breadboard dimensions in 3D workbench coordinates
  const bbLength = 2.4; // along X
  const bbWidth = 1.3;  // along Z
  const bbHeight = 0.1; // along Y

  const handlePinClick = (e: any, pin: PinDefinition) => {
    e.stopPropagation();
    if (!activeDraft) {
      startWireDraft(component.id, pin.id);
    } else {
      completeWireDraft(component.id, pin.id);
    }
  };

  // Find draft source pin if wire was started on this breadboard
  const draftSourcePin =
    activeDraft?.fromComponentId === component.id
      ? component.pins.find((p) => p.id === activeDraft.fromPinId)
      : null;

  // Find closest pin at specific world coordinate
  const findClosestPinAtPoint = (point: THREE.Vector3, threshold = 0.08) => {
    if (!groupRef.current) return null;
    const local = groupRef.current.worldToLocal(point.clone());
    let closest: PinDefinition | null = null;
    let minDistSq = threshold * threshold;
    const pins = component.pins;
    for (let i = 0; i < pins.length; i++) {
      const p = pins[i];
      const dx = p.relativePosition[0] - local.x;
      const dz = p.relativePosition[2] - local.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        closest = p;
      }
    }
    return closest;
  };

  // Real-time spatial tracking across all 420 breadboard nodes
  const handlePlanePointerMove = (e: any) => {
    e.stopPropagation();
    const closest = findClosestPinAtPoint(e.point, 0.055);
    if (closest?.id !== hoveredPin?.id) {
      setHoveredPin(closest);
    }
  };

  const handlePlanePointerOut = () => {
    setHoveredPin(null);
  };

  const handlePlanePointerDown = (e: any) => {
    e.stopPropagation();
    const pin = hoveredPin || findClosestPinAtPoint(e.point, 0.08);
    if (pin && (activeDraft || e.button === 0)) {
      handlePinClick(e, pin);
      return;
    }
    if (activeDraft) return; // Never drag breadboard in wiring mode!
    onPointerDown(e);
  };

  return (
    <group ref={groupRef}>
      {/* Main Solid Breadboard Chassis with Beveled Appearance */}
      <mesh
        position={[0, bbHeight / 2, 0]}
        castShadow
        receiveShadow
        onPointerDown={(e) => {
          if (activeDraft) {
            e.stopPropagation();
            return;
          }
          onPointerDown(e);
        }}
      >
        <boxGeometry args={[bbLength, bbHeight, bbWidth]} />
        <meshStandardMaterial
          color="#f8fafc"
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>

      {/* Top Face with High-Resolution Silk-Screened Sockets & Interactive Node Tracking */}
      <mesh
        position={[0, bbHeight + 0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerDown={handlePlanePointerDown}
        onPointerMove={handlePlanePointerMove}
        onPointerOut={handlePlanePointerOut}
      >
        <planeGeometry args={[bbLength - 0.04, bbWidth - 0.04]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.3}
          metalness={0.05}
        />
      </mesh>

      {/* Selection Bounding Halo - Raycast null so it never blocks tie-point clicks */}
      {isSelected && (
        <mesh position={[0, bbHeight / 2, 0]} raycast={() => null}>
          <boxGeometry args={[bbLength + 0.08, bbHeight + 0.04, bbWidth + 0.08]} />
          <meshBasicMaterial
            color="#0284c7"
            wireframe
            transparent
            opacity={0.7}
          />
        </mesh>
      )}

      {/* Active Wire Draft Source Indicator (Only shows on the single socket where wire drafting began) */}
      {draftSourcePin && (
        <mesh
          position={[draftSourcePin.relativePosition[0], bbHeight + 0.003, draftSourcePin.relativePosition[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <ringGeometry args={[0.015, 0.03, 24]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Hovered Pin Snap Highlight - ZERO spheres, ONLY a subtle snap ring on the hovered socket hole */}
      {hoveredPin && (
        <group position={[hoveredPin.relativePosition[0], bbHeight + 0.003, hoveredPin.relativePosition[2]]}>
          {/* Subtle Snap Ring on the socket */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <ringGeometry args={[0.014, 0.028, 24]} />
            <meshBasicMaterial
              color={activeDraft ? '#10b981' : '#0ea5e9'}
              transparent
              opacity={0.9}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Clean Floating Tooltip */}
          <Html position={[0, 0.08, 0]} center>
            <div className="bg-slate-900/95 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-xl border border-sky-400 whitespace-nowrap pointer-events-none flex items-center space-x-1.5 select-none">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{
                  backgroundColor:
                    hoveredPin.type === 'POWER_VCC'
                      ? '#ef4444'
                      : hoveredPin.type === 'GROUND'
                      ? '#1e293b'
                      : '#0ea5e9',
                }}
              />
              <span className="text-sky-300">{hoveredPin.name}</span>
            </div>
          </Html>
        </group>
      )}
    </group>
  );
};
