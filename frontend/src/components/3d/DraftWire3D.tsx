import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { buildWireCurve } from './wireRouting';

export const DraftWire3D: React.FC = () => {
  const activeDraft = useWorkbenchStore((s) => s.activeDraft);
  const components = useWorkbenchStore((s) => s.components);

  const meshRef = useRef<THREE.Mesh>(null);
  const cursorRingRef = useRef<THREE.Group>(null);

  // Table plane for ray intersection
  const tablePlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05), []);
  const intersectionPoint = useMemo(() => new THREE.Vector3(), []);

  // Compute source pin world coordinates
  const sourceWorldPos = useMemo(() => {
    if (!activeDraft) return null;
    const comp = components.find((c) => c.id === activeDraft.fromComponentId);
    if (!comp) return null;
    const pin = comp.pins.find((p) => p.id === activeDraft.fromPinId);
    if (!pin) return null;

    const vec = new THREE.Vector3(...pin.relativePosition);
    if (comp.scale) vec.multiply(new THREE.Vector3(...comp.scale));
    const euler = new THREE.Euler(...comp.rotation);
    vec.applyEuler(euler);
    return vec.add(new THREE.Vector3(...comp.position));
  }, [activeDraft, components]);

  // Update curve dynamically on every frame following mouse raycast
  useFrame(({ raycaster }) => {
    if (!activeDraft || !sourceWorldPos || !meshRef.current) return;

    const hit = raycaster.ray.intersectPlane(tablePlane, intersectionPoint);
    if (!hit) return;

    // Clamp inside workbench table bounds
    intersectionPoint.x = Math.max(-2.6, Math.min(2.6, intersectionPoint.x));
    intersectionPoint.z = Math.max(-1.6, Math.min(1.6, intersectionPoint.z));
    intersectionPoint.y = Math.max(0.04, intersectionPoint.y);

    const pA = sourceWorldPos;
    const pB = intersectionPoint;
    const distance = pA.distanceTo(pB);
    if (distance < 0.03) return;

    const fromComp = components.find((c) => c.id === activeDraft.fromComponentId);
    const isFromBreadboard = Boolean(fromComp?.type === 'breadboard');

    const { curve } = buildWireCurve(pA, pB, {
      wireId: 'draft',
      isFromBreadboard,
      fromType: fromComp?.type,
      fromPinId: activeDraft.fromPinId,
    });

    const geometry = new THREE.TubeGeometry(curve, 36, 0.0065, 8, false);

    meshRef.current.geometry.dispose();
    meshRef.current.geometry = geometry;

    if (cursorRingRef.current) {
      cursorRingRef.current.position.set(pB.x, pB.y + 0.005, pB.z);
    }
  });

  if (!activeDraft || !sourceWorldPos) return null;

  return (
    <group>
      {/* Source Pin Female Dupont Connector Housing (Wears snugly over the metal pin) */}
      <group position={[sourceWorldPos.x, sourceWorldPos.y + 0.015, sourceWorldPos.z]}>
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

      {/* Dynamic Jumper Tube Wire */}
      <mesh ref={meshRef}>
        <tubeGeometry
          args={[
            new THREE.CatmullRomCurve3([
              sourceWorldPos,
              sourceWorldPos.clone().add(new THREE.Vector3(0, 0.1, 0)),
              sourceWorldPos.clone().add(new THREE.Vector3(0.1, 0.15, 0)),
            ]),
            16,
            0.009,
            8,
            false,
          ]}
        />
        <meshStandardMaterial
          color={activeDraft.currentColor || '#ef4444'}
          roughness={0.25}
          metalness={0.2}
          emissive={activeDraft.currentColor || '#ef4444'}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Target Snap Halo at Cursor - raycast passes through to target pin */}
      <group ref={cursorRingRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <ringGeometry args={[0.015, 0.035, 24]} />
          <meshBasicMaterial
            color={activeDraft.currentColor || '#ef4444'}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
};
