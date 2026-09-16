import React, { useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { WorkbenchComponent, PinDefinition } from '../../types/workbench';
import { useWorkbenchStore } from '../../store/workbenchStore';

interface LEDModelProps {
  component: WorkbenchComponent;
  isSelected: boolean;
  onPointerDown: (e: any) => void;
}

export const LEDModel: React.FC<LEDModelProps> = ({
  component,
  isSelected,
  onPointerDown,
}) => {
  const [hoveredPin, setHoveredPin] = useState<PinDefinition | null>(null);
  const activeDraft = useWorkbenchStore((s) => s.activeDraft);
  const startWireDraft = useWorkbenchStore((s) => s.startWireDraft);
  const completeWireDraft = useWorkbenchStore((s) => s.completeWireDraft);
  const telemetry = useWorkbenchStore((s) => s.telemetry);

  const isGreen = component.type === 'led_green';
  const isLit = isGreen
    ? telemetry.pump_active || telemetry.valve_open
    : telemetry.status_class === 2; // Red LED lit during alarm trip

  const primaryColor = isGreen ? '#16a34a' : '#dc2626';
  const glowColor = isGreen ? '#4ade80' : '#f87171';
  const emissiveColor = isGreen ? '#22c55e' : '#ef4444';

  const handlePinClick = (e: any, pin: PinDefinition) => {
    e.stopPropagation();
    if (!activeDraft) {
      startWireDraft(component.id, pin.id);
    } else {
      completeWireDraft(component.id, pin.id);
    }
  };

  // Standard 5mm LED Dimensions (in meters).
  // Lens radius = 0.0025m (5mm diameter), pitch = 0.00127m (+/- 1.27mm for 2.54mm pitch)
  const pinSpacing = 0.00254; // 2.54mm pitch - must stay true so wire endpoints
  const anodeX = -pinSpacing / 2; // (computed from unscaled pin.relativePosition
  const cathodeX = pinSpacing / 2; // in the store) still land exactly on the leads.
  const leadHeight = 0.035; // 35mm tall leads
  const lensBaseY = leadHeight; // Lens sits at Y = 0.035m (35mm above pin sockets)
  // The lens body itself is exaggerated so it actually reads as a bulb next to
  // the intentionally oversized breadboard/wire props elsewhere in this scene
  // (previously it was true-to-scale next to those props and looked like a
  // flat, featureless blob). Only the lens geometry is scaled - the leads and
  // interactive pins stay at their real, wire-aligned coordinates.
  const LENS_SCALE = 4;

  return (
    <group onPointerDown={onPointerDown}>
      {/* --- 1. Realistic 5mm T-1 3/4 Epoxy Lens Body --- */}
      <group position={[0, lensBaseY, 0]} scale={[LENS_SCALE, LENS_SCALE, LENS_SCALE]}>
        {/* Base Cylinder Body (5mm Diameter, 5.5mm Height) - deliberately a
            shade DARKER than the dome below. A small round object under this
            scene's soft lighting shows almost no shading gradient on its own
            (its whole visible surface catches nearly the same light angle),
            so relying on lighting alone made the entire lens read as one flat
            color blob. Two-toning the parts gives it a visible shape/seam
            regardless of how it's lit. */}
        <mesh position={[0, 0.00275, 0]} castShadow>
          <cylinderGeometry args={[0.0025, 0.0025, 0.0055, 32]} />
          <meshStandardMaterial
            // A dark base color that stays visibly darker than the dome.
            color={isGreen ? '#052e16' : '#450a0a'}
            // Emissive light adds the SAME brightness to every point on a
            // mesh regardless of its surface normal or the scene's actual
            // lighting - it does not shade. Any real intensity here was
            // flattening the whole lens into one uniform flat-colored disc,
            // erasing the dome/cylinder contrast entirely. Kept near-zero;
            // the external pointLight below carries the "glowing" read.
            emissive={isLit ? emissiveColor : '#000000'}
            emissiveIntensity={isLit ? 0.04 : 0.0}
            roughness={0.35}
            metalness={0.05}
          />
        </mesh>

        {/* Hemisphere Top Dome (5mm Diameter) - lighter/brighter tone than
            the cylinder below, so the bulb silhouette reads as two distinct
            shapes even head-on. */}
        <mesh position={[0, 0.0055, 0]} castShadow>
          <sphereGeometry args={[0.0025, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={glowColor}
            emissive={isLit ? glowColor : '#000000'}
            emissiveIntensity={isLit ? 0.06 : 0.0}
            roughness={0.15}
            metalness={0.05}
          />
        </mesh>

        {/* Small fixed specular glint near the dome's crown - a cheap but
            reliable way to sell "glossy round bulb" that doesn't depend on
            scene lighting direction at all. */}
        <mesh position={[-0.0012, 0.0077, 0.0014]} raycast={() => null}>
          <sphereGeometry args={[0.0008, 12, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Bottom Flange Collar (5.8mm Rim at base) - darkest of the three,
            grounding the shape visually where it meets the leads. */}
        <mesh position={[0, 0.0004, 0]}>
          <cylinderGeometry args={[0.0029, 0.0029, 0.0008, 32]} />
          <meshStandardMaterial
            color={primaryColor}
            emissive={isLit ? emissiveColor : '#000000'}
            emissiveIntensity={isLit ? 0.04 : 0.0}
            roughness={0.4}
          />
        </mesh>

        {/* --- Internal Lead Frame & Semiconductor Die (Visible Inside Lens) --- */}
        {/* Anode Post (Left) */}
        <mesh position={[-0.0008, 0.002, 0]}>
          <boxGeometry args={[0.0005, 0.003, 0.0004]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.1} />
        </mesh>

        {/* Cathode Reflective Anvil Cup (Right) */}
        <mesh position={[0.0008, 0.002, 0]}>
          <cylinderGeometry args={[0.0009, 0.0005, 0.0025, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.92} roughness={0.15} />
        </mesh>

        {/* Glowing LED Micro-Die inside Anvil Cup */}
        <mesh position={[0.0008, 0.0028, 0]}>
          <boxGeometry args={[0.0004, 0.0004, 0.0004]} />
          <meshStandardMaterial
            color={isLit ? '#ffffff' : '#475569'}
            emissive={isLit ? glowColor : '#000000'}
            emissiveIntensity={isLit ? 1.5 : 0}
          />
        </mesh>

        {/* Internal Glow Light Source when Lit - kept dim since at this
            point-blank range even a modest intensity blows out the lens's
            own surface shading (inverse-square falloff), which is what was
            making the dome read as one flat, featureless blob. */}
        {isLit && (
          <pointLight
            color={glowColor}
            intensity={0.15}
            distance={0.12}
            decay={2}
            position={[0, 0.003, 0]}
          />
        )}
      </group>

      {/* --- 2. Authentic Tin-Plated Silver Leads --- */}
      {/* Anode Lead (Longer Lead) on Left */}
      <mesh position={[anodeX, leadHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.0004, 0.0004, leadHeight, 12]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.12} />
      </mesh>

      {/* Cathode Lead (Slightly Shorter Lead) on Right */}
      <mesh position={[cathodeX, leadHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.0004, 0.0004, leadHeight, 12]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.12} />
      </mesh>

      {/* Dupont Socket Boot Collars at bottom of leads (Y = 0 to 0.008m) */}
      <mesh position={[anodeX, 0.004, 0]}>
        <cylinderGeometry args={[0.0012, 0.0012, 0.008, 12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[cathodeX, 0.004, 0]}>
        <cylinderGeometry args={[0.0012, 0.0012, 0.008, 12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.2} />
      </mesh>

      {/* --- 3. Interactive Pins at Anode and Cathode Terminals --- */}
      {component.pins.map((pin) => {
        const isAnode = pin.id === 'anode';
        const posX = isAnode ? anodeX : cathodeX;
        const isDraftSource =
          activeDraft?.fromComponentId === component.id &&
          activeDraft?.fromPinId === pin.id;
        const isPinHovered = hoveredPin?.id === pin.id;

        return (
          <group key={pin.id} position={[posX, 0.002, 0]}>
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
              <sphereGeometry args={[0.015, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Glowing Snap Ring */}
            {(isPinHovered || isDraftSource) && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <ringGeometry args={[0.003, 0.009, 16]} />
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
              <Html position={[0, 0.025, 0]} center zIndexRange={[50, 100]}>
                <div className="bg-slate-950/95 text-xs text-white px-2 py-1 rounded shadow-lg border border-sky-400 whitespace-nowrap pointer-events-none flex items-center space-x-1.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: isAnode ? '#ef4444' : '#475569' }}
                  />
                  <span className="font-bold text-sky-300">{pin.name}</span>
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* Selection Bounding Wireframe */}
      {isSelected && (
        <mesh position={[0, leadHeight / 2 + 0.003, 0]} raycast={() => null}>
          <boxGeometry args={[0.012, leadHeight + 0.01, 0.012]} />
          <meshBasicMaterial color="#0284c7" wireframe transparent opacity={0.65} />
        </mesh>
      )}
    </group>
  );
};
