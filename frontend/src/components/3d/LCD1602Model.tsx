import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { useGLTF, Html } from '@react-three/drei';
import type { WorkbenchComponent, PinDefinition } from '../../types/workbench';
import { useWorkbenchStore } from '../../store/workbenchStore';

interface LCD1602ModelProps {
  component: WorkbenchComponent;
  isSelected: boolean;
  onPointerDown: (e: any) => void;
}

export const LCD1602Model: React.FC<LCD1602ModelProps> = ({
  component,
  isSelected,
  onPointerDown,
}) => {
  const [hoveredPin, setHoveredPin] = useState<PinDefinition | null>(null);
  const activeDraft = useWorkbenchStore((s) => s.activeDraft);
  const startWireDraft = useWorkbenchStore((s) => s.startWireDraft);
  const completeWireDraft = useWorkbenchStore((s) => s.completeWireDraft);
  const telemetry = useWorkbenchStore((s) => s.telemetry);

  const { scene } = useGLTF('/models/lcd_1602.glb');
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  const handlePinClick = (e: any, pin: PinDefinition) => {
    e.stopPropagation();
    if (!activeDraft) {
      startWireDraft(component.id, pin.id);
    } else {
      completeWireDraft(component.id, pin.id);
    }
  };

  const line1 = `TANK:${telemetry.tank_level.toFixed(1)}% ${telemetry.pump_active ? 'P:ON' : 'P:OFF'}`;
  const line2 = `T:${telemetry.temperature.toFixed(0)}C G:${telemetry.gas_ppm.toFixed(0)}P V:${telemetry.valve_open ? 'V:OP' : 'V:CL'}`;

  return (
    <group onPointerDown={onPointerDown}>
      {/* 1. Authentic CAD GLB Model converted from lcd_1602.glb */}
      <primitive object={clonedScene} />

      {/* 2. Dynamic 16x2 Character Backlight Screen Display Overlay */}
      <Html
        position={[0, 0.016, 0.01]}
        transform
        rotation={[-Math.PI / 18, 0, 0]}
        distanceFactor={0.12}
        zIndexRange={[10, 30]}
      >
        <div
          className="w-[175px] h-[48px] bg-[#022c22] border-2 border-[#064e3b] rounded p-1 font-mono text-[13px] font-extrabold text-[#34d399] leading-tight tracking-wider shadow-inner select-none pointer-events-none flex flex-col justify-between"
          style={{ textShadow: '0 0 6px rgba(52, 211, 153, 0.7)' }}
        >
          <div>{line1}</div>
          <div>{line2}</div>
        </div>
      </Html>

      {/* 3. Interactive Pin Terminals (GND, VCC, SDA, SCL) */}
      {component.pins.map((pin) => {
        const isDraftSource =
          activeDraft?.fromComponentId === component.id &&
          activeDraft?.fromPinId === pin.id;
        const isPinHovered = hoveredPin?.id === pin.id;

        let collarColor = '#0284c7';
        if (pin.type === 'GROUND') collarColor = '#334155';
        else if (pin.type === 'POWER_VCC') collarColor = '#ef4444';
        else if (pin.id === 'scl') collarColor = '#f59e0b';

        return (
          <group key={pin.id} position={pin.relativePosition}>
            {/* Interactive Sphere Target */}
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
              <sphereGeometry args={[0.015, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Glowing Snap Ring */}
            {(isPinHovered || isDraftSource) && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <ringGeometry args={[0.005, 0.012, 16]} />
                <meshBasicMaterial
                  color={isDraftSource ? '#f59e0b' : '#38bdf8'}
                  transparent
                  opacity={0.95}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}

            {/* Hover Tooltip */}
            {isPinHovered && (
              <Html position={[0, 0.03, 0]} center zIndexRange={[50, 100]}>
                <div className="bg-slate-950/95 text-xs text-white px-2 py-1 rounded shadow-lg border border-sky-400 whitespace-nowrap pointer-events-none flex items-center space-x-1.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
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
        <mesh position={[0, 0.018, 0]} raycast={() => null}>
          <boxGeometry args={[0.088, 0.04, 0.03]} />
          <meshBasicMaterial color="#0284c7" wireframe transparent opacity={0.65} />
        </mesh>
      )}
    </group>
  );
};
