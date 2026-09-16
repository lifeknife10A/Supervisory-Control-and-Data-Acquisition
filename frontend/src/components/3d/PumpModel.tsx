import React, { useState, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { WorkbenchComponent, PinDefinition } from '../../types/workbench';
import { useWorkbenchStore } from '../../store/workbenchStore';

interface PumpModelProps {
  component: WorkbenchComponent;
  isSelected: boolean;
  onPointerDown: (e: any) => void;
}

/**
 * Procedurally generates the high-definition brushed aluminum industrial rating nameplate
 * for the pump junction box with specifications, wiring diagram, CE, and QC marks.
 */
function createPumpNameplateTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 640;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Brushed Aluminum Base Plate
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, width, height);

  // Brushed metal directional grain
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  for (let i = 0; i < 80; i++) {
    const y = Math.random() * height;
    ctx.fillRect(0, y, width, 1.5 + Math.random() * 2);
  }
  ctx.fillStyle = 'rgba(30, 41, 59, 0.05)';
  for (let i = 0; i < 60; i++) {
    const y = Math.random() * height;
    ctx.fillRect(0, y, width, 1 + Math.random() * 2);
  }

  // 2. Industrial Outer Border & Corner Rivet Holes
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 8;
  ctx.strokeRect(16, 16, width - 32, height - 32);

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, width - 52, height - 52);

  // Corner Mounting Screws/Rivets
  [[42, 42], [width - 42, 42], [42, height - 42], [width - 42, height - 42]].forEach(([rx, ry]) => {
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(rx, ry, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Screw slot
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rx - 8, ry);
    ctx.lineTo(rx + 8, ry);
    ctx.stroke();
  });

  // 3. Header Ribbon Banner
  ctx.fillStyle = '#1e40af';
  ctx.fillRect(32, 32, width - 64, 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 32px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SCADA INDUSTRIAL PROCESS PUMP', width / 2, 78);

  // 4. Model Designation
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 44px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('MODEL: DP-5V-120L SUBMERSIBLE', width / 2, 160);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 185);
  ctx.lineTo(width - 60, 185);
  ctx.stroke();

  // 5. Technical Ratings Grid
  ctx.textAlign = 'left';
  ctx.font = 'bold 26px "JetBrains Mono", monospace';
  ctx.fillStyle = '#1e293b';

  ctx.fillText('RATED VOLTAGE : 5.0V DC (3.5V - 6.0V)', 70, 235);
  ctx.fillText('RATED CURRENT : 0.35A (MAX 0.40A)', 70, 280);
  ctx.fillText('INPUT POWER   : 1.75 WATTS', 70, 325);
  ctx.fillText('MAX FLOW RATE : 120 LITERS / HOUR', 70, 370);
  ctx.fillText('MAX HEAD LIFT : 1.6 METERS (5.2 FT)', 70, 415);
  ctx.fillText('ENCLOSURE     : IP68 (SUBMERSIBLE 2M)', 70, 460);

  // 6. Right Column: Certification Badges & Wiring Diagram
  // Authentic CE Mark
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(840, 255, 36, 0.75 * Math.PI, 1.25 * Math.PI, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(905, 255, 36, 0.75 * Math.PI, 1.25 * Math.PI, false);
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(870, 250, 24, 10);

  // QC Passed Stamp (Green Circular Seal)
  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(870, 365, 45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#16a34a';
  ctx.font = '900 20px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('QC PASSED', 870, 360);
  ctx.font = 'bold 16px monospace';
  ctx.fillText('FINAL TEST', 870, 385);

  // 7. Wiring Pinout Legend Box at Bottom
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(60, 500, width - 120, 95);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 500, width - 120, 95);

  ctx.textAlign = 'left';
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.fillStyle = '#dc2626';
  ctx.fillText('● RED WIRE  : PIN 1 - +5V DC RELAY SWITCHED', 85, 538);
  ctx.fillStyle = '#0f172a';
  ctx.fillText('● BLACK WIRE: PIN 2 - GROUND (GND)', 85, 574);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export const PumpModel: React.FC<PumpModelProps> = ({
  component,
  isSelected,
  onPointerDown,
}) => {
  const [hoveredPin, setHoveredPin] = useState<PinDefinition | null>(null);

  const activeDraft = useWorkbenchStore((s) => s.activeDraft);
  const startWireDraft = useWorkbenchStore((s) => s.startWireDraft);
  const completeWireDraft = useWorkbenchStore((s) => s.completeWireDraft);
  const telemetry = useWorkbenchStore((s) => s.telemetry);

  const isPumpActive = telemetry.pump_active;
  const nameplateTexture = useMemo(() => createPumpNameplateTexture(), []);

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
      {/* 1. Main Motor Casing (Industrial Siemens Blue Powder-Coated Cast Aluminum) */}
      <group position={[0, 0.20, 0]}>
        {/* Main Horizontal Cylinder Body */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.52, 36]} />
          <meshStandardMaterial
            color="#1d4ed8"
            metalness={0.4}
            roughness={0.28}
          />
        </mesh>

        {/* Circumferential Cooling Fin Ribs (Rich Mechanical Depth) */}
        {[-0.18, -0.10, -0.02, 0.06, 0.14].map((zPos, idx) => (
          <mesh key={idx} position={[0, 0, zPos]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.188, 0.188, 0.018, 36]} />
            <meshStandardMaterial
              color="#2563eb"
              metalness={0.45}
              roughness={0.25}
            />
          </mesh>
        ))}

        {/* Rear End-Bell Cap (Machined Cast Housing) */}
        <mesh position={[0, 0, -0.27]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.185, 0.185, 0.035, 36]} />
          <meshStandardMaterial
            color="#1e3a8a"
            metalness={0.5}
            roughness={0.3}
          />
        </mesh>
        {/* Rear Bearing Hub Retainer */}
        <mesh position={[0, 0, -0.295]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.065, 0.065, 0.02, 24]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Rear Center Brass Bushing */}
        <mesh position={[0, 0, -0.306]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.006, 16]} />
          <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* 2. Front Mounting Flange Plate & Bolts */}
        <mesh position={[0, 0, 0.27]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.205, 0.205, 0.03, 36]} />
          <meshStandardMaterial
            color="#cbd5e1"
            metalness={0.85}
            roughness={0.22}
          />
        </mesh>

        {/* 4 Hexagonal Zinc-Plated Mounting Bolts on Flange */}
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => {
          const bx = Math.cos(angle) * 0.16;
          const by = Math.sin(angle) * 0.16;
          return (
            <group key={i} position={[bx, by, 0.29]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.016, 0.016, 0.018, 6]} />
                <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.15} />
              </mesh>
            </group>
          );
        })}

        {/* 3. Front Discharge Nozzle / Machined Output Shaft */}
        <group position={[0, 0, 0.38]}>
          {/* Stepped Base Collar */}
          <mesh position={[0, 0, -0.06]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.10, 0.10, 0.04, 32]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.88} roughness={0.2} />
          </mesh>
          {/* Polished Stainless Steel Nozzle Tube */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.075, 0.16, 32]} />
            <meshStandardMaterial color="#f8fafc" metalness={0.95} roughness={0.1} />
          </mesh>
          {/* Hollow Fluid Port Opening at Tip */}
          <mesh position={[0, 0, 0.081]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.055, 0.055, 0.005, 32]} />
            <meshBasicMaterial color="#090d16" />
          </mesh>

          {/* Active Fluid Flow Glow Effect when Energized */}
          {isPumpActive && (
            <>
              <mesh position={[0, 0, 0.085]} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.01, 0.05, 24]} />
                <meshBasicMaterial color="#38bdf8" transparent opacity={0.85} side={THREE.DoubleSide} />
              </mesh>
              <pointLight position={[0, 0, 0.12]} color="#38bdf8" intensity={0.6} distance={0.6} />
            </>
          )}
        </group>
      </group>

      {/* 4. Top Terminal / Junction Box with Rating Nameplate */}
      <group position={[0, 0.38, -0.02]}>
        {/* Cast Aluminum Terminal Box Base */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.24, 0.08, 0.30]} />
          <meshStandardMaterial
            color="#1e3a8a"
            metalness={0.45}
            roughness={0.3}
          />
        </mesh>
        {/* Gasket Seal Trim */}
        <mesh position={[0, 0.038, 0]}>
          <boxGeometry args={[0.245, 0.006, 0.305]} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} />
        </mesh>

        {/* High-Resolution Metallic Rating Nameplate on Top Cover */}
        <mesh position={[0, 0.042, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <planeGeometry args={[0.23, 0.28]} />
          <meshStandardMaterial
            map={nameplateTexture}
            metalness={0.75}
            roughness={0.25}
          />
        </mesh>

        {/* 4 Corner Screws on Terminal Box Cover */}
        {[[-0.10, -0.13], [0.10, -0.13], [-0.10, 0.13], [0.10, 0.13]].map(([cx, cz], i) => (
          <mesh key={i} position={[cx, 0.044, cz]} raycast={() => null}>
            <cylinderGeometry args={[0.007, 0.007, 0.004, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
        ))}

        {/* Live Running Status LED Indicator */}
        <group position={[0.085, 0.046, 0.10]}>
          <mesh>
            <cylinderGeometry args={[0.012, 0.012, 0.008, 16]} />
            <meshStandardMaterial
              color={isPumpActive ? '#22c55e' : '#14532d'}
              emissive={isPumpActive ? '#22c55e' : '#000000'}
              emissiveIntensity={isPumpActive ? 3.0 : 0.0}
              roughness={0.2}
            />
          </mesh>
          {isPumpActive && (
            <pointLight color="#22c55e" intensity={0.5} distance={0.5} />
          )}
        </group>

        {/* Rubber Cable Gland Strain Relief on Front Face */}
        <mesh position={[0, -0.01, 0.16]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.035, 0.035, 8]} />
          <meshStandardMaterial color="#090d16" roughness={0.8} />
        </mesh>
      </group>

      {/* 5. Stamped Steel Mounting Base Bracket with Rubber Dampeners */}
      <group position={[0, 0.015, 0]}>
        {/* Base Steel Plate */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.44, 0.02, 0.42]} />
          <meshStandardMaterial
            color="#334155"
            metalness={0.55}
            roughness={0.35}
          />
        </mesh>
        {/* 4 Rubber Anti-Vibration Feet with Center Fastener Washers */}
        {[[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]].map(([fx, fz], idx) => (
          <group key={idx} position={[fx, -0.005, fz]}>
            {/* Rubber Bushing */}
            <mesh castShadow>
              <cylinderGeometry args={[0.032, 0.035, 0.02, 16]} />
              <meshStandardMaterial color="#090d16" roughness={0.9} />
            </mesh>
            {/* Silver Washer & Bolt Hole */}
            <mesh position={[0, 0.011, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.004, 16]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 6. Realistic Red & Black Rubber Wiring Leads */}
      {/* Red Lead Wire (VCC) */}
      <mesh castShadow raycast={() => null}>
        <tubeGeometry
          args={[
            new THREE.CatmullRomCurve3([
              new THREE.Vector3(-0.015, 0.36, 0.16),
              new THREE.Vector3(-0.06, 0.28, 0.24),
              new THREE.Vector3(-0.12, 0.15, 0.30),
              new THREE.Vector3(-0.15, 0.05, 0.35),
            ]),
            24,
            0.009,
            8,
            false,
          ]}
        />
        <meshStandardMaterial color="#dc2626" roughness={0.45} />
      </mesh>

      {/* Black Lead Wire (GND) */}
      <mesh castShadow raycast={() => null}>
        <tubeGeometry
          args={[
            new THREE.CatmullRomCurve3([
              new THREE.Vector3(0.015, 0.36, 0.16),
              new THREE.Vector3(0.06, 0.28, 0.24),
              new THREE.Vector3(0.12, 0.15, 0.30),
              new THREE.Vector3(0.15, 0.05, 0.35),
            ]),
            24,
            0.009,
            8,
            false,
          ]}
        />
        <meshStandardMaterial color="#0f172a" roughness={0.45} />
      </mesh>

      {/* 7. Interactive Terminal Block Connection Pins */}
      {component.pins.map((pin) => {
        const isDraftSource =
          activeDraft?.fromComponentId === component.id &&
          activeDraft?.fromPinId === pin.id;
        const isPinHovered = hoveredPin?.id === pin.id;
        const isVcc = pin.type === 'POWER_VCC';

        return (
          <group key={pin.id} position={pin.relativePosition}>
            {/* Terminal Block Collar */}
            <mesh position={[0, -0.015, 0]} castShadow raycast={() => null}>
              <cylinderGeometry args={[0.022, 0.022, 0.03, 16]} />
              <meshStandardMaterial color={isVcc ? '#991b1b' : '#020617'} roughness={0.6} />
            </mesh>

            {/* Brass / Gold Screw Terminal Post */}
            <mesh position={[0, 0.005, 0]} castShadow raycast={() => null}>
              <cylinderGeometry args={[0.012, 0.012, 0.02, 12]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.92} roughness={0.18} />
            </mesh>

            {/* Invisible Raycast Hit Target Sphere */}
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
              <sphereGeometry args={[0.036, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Subtle Snap Ring on Hover or Active Wire Draft */}
            {(isPinHovered || isDraftSource) && (
              <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <ringGeometry args={[0.014, 0.032, 16]} />
                <meshBasicMaterial
                  color={isDraftSource ? '#f59e0b' : '#38bdf8'}
                  transparent
                  opacity={0.9}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}

            {/* Tooltip on Pin Hover */}
            {isPinHovered && (
              <Html position={[0, 0.08, 0]} center>
                <div className="bg-slate-950/95 text-xs text-white px-2 py-1 rounded shadow-lg border border-sky-400 whitespace-nowrap pointer-events-none flex items-center space-x-1.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: isVcc ? '#ef4444' : '#0f172a' }}
                  />
                  <span className="font-bold text-sky-300">{pin.name}</span>
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* 8. Selection Bounding Wireframe (Raycast passes through) */}
      {isSelected && (
        <mesh position={[0, 0.22, 0.04]} raycast={() => null}>
          <boxGeometry args={[0.48, 0.44, 0.88]} />
          <meshBasicMaterial color="#0284c7" wireframe transparent opacity={0.65} />
        </mesh>
      )}
    </group>
  );
};
