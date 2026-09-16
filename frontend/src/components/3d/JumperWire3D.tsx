import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import type { WireConnection } from '../../types/workbench';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { Html } from '@react-three/drei';
import { buildWireCurve } from './wireRouting';

interface JumperWire3DProps {
  wire: WireConnection;
}

export const JumperWire3D: React.FC<JumperWire3DProps> = ({ wire }) => {
  const [hovered, setHovered] = useState(false);
  const components = useWorkbenchStore((s) => s.components);
  const removeWire = useWorkbenchStore((s) => s.removeWire);
  const activeDraft = useWorkbenchStore((s) => s.activeDraft);

  const fromComp = components.find((c) => c.id === wire.fromComponentId);
  const toComp = components.find((c) => c.id === wire.toComponentId);

  const fromPin = fromComp?.pins.find((p) => p.id === wire.fromPinId);
  const toPin = toComp?.pins.find((p) => p.id === wire.toPinId);

  const isFromBreadboard = Boolean(fromComp?.type === 'breadboard' || fromComp?.id?.startsWith('breadboard'));
  const isToBreadboard = Boolean(toComp?.type === 'breadboard' || toComp?.id?.startsWith('breadboard'));

  // Compute world coordinates of Pin A and Pin B
  const { curve, midPoint, pA, pB } = useMemo(() => {
    if (!fromComp || !toComp || !fromPin || !toPin) {
      return { curve: null, midPoint: new THREE.Vector3(), pA: new THREE.Vector3(), pB: new THREE.Vector3() };
    }

    // Transform local pin position to world space with scale + rotation
    const getPinWorldPos = (comp: typeof fromComp, pin: typeof fromPin) => {
      const pinVec = new THREE.Vector3(...pin.relativePosition);
      if (comp.scale) pinVec.multiply(new THREE.Vector3(...comp.scale));
      const euler = new THREE.Euler(...comp.rotation);
      pinVec.applyEuler(euler);
      return pinVec.add(new THREE.Vector3(...comp.position));
    };

    const posA = getPinWorldPos(fromComp, fromPin);
    const posB = getPinWorldPos(toComp, toPin);

    // Build masterwork flat orthogonal jumper wire curve (zero sag, 90-degree plier bends)
    const { curve: wireCurve, midPoint: calculatedMid } = buildWireCurve(posA, posB, {
      wireId: wire.id,
      isFromBreadboard,
      isToBreadboard,
      fromType: fromComp?.type,
      toType: toComp?.type,
      fromPinId: fromPin?.id,
      toPinId: toPin?.id,
    });

    return { curve: wireCurve, midPoint: calculatedMid, pA: posA, pB: posB };
  }, [fromComp, toComp, fromPin, toPin, wire.id, isFromBreadboard, isToBreadboard]);

  if (!curve) return null;

  return (
    <group>
      {/* Pin A Connector: Female Dupont housing on modules, or clean insertion into breadboard hole */}
      {!isFromBreadboard ? (
        <group position={[pA.x, pA.y + 0.015, pA.z]}>
          <mesh castShadow raycast={() => null}>
            <boxGeometry args={[0.022, 0.054, 0.022]} />
            <meshStandardMaterial color="#18181b" roughness={0.5} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.003, 0.0112]} raycast={() => null}>
            <boxGeometry args={[0.008, 0.018, 0.002]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.027, 0]} raycast={() => null}>
            <cylinderGeometry args={[0.009, 0.011, 0.008, 12]} />
            <meshStandardMaterial color="#0f172a" roughness={0.6} />
          </mesh>
        </group>
      ) : (
        <mesh position={[pA.x, 0.106, pA.z]} raycast={() => null}>
          <cylinderGeometry args={[0.006, 0.006, 0.003, 12]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
        </mesh>
      )}

      {/* Pin B Connector: Female Dupont housing on modules, or clean insertion into breadboard hole */}
      {!isToBreadboard ? (
        <group position={[pB.x, pB.y + 0.015, pB.z]}>
          <mesh castShadow raycast={() => null}>
            <boxGeometry args={[0.022, 0.054, 0.022]} />
            <meshStandardMaterial color="#18181b" roughness={0.5} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.003, 0.0112]} raycast={() => null}>
            <boxGeometry args={[0.008, 0.018, 0.002]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.027, 0]} raycast={() => null}>
            <cylinderGeometry args={[0.009, 0.011, 0.008, 12]} />
            <meshStandardMaterial color="#0f172a" roughness={0.6} />
          </mesh>
        </group>
      ) : (
        <mesh position={[pB.x, 0.106, pB.z]} raycast={() => null}>
          <cylinderGeometry args={[0.006, 0.006, 0.003, 12]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
        </mesh>
      )}

      {/* 3D Masterwork Solid-Core Hookup Wire */}
      <mesh
        onClick={(e) => {
          if (activeDraft) return;
          e.stopPropagation();
          removeWire(wire.id);
        }}
        onPointerOver={(e) => {
          if (activeDraft) return;
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <tubeGeometry args={[curve, 200, hovered && !activeDraft ? 0.009 : 0.0065, 12, false]} />
        <meshStandardMaterial
          color={hovered && !activeDraft ? '#f43f5e' : wire.color}
          roughness={0.35}
          metalness={0.12}
          emissive={hovered && !activeDraft ? '#f43f5e' : '#000000'}
          emissiveIntensity={hovered && !activeDraft ? 0.4 : 0.0}
        />
      </mesh>

      {/* Delete / Wire Info hover badge */}
      {hovered && !activeDraft && (
        <Html position={[midPoint.x, midPoint.y + 0.08, midPoint.z]} center>
          <div className="bg-rose-950/95 text-rose-200 border border-rose-500/60 text-[10px] font-bold px-2.5 py-1 rounded shadow-lg whitespace-nowrap cursor-pointer hover:bg-rose-900 transition flex items-center space-x-1.5 pointer-events-none">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: wire.color }} />
            <span>Click to Delete Wire ({fromPin?.name} ➔ {toPin?.name})</span>
          </div>
        </Html>
      )}
    </group>
  );
};
