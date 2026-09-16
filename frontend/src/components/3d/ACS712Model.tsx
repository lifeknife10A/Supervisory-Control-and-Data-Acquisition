import React, { useState, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { WorkbenchComponent, PinDefinition } from '../../types/workbench';
import { useWorkbenchStore } from '../../store/workbenchStore';

interface ACS712ModelProps {
  component: WorkbenchComponent;
  isSelected: boolean;
  onPointerDown: (e: any) => void;
}

/**
 * Procedurally generates the high-definition ACS712 Hall Effect Current Sensor PCB texture
 * with dark royal blue soldermask, copper traces, Allegro branding, pinout tables, and specs.
 */
function createACS712PCBTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 768;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Industrial Dark Royal Blue / Purple Soldermask Base
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, 0, width, height);

  // Copper pour hatch pattern
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.lineTo(Math.random() * width, Math.random() * height);
    ctx.stroke();
  }

  // 2. White Silkscreen Outer Border & Mounting Holes
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  // 4 Corner Mounting Holes (Silver Solder Wash + Annular Rings)
  const holes = [
    [56, 56],
    [width - 56, 56],
    [56, height - 56],
    [width - 56, height - 56],
  ];
  holes.forEach(([hx, hy]) => {
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(hx, hy, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(hx, hy, 14, 0, Math.PI * 2);
    ctx.fill();
  });

  // 3. Module Header & Ratings
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '900 36px "Inter", sans-serif';
  ctx.fillText('ALLEGRO ACS712', width / 2, 75);

  ctx.font = 'bold 22px "SF Mono", monospace';
  ctx.fillStyle = '#93c5fd';
  ctx.fillText('CURRENT SENSOR MODULE (20A RANGE)', width / 2, 110);

  // 4. Left Side: High Current Input Silkscreen (IP+ and IP-)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 34px "SF Mono", monospace';
  ctx.fillText('IP+', 70, 310);
  ctx.fillText('IP-', 70, 520);

  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#f87171';
  ctx.fillText('LOAD IN', 70, 345);
  ctx.fillText('LOAD OUT', 70, 555);

  // Terminal block outline box
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 3;
  ctx.strokeRect(50, 200, 240, 420);

  // 5. Right Side: Logic Interface Silkscreen (VCC, OUT, GND)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 34px "SF Mono", monospace';
  ctx.fillText('VCC', width - 70, 270);
  ctx.fillText('OUT', width - 70, 415);
  ctx.fillText('GND', width - 70, 560);

  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('+5V', width - 70, 305);
  ctx.fillText('ANALOG', width - 70, 450);
  ctx.fillText('0V', width - 70, 595);

  // 3-Pin Header Box
  ctx.strokeRect(width - 290, 200, 240, 420);

  // 6. Central Chip Marking Box (Allegro SOIC-8)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(360, 310, 304, 210);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "SF Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ACS712ELCTR-20A', width / 2, 400);
  ctx.font = '16px "SF Mono", monospace';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('66 mV / Ampere', width / 2, 435);

  // Power LED silkscreen
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('PWR', width / 2, 600);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 16;
  return tex;
}

