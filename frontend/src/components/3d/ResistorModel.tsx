import React, { useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { WorkbenchComponent, PinDefinition } from '../../types/workbench';
import { useWorkbenchStore } from '../../store/workbenchStore';

interface ResistorModelProps {
  component: WorkbenchComponent;
  isSelected: boolean;
  onPointerDown: (e: any) => void;
}

export const ResistorModel: React.FC<ResistorModelProps> = ({
  component,
  isSelected,
  onPointerDown,
}) => {
  const [hoveredPin, setHoveredPin] = useState<PinDefinition | null>(null);
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

  // Determine resistance color code from component name / id
  // Default: 220Ω (Red, Red, Brown, Gold)
  // If 4.7kΩ (DS18B20 pull-up): Yellow, Violet, Red, Gold
  const is4k7 = component.name.includes('4.7') || component.id.includes('ds18b20');
  const bands = is4k7
    ? ['#eab308', '#7c3aed', '#dc2626', '#f59e0b'] // 4.7kΩ 5%
    : ['#dc2626', '#dc2626', '#78350f', '#f59e0b']; // 220Ω 5%

  return (
    <group onPointerDown={onPointerDown} position={[0, 0.03, 0]}>
      {/* 1. Ceramic Resistor Main Body (Cylindrical with Flared Ends) */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.016, 0.016, 0.075, 20]} />
        <meshStandardMaterial color="#e5d5b5" roughness={0.4} metalness={0.05} />
      </mesh>

      {/* Flared End Caps */}
      {[-0.0375, 0.0375].map((px, i) => (
        <mesh key={i} position={[px, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.018, 0.016, 0.012, 20]} />
          <meshStandardMaterial color="#d4c3a3" roughness={0.45} />
        </mesh>
      ))}

      {/* 4 Authentic Color Bands */}
      {[-0.022, -0.008, 0.006, 0.024].map((bx, idx) => (
        <mesh key={idx} position={[bx, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0165, 0.0165, 0.006, 20]} />
          <meshStandardMaterial
            color={bands[idx]}
            roughness={0.25}
            metalness={idx === 3 ? 0.85 : 0.1}
          />
        </mesh>
      ))}

      {/* 2. Shiny Tinned Copper Axial Wire Leads extending out to the EXACT pin coordinates */}
      {/* Left Lead: from X = -0.04 to X = -0.08 */}
      <mesh position={[-0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.004, 0.004, 0.044, 12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.15} />
      </mesh>
      {/* Right Lead: from X = +0.04 to X = +0.08 */}
      <mesh position={[0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.004, 0.004, 0.044, 12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.15} />
      </mesh>

      {/* 3. Interactive Pins exactly at relativePosition [-0.08, 0, 0] and [0.08, 0, 0] */}
      {component.pins.map((pin) => {
        const isDraftSource =
          activeDraft?.fromComponentId === component.id &&
          activeDraft?.fromPinId === pin.id;
        const isPinHovered = hoveredPin?.id === pin.id;

        // Local position relative to group (which is at Y = 0.03)
        const localPos: [number, number, number] = [pin.relativePosition[0], 0, 0];

        return (
          <group key={pin.id} position={localPos}>
            {/* Visible Metal Pin Solder Collar / Lead Tip */}
            <mesh castShadow>
              <sphereGeometry args={[0.006, 12, 12]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.15} />
            </mesh>

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
              <sphereGeometry args={[0.035, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Glowing Snap Ring */}
            {(isPinHovered || isDraftSource) && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <ringGeometry args={[0.012, 0.030, 20]} />
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
              <Html position={[0, 0.06, 0]} center zIndexRange={[50, 100]}>
                <div className="bg-slate-950/95 text-xs text-white px-2 py-1 rounded shadow-lg border border-sky-400 whitespace-nowrap pointer-events-none flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                  <span className="font-bold text-cyan-300">{pin.name}</span>
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* Selection Bounding Wireframe */}
      {isSelected && (
        <mesh raycast={() => null}>
          <boxGeometry args={[0.22, 0.08, 0.08]} />
          <meshBasicMaterial color="#0284c7" wireframe transparent opacity={0.65} />
        </mesh>
      )}
    </group>
  );
};
