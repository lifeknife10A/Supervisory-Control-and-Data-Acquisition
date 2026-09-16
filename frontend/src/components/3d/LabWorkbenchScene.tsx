import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Compass } from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';
import type { WorkbenchComponent } from '../../types/workbench';
import { DraggableComponent } from './DraggableComponent';
import { JumperWire3D } from './JumperWire3D';
import { DraftWire3D } from './DraftWire3D';
import { ComponentTransformGizmo } from './ComponentTransformGizmo';
import { ActuatorEffects } from './ActuatorEffects';
import { MarqueeManager } from './MarqueeSelection';
import type { MarqueeRect } from './MarqueeSelection';

function CameraController() {
  const { camera } = useThree();
  const cameraView = useWorkbenchStore((s) => s.cameraView);
  const isDraggingComponent = useWorkbenchStore((s) => s.isDraggingComponent);
  const isShiftPressed = useWorkbenchStore((s) => s.isShiftPressed);
  const setIsShiftPressed = useWorkbenchStore((s) => s.setIsShiftPressed);
  const controlsRef = useRef<any>(null);

  const targetCamPos = useRef(new THREE.Vector3(0, 3.2, 4.25));
  const targetLook = useRef(new THREE.Vector3(0, 0, 0));
  const isTransitioning = useRef(false);

  // Global Shift key tracker
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setIsShiftPressed]);

  useEffect(() => {
    if (cameraView === 'top') {
      targetCamPos.current.set(0, 5.8, 0.1);
      targetLook.current.set(0, 0, 0);
    } else if (cameraView === 'front') {
      targetCamPos.current.set(0, 1.25, 5.2);
      targetLook.current.set(0, 0.08, 0);
    } else if (cameraView === 'iso') {
      targetCamPos.current.set(0, 3.2, 4.25);
      targetLook.current.set(0, 0, 0);
    }
    isTransitioning.current = true;
  }, [cameraView]);

  useFrame((_, delta) => {
    if (isTransitioning.current && controlsRef.current) {
      camera.position.lerp(targetCamPos.current, Math.min(1, delta * 7));
      controlsRef.current.target.lerp(targetLook.current, Math.min(1, delta * 7));
      controlsRef.current.update();

      if (
        camera.position.distanceTo(targetCamPos.current) < 0.01 &&
        controlsRef.current.target.distanceTo(targetLook.current) < 0.01
      ) {
        camera.position.copy(targetCamPos.current);
        controlsRef.current.target.copy(targetLook.current);
        controlsRef.current.update();
        isTransitioning.current = false;
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={!isDraggingComponent}
      enableDamping
      dampingFactor={0.05}
      minDistance={0.8}
      maxDistance={9}
      maxPolarAngle={Math.PI / 2 - 0.05} // Do not dip below tabletop
      mouseButtons={{
        LEFT: isShiftPressed ? THREE.MOUSE.ROTATE : (-1 as any),
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
    />
  );
}

export const LabWorkbenchScene: React.FC = () => {
  const components = useWorkbenchStore((s) => s.components);
  const wires = useWorkbenchStore((s) => s.wires);
  const setSelectedComponentIds = useWorkbenchStore((s) => s.setSelectedComponentIds);
  const addComponent = useWorkbenchStore((s) => s.addComponent);
  const isShiftPressed = useWorkbenchStore((s) => s.isShiftPressed);

  const isDraggingComponent = useWorkbenchStore((s) => s.isDraggingComponent);
  const isGizmoHovered = useWorkbenchStore((s) => s.isGizmoHovered);

  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const activeDraft = useWorkbenchStore((s) => s.activeDraft);

  // Table surface click starts marquee box selection (only on empty table)
  const handleTablePointerDown = (e: any) => {
    if (e.button !== 0 || e.shiftKey || isShiftPressed || activeDraft || isDraggingComponent || isGizmoHovered) return;
    // Only initiate marquee box selection if the table mat itself was clicked, not an object/gizmo in front
    if (e.intersections && e.intersections.length > 0 && e.intersections[0].object !== e.eventObject) {
      return;
    }
    e.stopPropagation();
    setMarqueeStart({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
  };

  // Deselect on clicking empty canvas outside table
  const handlePointerMissed = () => {
    if (!isShiftPressed && !activeDraft && !isDraggingComponent && !isGizmoHovered) {
      setSelectedComponentIds([]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/plain') as WorkbenchComponent['type'];
    if (type) {
      const rect = e.currentTarget.getBoundingClientRect();
      const xNorm = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const yNorm = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const worldX = Math.max(-2.0, Math.min(2.0, xNorm * 2.2));
      const worldZ = Math.max(-1.2, Math.min(1.2, -yNorm * 1.8));
      addComponent(type, [worldX, 0.005, worldZ]);
    }
  };

  return (
    <div
      className="w-full h-full relative select-none cursor-default"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Shift Key Display Rotation Indicator Banner */}
      {isShiftPressed && (
        <div className="absolute top-14 md:top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-cyan-600 text-white px-4 py-1.5 rounded-full font-bold text-xs shadow-xl flex items-center space-x-2 animate-pulse">
          <Compass className="w-4 h-4" />
          <span>Shift Active: Left Drag to Rotate 3D Display</span>
        </div>
      )}

      {/* 2D Marquee Selection Box Overlay */}
      {marqueeRect && (
        <div
          className="absolute pointer-events-none border-2 border-dashed border-cyan-500 bg-cyan-500/15 rounded z-30 shadow-sm"
          style={{
            left: marqueeRect.x,
            top: marqueeRect.y,
            width: marqueeRect.width,
            height: marqueeRect.height,
          }}
        />
      )}

      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: [0, 3.2, 4.25], fov: 50 }}
        onPointerMissed={handlePointerMissed}
      >
        {/* Pure White Background */}
        <color attach="background" args={['#ffffff']} />

        {/* Studio Lighting System */}
        <ambientLight intensity={0.9} />
        <directionalLight
          position={[5, 9, 4]}
          intensity={1.5}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={25}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
          shadow-bias={-0.0001}
        />
        <directionalLight position={[-5, 5, -4]} intensity={0.4} color="#e0f2fe" />
        <hemisphereLight groundColor="#f1f5f9" color="#ffffff" intensity={0.5} />

        {/* Dynamic Camera & Orbit Controller */}
        <CameraController />

        {/* Marquee Box Selection 3D Projection Manager */}
        <MarqueeManager
          isMarqueeActive={!!marqueeStart}
          startClientPos={marqueeStart}
          onMarqueeEnd={() => setMarqueeStart(null)}
          setMarqueeRect={setMarqueeRect}
        />

        {/* 3D Workbench Environment */}
        <group position={[0, 0, 0]}>
          {/* Main Tabletop (Clean Minimalist White Studio Bench) */}
          <mesh position={[0, -0.05, 0]} receiveShadow>
            <boxGeometry args={[6.0, 0.1, 3.8]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.05} />
          </mesh>

          {/* Antistatic ESD Work Mat (Clean Light Workbench Surface) with PointerDown for Marquee */}
          <mesh
            position={[0, 0.002, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            onPointerDown={handleTablePointerDown}
          >
            <planeGeometry args={[5.6, 3.4]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.5} metalness={0.02} />
          </mesh>

          {/* Precision Alignment Grid on Mat */}
          <gridHelper
            args={[4.8, 48, '#0284c7', '#cbd5e1']}
            position={[0, 0.004, 0]}
            raycast={() => null}
          />

          {/* Soft Ground Contact Shadows on White Table */}
          <ContactShadows
            position={[0, 0.001, 0]}
            opacity={0.28}
            scale={5.5}
            blur={2.0}
            far={1.2}
            color="#0f172a"
          />
        </group>

        {/* Render All 13 Workbench Components */}
        {components.map((component) => (
          <DraggableComponent key={component.id} component={component} />
        ))}

        {/* Render All 3D Organic Jumper Wires */}
        {wires.map((wire) => (
          <JumperWire3D key={wire.id} wire={wire} />
        ))}

        {/* Dynamic Interactive Wire Drafting */}
        <DraftWire3D />

        {/* 3D Component Rotation Gizmo Rings */}
        <ComponentTransformGizmo />

        {/* Actuator Real-Time Animations (Rotating Fan, LEDs, LCD Text) */}
        <ActuatorEffects />
      </Canvas>
    </div>
  );
};
