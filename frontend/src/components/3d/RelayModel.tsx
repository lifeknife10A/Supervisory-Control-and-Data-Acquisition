import React, { useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { WorkbenchComponent, PinDefinition } from '../../types/workbench';
import { useWorkbenchStore } from '../../store/workbenchStore';

interface RelayModelProps {
  component: WorkbenchComponent;
  isSelected: boolean;
  onPointerDown: (e: any) => void;
}

export const RelayModel: React.FC<RelayModelProps> = ({
  component,
  isSelected,
  onPointerDown,
}) => {
  const [hoveredPin, setHoveredPin] = useState<PinDefinition | null>(null);
  const activeDraft = useWorkbenchStore((s) => s.activeDraft);
  const startWireDraft = useWorkbenchStore((s) => s.startWireDraft);
  const completeWireDraft = useWorkbenchStore((s) => s.completeWireDraft);
  const telemetry = useWorkbenchStore((s) => s.telemetry);

  const isEnergized = telemetry.pump_active;

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
      {/* 1. Blue FR4 Module PCB */}
      <mesh position={[0, 0.01, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.78, 0.02, 0.32]} />
        <meshStandardMaterial color="#1e40af" roughness={0.35} metalness={0.15} />
      </mesh>

      {/* 2. Songle 5V Blue Relay Cube (Center) */}
      <group position={[0, 0.09, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.34, 0.14, 0.24]} />
          <meshStandardMaterial color="#2563eb" roughness={0.3} metalness={0.15} />
        </mesh>
      </group>

      {/* 3. Blue 3-Terminal Block on Switch Side (NO, COM, NC) at X = -0.35 */}
      <group position={[-0.32, 0.05, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.10, 0.075, 0.24]} />
          <meshStandardMaterial color="#0284c7" roughness={0.35} />
        </mesh>
        {[-0.1, 0, 0.1].map((pz, idx) => (
          <group key={idx} position={[0, 0.038, pz]}>
            {/* Clamping Screw Head */}
            <mesh>
              <cylinderGeometry args={[0.014, 0.014, 0.006, 16]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 4. Logic 3-Pin Header on Driver Side (VCC, GND, IN) at X = 0.35 */}
      <group position={[0.32, 0.025, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.03, 0.025, 0.22]} />
          <meshStandardMaterial color="#18181b" roughness={0.45} />
        </mesh>
      </group>

      {/* 5. Status Indicators: Power LED (Red) & Relay State LED (Green) */}
      <mesh position={[0.22, 0.025, -0.06]}>
        <boxGeometry args={[0.016, 0.008, 0.01]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0.22, 0.025, 0.06]}>
        <boxGeometry args={[0.016, 0.008, 0.01]} />
        <meshStandardMaterial
          color="#22c55e"
          emissive="#22c55e"
          emissiveIntensity={isEnergized ? 0.9 : 0.05}
        />
      </mesh>

      {/* 6. Physical Pins & Interactive Terminals */}
      {component.pins.map((pin) => {
        const isDraftSource =
          activeDraft?.fromComponentId === component.id &&
          activeDraft?.fromPinId === pin.id;
        const isPinHovered = hoveredPin?.id === pin.id;
        const isScrewTerminal = pin.type === 'RELAY_CONTACT';

        let collarColor = '#3b82f6';
        if (pin.type === 'POWER_VCC') collarColor = '#ef4444';
        else if (pin.type === 'GROUND') collarColor = '#334155';
        else if (pin.type === 'RELAY_CONTACT') collarColor = '#f97316';

        return (
          <group key={pin.id} position={pin.relativePosition}>
            {!isScrewTerminal ? (
              <>
                {/* Gold Square Pin */}
                <mesh position={[0, -0.006, 0]} castShadow>
                  <boxGeometry args={[0.018, 0.048, 0.018]} />
                  <meshStandardMaterial color="#f59e0b" metalness={0.95} roughness={0.15} />
                </mesh>
                <mesh position={[0, 0.020, 0]} rotation={[0, Math.PI / 4, 0]}>
                  <coneGeometry args={[0.012, 0.012, 4]} />
                  <meshStandardMaterial color="#f59e0b" metalness={0.95} roughness={0.15} />
                </mesh>
              </>
            ) : (
              <>
                {/* Screw Contact Post */}
                <mesh position={[0, 0.005, 0]}>
                  <cylinderGeometry args={[0.012, 0.012, 0.018, 12]} />
                  <meshStandardMaterial color="#fbbf24" metalness={0.92} roughness={0.2} />
                </mesh>
              </>
            )}

            {/* Raycast Hit Target */}
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

            {/* Holographic Snap Ring */}
            {(isPinHovered || isDraftSource) && (
              <mesh position={[0, 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <ringGeometry args={[0.016, 0.036, 24]} />
                <meshBasicMaterial
                  color={isDraftSource ? '#f59e0b' : '#38bdf8'}
                  transparent
                  opacity={0.95}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}

            {/* Tooltip */}
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
        <mesh position={[0, 0.09, 0]} raycast={() => null}>
          <boxGeometry args={[0.84, 0.19, 0.38]} />
          <meshBasicMaterial color="#0284c7" wireframe transparent opacity={0.65} />
        </mesh>
      )}
    </group>
  );
};
