import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useGLTF, Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorkbenchComponent, PinDefinition } from '../../types/workbench';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { BreadboardModel } from './BreadboardModel';
import { LCD1602Model } from './LCD1602Model';
import { ESP32Model } from './ESP32Model';
import { PumpModel } from './PumpModel';
import { ACS712Model } from './ACS712Model';
import { ResistorModel } from './ResistorModel';
import { RelayModel } from './RelayModel';
import { DS18B20Model } from './DS18B20Model';

interface DraggableComponentProps {
  component: WorkbenchComponent;
}

const workplane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/** Subcomponent to lazily load GLTF models only when not using procedural models */
const GLBModel: React.FC<{ modelPath: string; scale?: [number, number, number] }> = ({
  modelPath,
  scale,
}) => {
  const { scene } = useGLTF(modelPath);
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone());
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
        }

        // Ensure 3D baked vertex colors and materials render brightly
        if (mesh.geometry && mesh.geometry.attributes.color) {
          const colorAttr = mesh.geometry.attributes.color;
          // Check if vertex colors are uniformly black/dark (e.g. Gmsh export artifact)
          let isTooDark = true;
          const sampleCount = Math.min(50, colorAttr.count);
          for (let i = 0; i < sampleCount; i++) {
            if (colorAttr.getX(i) > 0.18 || colorAttr.getY(i) > 0.18 || colorAttr.getZ(i) > 0.18) {
              isTooDark = false;
              break;
            }
          }

          if (!isTooDark) {
            // Baked GLBs with no explicit <material> fall back to three.js's
            // GLTFLoader default (metalness:1, roughness:1), which is nearly
            // fully reflective and washes the baked vertex colors out to a
            // flat, bland grey under this scene's simple lighting (no HDRI
            // environment map). Force a low-metalness, mid-roughness PCB/
            // plastic-like response so the actual vertex colors read clearly.
            // The MQ-2's sensing can is a low-poly grey dome that dominates the
            // mesh - a brighter, shinier metal response reads much better than
            // flat matte plastic and helps mask the faceted low-poly silhouette.
            const isShinyMetalCan = modelPath.includes('mq2');
            const tuneMaterial = (m: THREE.Material) => {
              m.vertexColors = true;
              if (m instanceof THREE.MeshStandardMaterial) {
                m.metalness = isShinyMetalCan ? 0.65 : Math.min(m.metalness, 0.25);
                m.roughness = isShinyMetalCan
                  ? 0.28
                  : Math.max(m.roughness > 0 && m.roughness < 1 ? m.roughness : 0.55, 0.4);
              }
              m.needsUpdate = true;
            };
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(tuneMaterial);
            } else if (mesh.material) {
              tuneMaterial(mesh.material);
            }
          } else {
            // Apply a vibrant, realistic industrial material instead of pitch-black
            mesh.material = new THREE.MeshStandardMaterial({
              color: '#1d4ed8',
              metalness: 0.35,
              roughness: 0.3,
            });
          }
        }
      }
    });
    return clone;
  }, [scene]);

  return <primitive object={clonedScene} scale={scale} />;
};

interface LEDGLBModelProps {
  modelPath: string;
  lensColor: string;
  glowColor: string;
  isLit: boolean;
  heightAxis: 'y' | 'z';
  leadLimit: number;
  leadXStretch?: number;
  leadStretchLimit?: number;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale: [number, number, number];
}

const LEDGLBModel: React.FC<LEDGLBModelProps> = ({
  modelPath,
  lensColor,
  glowColor,
  isLit,
  heightAxis,
  leadLimit,
  leadXStretch = 1,
  leadStretchLimit = leadLimit,
  position,
  rotation = [0, 0, 0],
  scale,
}) => {
  const { scene } = useGLTF(modelPath);
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const geometry = mesh.geometry.clone();
        const position = geometry.getAttribute('position');
        const colors: number[] = [];

        for (let index = 0; index < position.count; index++) {
          const localHeight = heightAxis === 'z' ? position.getZ(index) : position.getY(index);
          if (localHeight < leadStretchLimit) {
            position.setX(index, position.getX(index) * leadXStretch);
          }
          const color = new THREE.Color(localHeight < leadLimit ? '#cbd5e1' : lensColor);
          colors.push(color.r, color.g, color.b);
        }

        position.needsUpdate = true;
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        mesh.geometry = geometry;
        mesh.material = new THREE.MeshStandardMaterial({
          color: '#ffffff',
          vertexColors: true,
          emissive: isLit ? glowColor : '#000000',
          emissiveIntensity: isLit ? 0.04 : 0,
          metalness: 0.18,
          roughness: 0.24,
        });
      }
    });
    return clone;
  }, [scene, heightAxis, leadLimit, leadXStretch, leadStretchLimit, lensColor, glowColor, isLit]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={clonedScene} />
      {isLit && <pointLight color={lensColor} intensity={0.08} distance={0.1} decay={2} />}
    </group>
  );
};