export const ACS712Model: React.FC<ACS712ModelProps> = ({
  component,
  isSelected,
  onPointerDown,
}) => {
  const [hoveredPin, setHoveredPin] = useState<PinDefinition | null>(null);
  const activeDraft = useWorkbenchStore((s) => s.activeDraft);
  const startWireDraft = useWorkbenchStore((s) => s.startWireDraft);
  const completeWireDraft = useWorkbenchStore((s) => s.completeWireDraft);

  const pcbWidth = 0.36;   // along X
  const pcbDepth = 0.28;   // along Z
  const pcbHeight = 0.02;  // along Y

  const pcbTexture = useMemo(() => createACS712PCBTexture(), []);

  const handlePinClick = (e: any, pin: PinDefinition) => {
    e.stopPropagation();
    if (!activeDraft) {
      startWireDraft(component.id, pin.id);
    } else {
      completeWireDraft(component.id, pin.id);
    }
  };

  return (
    <group onPointerDown={onPointerDown}>
      {/* 1. Main Dark Blue FR4 PCB */}
      <mesh position={[0, pcbHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[pcbWidth, pcbHeight, pcbDepth]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.35} metalness={0.15} />
      </mesh>

      {/* Top PCB Silkscreen Surface */}
      <mesh position={[0, pcbHeight + 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[pcbWidth, pcbDepth]} />
        <meshStandardMaterial map={pcbTexture} roughness={0.35} metalness={0.15} />
      </mesh>

      {/* Bottom PCB Surface */}
      <mesh position={[0, -0.0005, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[pcbWidth, pcbDepth]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.35} metalness={0.15} />
      </mesh>

      {/* 2. Blue 2-Position Phoenix Screw Terminal Block on Input Side (IP+ / IP-) */}
      {/* Terminal Block Body centered at X = -0.08 */}
      <group position={[-0.08, pcbHeight + 0.032, 0]}>
        {/* Blue Plastic Housing */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.085, 0.065, 0.16]} />
          <meshStandardMaterial color="#0284c7" roughness={0.35} metalness={0.2} />
        </mesh>

        {/* Top Wire Clamping Screw Wells */}
        {[0.05, -0.05].map((pz, idx) => (
          <group key={idx} position={[0, 0.033, pz]}>
            {/* Circular well */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.008, 16]} />
              <meshStandardMaterial color="#0f172a" roughness={0.6} />
            </mesh>
            {/* Clamping Screw Head */}
            <mesh position={[0, -0.002, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.006, 16]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Screw Cross Slot */}
            <mesh position={[0, 0.002, 0]}>
              <boxGeometry args={[0.02, 0.003, 0.005]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
          </group>
        ))}

        {/* Side Wire Insertion Holes */}
        {[0.05, -0.05].map((pz, idx) => (
          <group key={idx} position={[-0.043, -0.005, pz]}>
            {/* Rectangular wire socket entrance */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <boxGeometry args={[0.026, 0.008, 0.032]} />
              <meshStandardMaterial color="#0f172a" roughness={0.8} />
            </mesh>
            {/* Internal Brass Clamping Leaf */}
            <mesh position={[0.008, 0, 0]}>
              <boxGeometry args={[0.006, 0.02, 0.026]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 3. Logic Side 3-Pin Male Header (VCC, OUT, GND) centered at X = 0.08 */}
      <group position={[0.08, pcbHeight + 0.012, 0]}>
        {/* Black Insulator Base */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.034, 0.024, 0.20]} />
          <meshStandardMaterial color="#18181b" roughness={0.45} />
        </mesh>
      </group>

      {/* 4. Central Allegro ACS712ELCTR SOIC-8 IC Package */}
      <group position={[0.01, pcbHeight + 0.01, 0]}>
        {/* IC Body */}
        <mesh castShadow>
          <boxGeometry args={[0.052, 0.016, 0.065]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} />
        </mesh>
        {/* Pin 1 Index Dot */}
        <mesh position={[-0.018, 0.009, -0.022]}>
          <cylinderGeometry args={[0.003, 0.003, 0.002, 8]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        {/* 8 Silver Gull-Wing Lead Legs */}
        {[-0.02, -0.007, 0.007, 0.02].map((lz, i) => (
          <React.Fragment key={i}>
            <mesh position={[-0.032, -0.003, lz]}>
              <boxGeometry args={[0.012, 0.005, 0.006]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0.032, -0.003, lz]}>
              <boxGeometry args={[0.012, 0.005, 0.006]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
            </mesh>
          </React.Fragment>
        ))}
      </group>

      {/* 5. SMD 0805 Passives & Power Indicator LED */}
      {/* Power LED (Red) */}
      <group position={[0.01, pcbHeight + 0.008, 0.08]}>
        <mesh castShadow>
          <boxGeometry args={[0.016, 0.008, 0.01]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.6} />
        </mesh>
      </group>
      {/* Filter Capacitor */}
      <group position={[0.01, pcbHeight + 0.008, -0.08]}>
        <mesh castShadow>
          <boxGeometry args={[0.018, 0.01, 0.012]} />
          <meshStandardMaterial color="#b45309" roughness={0.4} />
        </mesh>
        <mesh position={[-0.009, 0, 0]}>
          <boxGeometry args={[0.004, 0.01, 0.012]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>
        <mesh position={[0.009, 0, 0]}>
          <boxGeometry args={[0.004, 0.01, 0.012]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>
      </group>

      {/* 6. Physical 3D Gold Pins & Interactive Terminals */}
      {component.pins.map((pin) => {
        const isDraftSource =
          activeDraft?.fromComponentId === component.id &&
          activeDraft?.fromPinId === pin.id;
        const isPinHovered = hoveredPin?.id === pin.id;

        // Terminal Block vs Male Header Pins
        const isTerminalBlock = pin.id === 'ip_plus' || pin.id === 'ip_minus';

        let collarColor = '#0284c7';
        if (pin.type === 'POWER_VCC') collarColor = '#ef4444';
        else if (pin.type === 'GROUND') collarColor = '#334155';
        else if (pin.type === 'ANALOG') collarColor = '#10b981';

        return (
          <group key={pin.id} position={pin.relativePosition}>
            {/* Physical 3D Pin / Terminal Post */}
            {!isTerminalBlock ? (
              <>
                {/* Square Gold Header Pin */}
                <mesh position={[0, -0.006, 0]} castShadow>
                  <boxGeometry args={[0.018, 0.048, 0.018]} />
                  <meshStandardMaterial color="#f59e0b" metalness={0.95} roughness={0.15} />
                </mesh>
                {/* Tapered Pyramid Tip */}
                <mesh position={[0, 0.020, 0]} rotation={[0, Math.PI / 4, 0]}>
                  <coneGeometry args={[0.012, 0.012, 4]} />
                  <meshStandardMaterial color="#f59e0b" metalness={0.95} roughness={0.15} />
                </mesh>
                {/* Color Collar */}
                <mesh position={[0, -0.022, 0]}>
                  <cylinderGeometry args={[0.014, 0.016, 0.006, 16]} />
                  <meshStandardMaterial color={collarColor} roughness={0.3} metalness={0.5} />
                </mesh>
              </>
            ) : (
              <>
                {/* Brass Terminal Screw Post */}
                <mesh position={[0, 0.005, 0]}>
                  <cylinderGeometry args={[0.012, 0.012, 0.018, 12]} />
                  <meshStandardMaterial color="#fbbf24" metalness={0.92} roughness={0.2} />
                </mesh>
              </>
            )}

            {/* Invisible Raycast Hit Target */}
            <mesh
              onPointerDown={(e) => {
                e.stopPropagation();
                handlePinClick(e, pin);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredPin(pin);
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                setHoveredPin(null);
              }}
            >
              <sphereGeometry args={[0.038, 16, 16]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Glowing Holographic Snap Ring */}
            {(isPinHovered || isDraftSource) && (
              <group position={[0, 0.022, 0]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                  <ringGeometry args={[0.016, 0.036, 24]} />
                  <meshBasicMaterial
                    color={isDraftSource ? '#f59e0b' : '#38bdf8'}
                    transparent
                    opacity={0.95}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              </group>
            )}

            {/* Hover Tooltip */}
            {isPinHovered && (
              <Html position={[0, 0.08, 0]} center zIndexRange={[50, 100]}>
                <div className="bg-slate-950/95 text-xs text-white px-2.5 py-1.5 rounded-lg shadow-xl border border-sky-400 whitespace-nowrap pointer-events-none flex items-center space-x-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: collarColor }}
                  />
                  <span className="font-bold text-sky-300 font-mono">{pin.name}</span>
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* Selection Bounding Wireframe */}
      {isSelected && (
        <mesh position={[0, pcbHeight + 0.03, 0]} raycast={() => null}>
          <boxGeometry args={[pcbWidth + 0.05, 0.12, pcbDepth + 0.05]} />
          <meshBasicMaterial color="#0284c7" wireframe transparent opacity={0.65} />
        </mesh>
      )}
    </group>
  );
};
