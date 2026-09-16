import React, { useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { WorkbenchComponent, PinDefinition } from '../../types/workbench';
import { useWorkbenchStore } from '../../store/workbenchStore';

interface DS18B20ModelProps {
  component: WorkbenchComponent;
  isSelected: boolean;
  onPointerDown: (e: any) => void;
}

export const DS18B20Model: React.FC<DS18B20ModelProps> = ({
  component,
  isSelected,
  onPointerDown,
}) => {
  const [hoveredPin, setHoveredPin] = useState<PinDefinition | null>(null);
  const [probeStyle, setProbeStyle] = useState<'to92' | 'stainless'>('to92');
  const [showStyleToggle, setShowStyleToggle] = useState(false);

  const activeDraft = useWorkbenchStore((s) => s.activeDraft);
  const startWireDraft = useWorkbenchStore((s) => s.startWireDraft);
  const completeWireDraft = useWorkbenchStore((s) => s.completeWireDraft);

  const handlePinClick = (e: any, pin: PinDefinition) => {
    e.stopPropagation();
    if (!activeDraft) {
      startWireDraft(component.id, pin.id);
    } else {
      completeWireDraft(component.id, pin.id);
    }
  };

  return (
    <group
      onPointerDown={onPointerDown}
      position={[0, 0.005, 0]}
      onPointerOver={() => setShowStyleToggle(true)}
      onPointerOut={() => setShowStyleToggle(false)}
    >
      {/* 1. Selection Highlight Halo */}
      {isSelected && (
        <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.045, 0.060, 32]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Style Toggle UI badge when hovered or selected */}
      {(showStyleToggle || isSelected) && !activeDraft && (
        <Html position={[0, 0.22, 0]} center pointerEvents="auto">
          <div className="flex items-center space-x-1 bg-slate-900/95 border border-sky-500/60 rounded-full px-2 py-0.5 shadow-xl backdrop-blur-sm select-none">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setProbeStyle('to92');
              }}
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                probeStyle === 'to92'
                  ? 'bg-sky-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              TO-92 IC
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setProbeStyle('stainless');
              }}
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                probeStyle === 'stainless'
                  ? 'bg-sky-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Stainless Probe
            </button>
          </div>
        </Html>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VARIANT A: Classic Elevated TO-92 Molded Transistor Package   */}
      {/* ------------------------------------------------------------- */}
      {probeStyle === 'to92' && (
        <group>
          {/* TO-92 Sensor Head elevated high at Y = 0.165m, proudly above Dupont plugs */}
          <group position={[0, 0.165, 0]}>
            {/* Front flat face block */}
            <mesh position={[0, 0, 0.007]} castShadow>
              <boxGeometry args={[0.054, 0.058, 0.016]} />
              <meshStandardMaterial color="#18181b" roughness={0.65} metalness={0.12} />
            </mesh>

            {/* Back semicircular half-cylinder dome */}
            <mesh position={[0, 0, -0.001]} rotation={[0, 0, 0]} castShadow>
              <cylinderGeometry args={[0.027, 0.027, 0.058, 32, 1, false, 0, Math.PI]} />
              <meshStandardMaterial color="#18181b" roughness={0.65} metalness={0.12} />
            </mesh>

            {/* Rounded top cap dome */}
            <mesh position={[0, 0.029, 0]} castShadow>
              <cylinderGeometry args={[0.025, 0.027, 0.006, 32]} />
              <meshStandardMaterial color="#18181b" roughness={0.7} metalness={0.1} />
            </mesh>

            {/* Molded bottom taper base */}
            <mesh position={[0, -0.029, 0]} castShadow>
              <cylinderGeometry args={[0.027, 0.024, 0.006, 32]} />
              <meshStandardMaterial color="#18181b" roughness={0.7} metalness={0.1} />
            </mesh>

            {/* High-Contrast Laser-Etched Dallas DS18B20 Silkscreen on Front Face */}
            <group position={[0, 0, 0.0155]}>
              <Html transform position={[0, 0, 0.001]} scale={0.038} pointerEvents="none">
                <div className="flex flex-col items-center justify-center font-mono select-none text-[9px] leading-tight text-slate-200 font-bold opacity-95 drop-shadow-md">
                  <span className="tracking-widest text-[10px] text-amber-300 font-black">DALLAS</span>
                  <span className="tracking-wider text-[12px] text-white font-black">DS18B20</span>
                  <span className="text-[6.5px] text-slate-400 font-medium tracking-tight">+2245B4 084AA</span>
                </div>
              </Html>
            </group>
          </group>

          {/* Three Long Tin-Plated Silver Leads extending down to Dupont sockets */}
          {component.pins.map((pin) => {
            const [px] = pin.relativePosition;
            return (
              <group key={`lead_${pin.id}`} position={[px, 0, 0]}>
                {/* Silver Metal Lead: from Y = 0.020 to Y = 0.136 (height 0.116m) */}
                <mesh position={[0, 0.078, 0]} castShadow>
                  <boxGeometry args={[0.004, 0.116, 0.004]} />
                  <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.15} />
                </mesh>

                {/* Lead entrance collar at bottom of sensor body */}
                <mesh position={[0, 0.134, 0]} castShadow>
                  <cylinderGeometry args={[0.0035, 0.0035, 0.006, 12]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VARIANT B: Stainless Steel Waterproof Industrial Probe Tube   */}
      {/* ------------------------------------------------------------- */}
      {probeStyle === 'stainless' && (
        <group position={[0, 0.11, 0]}>
          {/* Mirror-Polished Stainless Steel Capsule Tube (6mm x 50mm scaled) */}
          <group position={[0, 0.04, 0]}>
            {/* Stainless steel main cylinder */}
            <mesh castShadow>
              <cylinderGeometry args={[0.024, 0.024, 0.12, 32]} />
              <meshStandardMaterial color="#f1f5f9" metalness={0.98} roughness={0.08} />
            </mesh>

            {/* Rounded bullet top cap */}
            <mesh position={[0, 0.06, 0]} castShadow>
              <sphereGeometry args={[0.024, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#f1f5f9" metalness={0.98} roughness={0.08} />
            </mesh>

            {/* Laser engraving on stainless steel */}
            <Html transform position={[0, 0, 0.025]} scale={0.035} pointerEvents="none">
              <div className="flex flex-col items-center justify-center font-mono select-none text-[8px] text-slate-800 font-bold opacity-80 rotate-90">
                <span>DS18B20 PROBE</span>
                <span className="text-[6px] text-slate-600">-55°C ~ +125°C</span>
              </div>
            </Html>
          </group>

          {/* Waterproof Rubber Strain Relief Boot / Heatshrink */}
          <group position={[0, -0.035, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.026, 0.020, 0.035, 24]} />
              <meshStandardMaterial color="#09090b" roughness={0.5} />
            </mesh>
            {/* Heatshrink crimp rings */}
            <mesh position={[0, 0.008, 0]}>
              <torusGeometry args={[0.025, 0.002, 12, 24]} />
              <meshStandardMaterial color="#18181b" roughness={0.4} />
            </mesh>
          </group>

          {/* Industrial Heavy Black Silicone Cable leading to breakout */}
          <mesh position={[0, -0.065, 0]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.028, 16]} />
            <meshStandardMaterial color="#1c1917" roughness={0.6} />
          </mesh>

          {/* Color-coded insulated wires fanning out to pins */}
          {component.pins.map((pin) => {
            const [px] = pin.relativePosition;
            const wireColor =
              pin.type === 'POWER_VCC'
                ? '#ef4444'
                : pin.type === 'GROUND'
                ? '#1e293b'
                : '#eab308';
            return (
              <group key={`fan_${pin.id}`}>
                <mesh position={[px * 0.5, -0.082, 0]}>
                  <cylinderGeometry args={[0.003, 0.003, 0.018, 12]} />
                  <meshStandardMaterial color={wireColor} roughness={0.4} />
                </mesh>
                <mesh position={[px, -0.092, 0]}>
                  <cylinderGeometry args={[0.003, 0.003, 0.012, 12]} />
                  <meshStandardMaterial color={wireColor} roughness={0.4} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Precision Terminal Sockets & Click Targets (At pin positions) */}
      {/* ------------------------------------------------------------- */}
      {component.pins.map((pin) => {
        const isHovered = hoveredPin?.id === pin.id;
        const [px, , pz] = pin.relativePosition;

        return (
          <group key={pin.id} position={[px, 0, pz]}>
            {/* Clickable Terminal Socket Ring (at bottom of lead where Dupont sits) */}
            <mesh
              position={[0, 0.020, 0]}
              onClick={(e) => handlePinClick(e, pin)}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredPin(pin);
              }}
              onPointerOut={() => setHoveredPin(null)}
            >
              <cylinderGeometry args={[0.006, 0.006, 0.006, 16]} />
              <meshStandardMaterial
                color={
                  isHovered
                    ? '#38bdf8'
                    : pin.type === 'POWER_VCC'
                    ? '#ef4444'
                    : pin.type === 'GROUND'
                    ? '#1e293b'
                    : '#eab308'
                }
                metalness={0.7}
                roughness={0.2}
                emissive={isHovered ? '#38bdf8' : '#000000'}
                emissiveIntensity={isHovered ? 0.6 : 0.0}
              />
            </mesh>

            {/* Interactive 1:1 Tooltip Badge */}
            {isHovered && (
              <Html position={[0, 0.065, 0]} center>
                <div className="bg-slate-950/95 text-white border border-sky-500/60 text-[11px] font-semibold px-2 py-0.5 rounded shadow-lg whitespace-nowrap pointer-events-none flex items-center space-x-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      pin.type === 'POWER_VCC'
                        ? 'bg-rose-500'
                        : pin.type === 'GROUND'
                        ? 'bg-slate-400'
                        : 'bg-amber-400'
                    }`}
                  />
                  <span>{pin.name}</span>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
};