export const DraggableComponent: React.FC<DraggableComponentProps> = ({ component }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastPlanePos = useRef<THREE.Vector3 | null>(null);

  const { gl, camera } = useThree();

  const selectedIds = useWorkbenchStore((s) => s.selectedComponentIds);
  const setSelectedComponentIds = useWorkbenchStore((s) => s.setSelectedComponentIds);
  const toggleComponentSelection = useWorkbenchStore((s) => s.toggleComponentSelection);
  const moveComponentsDelta = useWorkbenchStore((s) => s.moveComponentsDelta);
  const setIsDraggingComponent = useWorkbenchStore((s) => s.setIsDraggingComponent);
  const isGizmoHovered = useWorkbenchStore((s) => s.isGizmoHovered);
  const activeDraft = useWorkbenchStore((s) => s.activeDraft);
  const startWireDraft = useWorkbenchStore((s) => s.startWireDraft);
  const completeWireDraft = useWorkbenchStore((s) => s.completeWireDraft);
  const telemetry = useWorkbenchStore((s) => s.telemetry);

  const isSelected = selectedIds.includes(component.id);

  const handlePinClick = (e: any, pin: PinDefinition) => {
    e.stopPropagation();
    if (!activeDraft) {
      startWireDraft(component.id, pin.id);
    } else {
      completeWireDraft(component.id, pin.id);
    }
  };

  // Hyper-responsive pointer down with direct NDC raycast
  const handlePointerDown = (e: any) => {
    if (e.button !== 0) return; // Only primary left click
    if (isGizmoHovered) return; // Prioritize 3D Gizmo handle interaction over component plane drag
    e.stopPropagation();

    // If wire draft is active, clicking the component connects to nearest pin!
    if (activeDraft) {
      if (groupRef.current && component.pins.length > 0) {
        const local = groupRef.current.worldToLocal(e.point.clone());
        let closest = component.pins[0];
        let minDistSq = Infinity;
        for (const p of component.pins) {
          const dx = p.relativePosition[0] - local.x;
          const dy = p.relativePosition[1] - local.y;
          const dz = p.relativePosition[2] - local.z;
          const dSq = dx * dx + dy * dy + dz * dz;
          if (dSq < minDistSq) {
            minDistSq = dSq;
            closest = p;
          }
        }
        if (closest) {
          handlePinClick(e, closest);
        }
      }
      return;
    }

    if (e.shiftKey) {
      toggleComponentSelection(component.id, true);
      return;
    }

    if (!selectedIds.includes(component.id)) {
      setSelectedComponentIds([component.id]);
    }

    const rect = gl.domElement.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const intersection = new THREE.Vector3();
    if (ray.ray.intersectPlane(workplane, intersection)) {
      lastPlanePos.current = intersection.clone();
    }

    setIsDragging(true);
    setIsDraggingComponent(true);
  };

  // Instantaneous 120 FPS window tracking during active drag
  useEffect(() => {
    if (!isDragging) return;

    const onWindowPointerMove = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const intersection = new THREE.Vector3();

      if (ray.ray.intersectPlane(workplane, intersection)) {
        if (!lastPlanePos.current) {
          lastPlanePos.current = intersection.clone();
          return;
        }
        const deltaX = intersection.x - lastPlanePos.current.x;
        const deltaZ = intersection.z - lastPlanePos.current.z;

        if (Math.abs(deltaX) > 0.001 || Math.abs(deltaZ) > 0.001) {
          moveComponentsDelta(deltaX, deltaZ);
          lastPlanePos.current.copy(intersection);
        }
      }
    };

    const onWindowPointerUp = () => {
      setIsDragging(false);
      setIsDraggingComponent(false);
      lastPlanePos.current = null;
    };

    window.addEventListener('pointermove', onWindowPointerMove, { passive: true });
    window.addEventListener('pointerup', onWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
    };
  }, [isDragging, gl, camera, moveComponentsDelta, setIsDraggingComponent]);

  // If breadboard, render high-fidelity dedicated model
  if (component.type === 'breadboard') {
    return (
      <group
        ref={groupRef}
        position={component.position}
        rotation={component.rotation}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => {
          setHovered(false);
        }}
      >
        <BreadboardModel
          component={component}
          isSelected={isSelected}
          onPointerDown={handlePointerDown}
        />
      </group>
    );
  }

  // Dedicated procedural high-fidelity 16x2 I2C LCD Screen
  if (component.type === 'lcd_1602') {
    return (
      <group
        ref={groupRef}
        position={component.position}
        rotation={component.rotation}
        scale={component.scale}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => {
          setHovered(false);
        }}
      >
        <LCD1602Model
          component={component}
          isSelected={isSelected}
          onPointerDown={handlePointerDown}
        />
      </group>
    );
  }

  // Dedicated procedural high-fidelity ESP32 DevKit V1 Board
  if (component.type === 'esp32') {
    return (
      <group
        ref={groupRef}
        position={component.position}
        rotation={component.rotation}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => {
          setHovered(false);
        }}
      >
        <ESP32Model
          component={component}
          isSelected={isSelected}
          onPointerDown={handlePointerDown}
        />
      </group>
    );
  }

  // Dedicated procedural high-fidelity 5V Submersible Pump Model
  if (component.type === 'pump') {
    return (
      <group
        ref={groupRef}
        position={component.position}
        rotation={component.rotation}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => {
          setHovered(false);
        }}
      >
        <PumpModel
          component={component}
          isSelected={isSelected}
          onPointerDown={handlePointerDown}
        />
      </group>
    );
  }

  // Dedicated procedural high-fidelity ACS712 Current Sensor Board
  if (component.type === 'acs712') {
    return (
      <group
        ref={groupRef}
        position={component.position}
        rotation={component.rotation}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => {
          setHovered(false);
        }}
      >
        <ACS712Model
          component={component}
          isSelected={isSelected}
          onPointerDown={handlePointerDown}
        />
      </group>
    );
  }

  // Dedicated procedural high-fidelity DS18B20 TO-92 Temperature Sensor
  if (component.type === 'ds18b20') {
    return (
      <group
        ref={groupRef}
        position={component.position}
        rotation={component.rotation}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => {
          setHovered(false);
        }}
      >
        <DS18B20Model
          component={component}
          isSelected={isSelected}
          onPointerDown={handlePointerDown}
        />
      </group>
    );
  }

  // Dedicated procedural high-fidelity 1/4W Resistor
  if (component.type === 'resistor') {
    return (
      <group
        ref={groupRef}
        position={component.position}
        rotation={component.rotation}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => {
          setHovered(false);
        }}
      >
        <ResistorModel
          component={component}
          isSelected={isSelected}
          onPointerDown={handlePointerDown}
        />
      </group>
    );
  }

  if (component.type === 'led_green') {
    const isLit = telemetry.pump_active || telemetry.valve_open;

    return (
      <group
        ref={groupRef}
        position={component.position}
        rotation={component.rotation}
        onPointerDown={handlePointerDown}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => {
          setHovered(false);
        }}
      >
        <LEDGLBModel
          modelPath="/models/led_green.glb"
          lensColor="#22c55e"
          glowColor="#052e16"
          isLit={isLit}
          heightAxis="y"
          leadLimit={0}
          leadXStretch={10.3621608467}
          leadStretchLimit={-4}
          position={[0, 0.084, 0]}
          scale={[0.003, 0.003, 0.003]}
        />

        {isSelected && (
          <mesh position={[0, 0.038, 0]} raycast={() => null}>
            <boxGeometry args={[0.024, 0.11, 0.024]} />
            <meshBasicMaterial color="#0284c7" wireframe transparent opacity={0.65} />
          </mesh>
        )}

        {component.pins.map((pin) => {
          const isAnode = pin.id === 'anode';
          const isDraftSource =
            activeDraft?.fromComponentId === component.id &&
            activeDraft?.fromPinId === pin.id;
          const isPinHovered = hoveredPin === pin.id;

          return (
            <group key={pin.id} position={pin.relativePosition}>
              <mesh
                onPointerDown={(e) => {
                  e.stopPropagation();
                  handlePinClick(e, pin);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHoveredPin(pin.id);
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  setHoveredPin(null);
                }}
              >
                <sphereGeometry args={[0.018, 12, 12]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>

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

              {isPinHovered && (
                <Html position={[0, 0.03, 0]} center zIndexRange={[50, 100]}>
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
      </group>
    );
  }

  if (component.type === 'led_red') {
    const isLit = telemetry.status_class === 2;

    return (
      <group
        ref={groupRef}
        position={component.position}
        rotation={component.rotation}
        onPointerDown={handlePointerDown}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => {
          setHovered(false);
        }}
      >
        <LEDGLBModel
          modelPath="/models/led_red.glb"
          lensColor="#ef4444"
          glowColor="#450a0a"
          isLit={isLit}
          heightAxis="y"
          leadLimit={0.18}
          position={[0, 0, 0]}
          scale={[0.17, 0.17, 0.17]}
        />

        {isSelected && (
          <mesh position={[0, 0.038, 0]} raycast={() => null}>
            <boxGeometry args={[0.024, 0.11, 0.024]} />
            <meshBasicMaterial color="#0284c7" wireframe transparent opacity={0.65} />
          </mesh>
        )}

        {component.pins.map((pin) => {
          const isAnode = pin.id === 'anode';
          const isDraftSource =
            activeDraft?.fromComponentId === component.id &&
            activeDraft?.fromPinId === pin.id;
          const isPinHovered = hoveredPin === pin.id;

          return (
            <group key={pin.id} position={pin.relativePosition}>
              <mesh
                onPointerDown={(e) => {
                  e.stopPropagation();
                  handlePinClick(e, pin);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHoveredPin(pin.id);
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  setHoveredPin(null);
                }}
              >
                <sphereGeometry args={[0.018, 12, 12]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>

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

              {isPinHovered && (
                <Html position={[0, 0.03, 0]} center zIndexRange={[50, 100]}>
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
      </group>
    );
  }

  // Dedicated procedural high-fidelity 5V Relay / Valve Driver Module
  if (component.type === 'relay' || component.type === 'valve') {
    return (
      <group
        ref={groupRef}
        position={component.position}
        rotation={component.rotation}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => {
          setHovered(false);
        }}
      >
        <RelayModel
          component={component}
          isSelected={isSelected}
          onPointerDown={handlePointerDown}
        />
      </group>
    );
  }

  return (
    <group
      ref={groupRef}
      position={component.position}
      rotation={component.rotation}
      scale={component.scale}
      onPointerDown={handlePointerDown}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => {
        setHovered(false);
      }}
    >
      {/* 3D Model with Baked Colors - scale is applied on the parent group so
          the interactive pins below (and jumper wire endpoints, which read the
          same component.scale) move in lockstep with the mesh. */}
      <GLBModel modelPath={component.modelPath} />

      {/* Tinkercad Selection Bounding Box & Halo - raycast passes through to pins */}
      {(isSelected || hovered) && (
        <mesh position={[0, 0.08, 0]} raycast={() => null}>
          <boxGeometry args={[0.55, 0.18, 0.55]} />
          <meshBasicMaterial
            color={isSelected ? '#38bdf8' : '#64748b'}
            wireframe
            transparent
            opacity={isSelected ? 0.65 : 0.25}
          />
        </mesh>
      )}

      {/* Floating Component Name Tag on Hover */}
      {hovered && !isSelected && !hoveredPin && !isDragging && !activeDraft && (
        <Html position={[0, 0.35, 0]} center zIndexRange={[0, 10]}>
          <div className="bg-slate-900/95 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-xl border border-slate-700 whitespace-nowrap pointer-events-none flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>{component.name}</span>
          </div>
        </Html>
      )}

      {/* Interactive Pin Terminals */}
      {component.pins.map((pin) => {
        const isDraftSource =
          activeDraft?.fromComponentId === component.id &&
          activeDraft?.fromPinId === pin.id;
        const isPinHovered = hoveredPin === pin.id;

        let pinColor = '#3b82f6';
        if (pin.type === 'POWER_VCC') pinColor = '#ef4444';
        else if (pin.type === 'GROUND') pinColor = '#0f172a';
        else if (pin.type === 'ANALOG') pinColor = '#10b981';
        else if (pin.type === 'I2C') pinColor = '#f59e0b';
        else if (pin.type === 'RELAY_CONTACT') pinColor = '#f97316';

        return (
          <group key={pin.id} position={pin.relativePosition}>
            {/* Physical 3D Gold Terminal Pin Post */}
            <mesh position={[0, -0.006, 0]} castShadow>
              <cylinderGeometry args={[0.007, 0.007, 0.024, 8]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.92} roughness={0.16} />
            </mesh>
            {/* Color-Coded Terminal Collar */}
            <mesh position={[0, -0.016, 0]}>
              <cylinderGeometry args={[0.012, 0.014, 0.005, 12]} />
              <meshStandardMaterial color={pinColor} roughness={0.35} metalness={0.5} />
            </mesh>

            {/* Invisible Raycast Hit Target */}
            <mesh
              onPointerDown={(e) => {
                e.stopPropagation();
                handlePinClick(e, pin);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredPin(pin.id);
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                setHoveredPin(null);
              }}
            >
              <sphereGeometry args={[0.038, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Subtle Visual Snap Ring - ONLY visible when Hovered or Draft Source */}
            {(isPinHovered || isDraftSource) && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <ringGeometry args={[0.012, 0.028, 16]} />
                <meshBasicMaterial
                  color={isDraftSource ? '#f59e0b' : '#38bdf8'}
                  transparent
                  opacity={0.9}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}

            {/* Pin Tooltip */}
            {isPinHovered && (
              <Html position={[0, 0.08, 0]} center zIndexRange={[0, 10]}>
                <div className="bg-slate-950/95 text-xs text-white px-2 py-1 rounded shadow-lg border border-cyan-500/50 whitespace-nowrap pointer-events-none flex items-center space-x-1.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: pinColor }}
                  />
                  <span className="font-bold text-cyan-300">{pin.name}</span>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
};
