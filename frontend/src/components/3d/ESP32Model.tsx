import React, { useState, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { WorkbenchComponent, PinDefinition } from '../../types/workbench';
import { useWorkbenchStore } from '../../store/workbenchStore';

interface ESP32ModelProps {
  component: WorkbenchComponent;
  isSelected: boolean;
  onPointerDown: (e: any) => void;
}

/**
 * Procedurally generates the high-definition ESP-WROOM-32 RF metal shield texture
 * with authentic Espressif branding, laser-etched specs, FCC/CE markings, and Data Matrix.
 */
function createESP32ShieldTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // 1. Brushed Nickel / Tin Silver Metal Base
  ctx.fillStyle = '#d5d9df';
  ctx.fillRect(0, 0, size, size);

  // Directional brushed metal streaks
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  for (let i = 0; i < 120; i++) {
    const y = Math.random() * size;
    const h = 1.5 + Math.random() * 3;
    ctx.fillRect(0, y, size, h);
  }
  ctx.fillStyle = 'rgba(15, 23, 42, 0.05)';
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * size;
    const h = 1 + Math.random() * 2;
    ctx.fillRect(0, y, size, h);
  }

  // 2. Laser-Engraved Outer Rim & Bevel Line
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 6;
  ctx.strokeRect(28, 28, size - 56, size - 56);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, size - 72, size - 72);

  // Pin 1 Index Dot (top left corner)
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(75, 75, 14, 0, Math.PI * 2);
  ctx.fill();

  // 3. Espressif Emblem & Logo
  ctx.save();
  ctx.translate(512, 130);
  ctx.fillStyle = '#1e293b';
  for (let p = 0; p < 8; p++) {
    ctx.rotate((Math.PI * 2) / 8);
    ctx.beginPath();
    ctx.ellipse(0, 24, 6, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d5d9df';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // "ESPRESSIF" Text
  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'center';
  ctx.font = 'bold 36px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('ESPRESSIF', 512, 215);

  // 4. Large Module Title
  ctx.font = '900 66px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('ESP32-WROOM-32', 512, 305);

  // Subtitle
  ctx.font = '600 24px "Inter", sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('Wi-Fi + Bluetooth + BLE MCU Module', 512, 350);

  // Laser Divider Line
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(80, 385);
  ctx.lineTo(944, 385);
  ctx.stroke();

  // 5. Left Column: Regulatory IDs & Technical Specs
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 26px "JetBrains Mono", monospace';
  ctx.fillText('FCC ID: 2AC7Z-ESPWROOM32', 80, 455);
  ctx.fillText('IC: 21098-ESPWROOM32', 80, 508);
  ctx.fillText('CMIIT ID: 2016DP3252', 80, 560);
  ctx.fillText('KCC-CRM-es5-ESPWROOM32', 80, 612);

  ctx.font = '22px "JetBrains Mono", monospace';
  ctx.fillStyle = '#475569';
  ctx.fillText('FLASH: 4MB Quad-SPI  •  40MHz', 80, 685);
  ctx.fillText('SRAM: 520KB  •  Dual Core 240MHz', 80, 725);
  ctx.fillText('MAC: 24:6F:28:B4:9C:12', 80, 765);

  // 6. Right Column: Certification Badges & 2D Data Matrix
  // Authentic CE Mark
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(770, 495, 48, 0.75 * Math.PI, 1.25 * Math.PI, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(865, 495, 48, 0.75 * Math.PI, 1.25 * Math.PI, false);
  ctx.stroke();
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(815, 488, 36, 14);

  // RoHS Compliant Box
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.strokeRect(730, 575, 160, 44);
  ctx.font = 'bold 22px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RoHS Compliant', 810, 606);

  // 2D Data Matrix Barcode
  const bX = 730;
  const bY = 650;
  const bSize = 160;
  const cells = 12;
  const cellS = bSize / cells;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(bX, bY + bSize - cellS, bSize, cellS);
  ctx.fillRect(bX, bY, cellS, bSize);
  for (let c = 0; c < cells; c += 2) {
    ctx.fillRect(bX + c * cellS, bY, cellS, cellS);
    ctx.fillRect(bX + bSize - cellS, bY + c * cellS, cellS, cellS);
  }
  const seedMatrix = [
    [1,0,1,1,0,1,0,1,1,0],
    [0,1,1,0,1,0,1,0,0,1],
    [1,1,0,1,0,1,1,0,1,0],
    [0,0,1,0,1,1,0,1,1,1],
    [1,1,0,0,1,0,1,0,1,0],
    [0,1,1,1,0,1,0,1,0,1],
    [1,0,0,1,1,0,1,1,0,0],
    [0,1,1,0,0,1,0,0,1,1],
    [1,0,1,0,1,1,1,0,1,0],
    [0,1,0,1,0,0,1,1,0,1]
  ];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (seedMatrix[r][c]) {
        ctx.fillRect(bX + (c + 1) * cellS, bY + (r + 1) * cellS, cellS - 1, cellS - 1);
      }
    }
  }

  // 7. Bottom Model & Standard String
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.fillStyle = '#334155';
  ctx.fillText('DOIT ESP-32S DEVKIT V1  •  3.3V SYSTEM', 512, 880);
  ctx.font = '18px "JetBrains Mono", monospace';
  ctx.fillStyle = '#64748b';
  ctx.fillText('DESIGNED BY ESPRESSIF SYSTEMS  •  FCC PART 15.247', 512, 920);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedurally generates the high-definition ESP32 PCB Top Silkscreen Texture:
 * 1. Matte black FR4 substrate with solder mask border and ground plane thermal vias.
 * 2. 2.4GHz golden serpentine Inverted-F Antenna (MIFA) trace with keepout frame.
 * 3. 30 crisp silkscreen pin labels with color coding, solder pads, and pin indicators.
 * 4. Crisp silkscreen component outlines (CP2102, AMS1117, Crystal, USB).
 * 5. Button markings (EN / RESET, BOOT / IO0) and LED indicators (PWR, D2, TX, RX).
 */
function createESP32PCBTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 1728;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Matte Black PCB Base Substrate
  ctx.fillStyle = '#0f141d';
  ctx.fillRect(0, 0, width, height);

  // Outer Solder Mask Margin
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // Corner Mounting Holes with Copper Rings
  const mountHoles = [
    [79, 79],
    [945, 79],
    [79, 1649],
    [945, 1649],
  ];
  mountHoles.forEach(([hx, hy]) => {
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(hx, hy, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(hx, hy, 22, 0, Math.PI * 2);
    ctx.fill();
  });

  // 2. Antenna Keepout Region & Golden Serpentine Antenna
  ctx.fillStyle = '#1c130b';
  ctx.fillRect(70, 30, width - 140, 270);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(70, 30, width - 140, 270);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('2.4GHz Wi-Fi / BT Inverted-F Antenna', 512, 65);

  // Golden Serpentine Antenna Copper Trace
  const goldGrad = ctx.createLinearGradient(120, 0, 900, 0);
  goldGrad.addColorStop(0, '#d4af37');
  goldGrad.addColorStop(0.5, '#fbbf24');
  goldGrad.addColorStop(1, '#d4af37');

  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = 14;
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  // Feed & shunt stub
  ctx.moveTo(310, 280);
  ctx.lineTo(310, 140);
  ctx.moveTo(250, 280);
  ctx.lineTo(250, 140);
  ctx.lineTo(310, 140);
  // Serpentine turns
  ctx.lineTo(370, 140);
  ctx.lineTo(370, 240);
  ctx.lineTo(430, 240);
  ctx.lineTo(430, 140);
  ctx.lineTo(490, 140);
  ctx.lineTo(490, 240);
  ctx.lineTo(550, 240);
  ctx.lineTo(550, 140);
  ctx.lineTo(610, 140);
  ctx.lineTo(610, 240);
  ctx.lineTo(670, 240);
  ctx.lineTo(670, 140);
  ctx.lineTo(760, 140);
  ctx.lineTo(760, 210);
  ctx.stroke();

  // 3. Pin Header Solder Pads & Silkscreen Labels
  const leftPins = [
    { label: 'EN', type: 'ctrl' },
    { label: 'VP', type: 'adc' },
    { label: 'VN', type: 'adc' },
    { label: 'D34', type: 'adc' },
    { label: 'D35', type: 'adc' },
    { label: 'D32', type: 'adc' },
    { label: 'D33', type: 'adc' },
    { label: 'D25', type: 'dac' },
    { label: 'D26', type: 'gpio' },
    { label: 'D27', type: 'gpio' },
    { label: 'D14', type: 'gpio' },
    { label: 'D12', type: 'gpio' },
    { label: 'D13', type: 'gpio' },
    { label: 'GND', type: 'gnd' },
    { label: 'VIN', type: 'vcc' },
  ];

  const rightPins = [
    { label: '3V3', type: 'vcc' },
    { label: 'GND', type: 'gnd' },
    { label: 'D15', type: 'gpio' },
    { label: 'D2', type: 'gpio' },
    { label: 'D4', type: 'gpio' },
    { label: 'RX2', type: 'com' },
    { label: 'TX2', type: 'com' },
    { label: 'D5', type: 'gpio' },
    { label: 'D18', type: 'spi' },
    { label: 'D19', type: 'spi' },
    { label: 'D21', type: 'i2c' },
    { label: 'RX0', type: 'com' },
    { label: 'TX0', type: 'com' },
    { label: 'D22', type: 'i2c' },
    { label: 'D23', type: 'spi' },
  ];

  const yStart = 157.1;
  const yStep = 102.1;

  // Render Left Column Pins (at x = 79 center of header, labels at x = 145)
  leftPins.forEach((p, i) => {
    const py = yStart + i * yStep;

    // Gold solder pad underneath header pin
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(63, py - 16, 32, 32);
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(79, py, 6, 0, Math.PI * 2);
    ctx.fill();

    // White silkscreen tick line pointing from text to pad
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(102, py);
    ctx.lineTo(135, py);
    ctx.stroke();

    // Silkscreen Text
    ctx.textAlign = 'left';
    ctx.font = 'bold 24px "JetBrains Mono", monospace';
    if (p.type === 'vcc') ctx.fillStyle = '#f87171';
    else if (p.type === 'gnd') ctx.fillStyle = '#cbd5e1';
    else if (p.type === 'adc') ctx.fillStyle = '#34d399';
    else if (p.type === 'i2c') ctx.fillStyle = '#fde047';
    else if (p.type === 'com') ctx.fillStyle = '#38bdf8';
    else ctx.fillStyle = '#ffffff';

    ctx.fillText(p.label, 142, py + 8);
  });

  // Render Right Column Pins (at x = 945 center of header, labels at x = 882)
  rightPins.forEach((p, i) => {
    const py = yStart + i * yStep;

    // Gold solder pad underneath header pin
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(929, py - 16, 32, 32);
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(945, py, 6, 0, Math.PI * 2);
    ctx.fill();

    // White silkscreen tick line pointing from text to pad
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(922, py);
    ctx.lineTo(889, py);
    ctx.stroke();

    // Silkscreen Text
    ctx.textAlign = 'right';
    ctx.font = 'bold 24px "JetBrains Mono", monospace';
    if (p.type === 'vcc') ctx.fillStyle = '#f87171';
    else if (p.type === 'gnd') ctx.fillStyle = '#cbd5e1';
    else if (p.type === 'adc') ctx.fillStyle = '#34d399';
    else if (p.type === 'i2c') ctx.fillStyle = '#fde047';
    else if (p.type === 'com') ctx.fillStyle = '#38bdf8';
    else ctx.fillStyle = '#ffffff';

    ctx.fillText(p.label, 882, py + 8);
  });

  // 4. Center Board Title & Model Branding (Directly Below Metal Shield)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px "Inter", sans-serif';
  ctx.fillText('ESP32 DEVKIT V1', 512, 1145);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.fillText('NodeMCU-32S • 38-PIN MCU', 512, 1180);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px "Inter", sans-serif';
  ctx.fillText('Dual Xtensa® LX6 • 240MHz • 4MB FLASH', 512, 1210);

  // 5. Silicon Chip Component Outlines & Markings
  // CP2102 Bridge Chip Outline
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(422, 1235, 180, 150);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(436, 1250, 5, 0, Math.PI * 2);
  ctx.fill(); // Pin 1 index dot
  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.fillText('CP2102', 512, 1370);

  // AMS1117-3.3 Linear Regulator Outline
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(215, 1270, 140, 120);
  ctx.fillText('AMS1117-3.3', 285, 1375);

  // 40.000 MHz Crystal Oscillator Outline
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(670, 1260, 130, 80);
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.fillText('Y1 40.0MHz', 735, 1305);

  // 6. Push Buttons Silkscreen Boxes & Labels
  // EN (Reset) Button Box & Text
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(226, 1500, 100, 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px "Inter", sans-serif';
  ctx.fillText('EN', 276, 1635);
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.fillText('RESET', 276, 1660);

  // BOOT (GPIO 0) Button Box & Text
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(698, 1500, 100, 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px "Inter", sans-serif';
  ctx.fillText('BOOT', 748, 1635);
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.fillText('IO0', 748, 1660);

  // 7. Status LEDs Markings
  ctx.font = 'bold 20px "JetBrains Mono", monospace';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('PWR', 395, 1460);
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('IO2', 630, 1460);
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('TX/RX', 512, 1115);

  // Micro-USB Port Marking
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.fillText('USB / UART', 512, 1690);

  // 8. Decorative Copper Ground Thermal Vias (Golden dots with dark centers)
  const viaPositions = [
    [185, 340], [215, 360], [810, 340], [840, 360],
    [380, 1260], [380, 1310], [640, 1260], [640, 1310],
    [350, 1440], [675, 1440], [420, 1630], [605, 1630]
  ];
  viaPositions.forEach(([vx, vy]) => {
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(vx, vy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(vx, vy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export const ESP32Model: React.FC<ESP32ModelProps> = ({
  component,
  isSelected,
  onPointerDown,
}) => {
  const [hoveredPin, setHoveredPin] = useState<PinDefinition | null>(null);
  const [enButtonPressed, setEnButtonPressed] = useState(false);
  const [bootButtonPressed, setBootButtonPressed] = useState(false);

  const activeDraft = useWorkbenchStore((s) => s.activeDraft);
  const startWireDraft = useWorkbenchStore((s) => s.startWireDraft);
  const completeWireDraft = useWorkbenchStore((s) => s.completeWireDraft);
  const mcuState = useWorkbenchStore((s) => s.mcuState);
  const isResettingMCU = useWorkbenchStore((s) => s.isResettingMCU);
  const rebootMCU = useWorkbenchStore((s) => s.rebootMCU);
  const isSimulating = useWorkbenchStore((s) => s.isSimulating);
  const simulationTickCount = useWorkbenchStore((s) => s.simulationTickCount);

  // Board Dimensions
  const pcbWidth = 0.52;
  const pcbLength = 0.88;
  const pcbHeight = 0.03;

  // Cached Canvas Textures
  const pcbTexture = useMemo(() => createESP32PCBTexture(), []);
  const shieldTexture = useMemo(() => createESP32ShieldTexture(), []);

  // Blinking TX/RX activity logic
  const txRxActive = isSimulating && (simulationTickCount % 2 === 0);

  const handlePinClick = (e: any, pin: PinDefinition) => {
    e.stopPropagation();
    if (!activeDraft) {
      startWireDraft(component.id, pin.id);
    } else {
      completeWireDraft(component.id, pin.id);
    }
  };

  const handleEnClick = (e: any) => {
    e.stopPropagation();
    setEnButtonPressed(true);
    rebootMCU();
    setTimeout(() => setEnButtonPressed(false), 250);
  };

  const handleBootClick = (e: any) => {
    e.stopPropagation();
    setBootButtonPressed(true);
    setTimeout(() => setBootButtonPressed(false), 250);
  };

  return (
    <group onPointerDown={onPointerDown}>
      {/* 1. Main Matte Black PCB Substrate */}
      <mesh position={[0, pcbHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[pcbWidth, pcbHeight, pcbLength]} />
        <meshStandardMaterial
          color="#0f141d"
          roughness={0.4}
          metalness={0.15}
        />
      </mesh>

      {/* PCB High-Resolution Top Silkscreen Plane */}
      <mesh
        position={[0, pcbHeight + 0.0006, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        raycast={() => null}
      >
        <planeGeometry args={[pcbWidth, pcbLength]} />
        <meshStandardMaterial
          map={pcbTexture}
          roughness={0.35}
          metalness={0.12}
        />
      </mesh>

      {/* 2. ESP-WROOM-32 RF Metal Shield Can */}
      <group position={[0, pcbHeight + 0.02, -0.06]}>
        {/* Metal Stamped Can Body */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.34, 0.04, 0.36]} />
          <meshStandardMaterial
            color="#d1d5db"
            metalness={0.92}
            roughness={0.2}
          />
        </mesh>
        {/* High-Resolution Laser-Etched Shield Markings Face */}
        <mesh position={[0, 0.0205, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <planeGeometry args={[0.33, 0.35]} />
          <meshStandardMaterial
            map={shieldTexture}
            metalness={0.88}
            roughness={0.25}
          />
        </mesh>
      </group>

      {/* 3. Micro-USB Port (Bottom Edge, Overhanging with Real Connector Tongue) */}
      <group position={[0, pcbHeight + 0.02, pcbLength / 2 - 0.02]}>
        {/* Metallic Outer Shield */}
        <mesh castShadow>
          <boxGeometry args={[0.13, 0.05, 0.11]} />
          <meshStandardMaterial color="#e5e7eb" metalness={0.95} roughness={0.15} />
        </mesh>
        {/* Retention Spring Notches */}
        <mesh position={[-0.03, 0.026, 0]}>
          <boxGeometry args={[0.02, 0.002, 0.03]} />
          <meshBasicMaterial color="#475569" />
        </mesh>
        <mesh position={[0.03, 0.026, 0]}>
          <boxGeometry args={[0.02, 0.002, 0.03]} />
          <meshBasicMaterial color="#475569" />
        </mesh>
        {/* Interior Cavity */}
        <mesh position={[0, 0, 0.056]}>
          <boxGeometry args={[0.095, 0.028, 0.005]} />
          <meshBasicMaterial color="#090d16" />
        </mesh>
        {/* Black Plastic Center Tongue */}
        <mesh position={[0, -0.004, 0.052]}>
          <boxGeometry args={[0.065, 0.008, 0.02]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>
        {/* Gold Contact Fingers on Tongue */}
        {[-0.02, -0.01, 0, 0.01, 0.02].map((gx, idx) => (
          <mesh key={idx} position={[gx, 0.001, 0.054]} raycast={() => null}>
            <boxGeometry args={[0.004, 0.002, 0.012]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.2} />
          </mesh>
        ))}
      </group>

      {/* 4. CP2102 USB-to-UART Bridge Controller Chip (QFN-28 Package) */}
      <group position={[0, pcbHeight + 0.01, 0.22]}>
        <mesh castShadow>
          <boxGeometry args={[0.09, 0.02, 0.09]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} />
        </mesh>
        {/* Top Silicon Laser Marking */}
        <mesh position={[0, 0.0105, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <planeGeometry args={[0.08, 0.08]} />
          <meshBasicMaterial color="#334155" />
        </mesh>
      </group>

      {/* 5. 40.000 MHz Crystal Oscillator (Silver Metal Can near CP2102) */}
      <group position={[0.11, pcbHeight + 0.012, 0.16]}>
        <mesh castShadow>
          <boxGeometry args={[0.055, 0.018, 0.038]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.15} />
        </mesh>
        {/* 4 Gold Solder Pad Corners */}
        {[[-0.024, -0.016], [0.024, -0.016], [-0.024, 0.016], [0.024, 0.016]].map(([cx, cz], i) => (
          <mesh key={i} position={[cx, -0.008, cz]} raycast={() => null}>
            <boxGeometry args={[0.012, 0.004, 0.012]} />
            <meshStandardMaterial color="#d4af37" metalness={0.9} />
          </mesh>
        ))}
      </group>

      {/* 6. AMS1117-3.3 Linear Voltage Regulator (SOT-223 Package) */}
      <group position={[-0.12, pcbHeight + 0.012, 0.24]}>
        <mesh castShadow>
          <boxGeometry args={[0.07, 0.022, 0.07]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} />
        </mesh>
        {/* Metal Heat-Sink Tab */}
        <mesh position={[0, 0.005, -0.045]}>
          <boxGeometry args={[0.06, 0.01, 0.03]} />
          <meshStandardMaterial color="#d1d5db" metalness={0.92} roughness={0.2} />
        </mesh>
        {/* SOT-223 3 Pins */}
        {[-0.022, 0, 0.022].map((px, i) => (
          <mesh key={i} position={[px, -0.005, 0.042]}>
            <boxGeometry args={[0.012, 0.008, 0.016]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.92} roughness={0.2} />
          </mesh>
        ))}
      </group>

      {/* 7. 3D SMD 0805 Passives (Ceramic Capacitors & Resistors) */}
      {/* C1 & C2 Filter Capacitors near Voltage Regulator (Beige with silver endcaps) */}
      <group position={[-0.12, pcbHeight + 0.008, 0.32]}>
        <mesh castShadow>
          <boxGeometry args={[0.022, 0.014, 0.04]} />
          <meshStandardMaterial color="#c29b6a" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, -0.018]}>
          <boxGeometry args={[0.024, 0.015, 0.006]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.018]}>
          <boxGeometry args={[0.024, 0.015, 0.006]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.8} />
        </mesh>
      </group>

      {/* Pull-up Resistor for EN button */}
      <group position={[-0.08, pcbHeight + 0.008, 0.38]}>
        <mesh castShadow>
          <boxGeometry args={[0.032, 0.012, 0.018]} />
          <meshStandardMaterial color="#18181b" roughness={0.6} />
        </mesh>
        <mesh position={[-0.014, 0, 0]}>
          <boxGeometry args={[0.006, 0.013, 0.02]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
        </mesh>
        <mesh position={[0.014, 0, 0]}>
          <boxGeometry args={[0.006, 0.013, 0.02]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
        </mesh>
      </group>

      {/* 8. Dual Row 15-Pin Female Header Strips with 30 Individual Socket Holes */}
      {/* Left Header Body */}
      <mesh position={[-0.22, pcbHeight + 0.035, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.05, 0.07, 0.78]} />
        <meshStandardMaterial color="#18202c" roughness={0.65} />
      </mesh>
      {/* Right Header Body */}
      <mesh position={[0.22, pcbHeight + 0.035, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.05, 0.07, 0.78]} />
        <meshStandardMaterial color="#18202c" roughness={0.65} />
      </mesh>

      {/* 9. Interactive Tactile EN (Reset) Button */}
      <group
        position={[-0.14, pcbHeight + (enButtonPressed || isResettingMCU ? 0.015 : 0.025), 0.35]}
        onClick={handleEnClick}
        onPointerDown={(e) => {
          e.stopPropagation();
          setEnButtonPressed(true);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          setEnButtonPressed(false);
        }}
      >
        {/* Metal SMD Base */}
        <mesh castShadow>
          <boxGeometry args={[0.06, 0.025, 0.06]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Clickable Plunger */}
        <mesh position={[0, 0.016, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.015, 16]} />
          <meshStandardMaterial color={enButtonPressed || isResettingMCU ? '#38bdf8' : '#374151'} roughness={0.4} />
        </mesh>
      </group>

      {/* 10. Interactive Tactile BOOT (GPIO 0) Button */}
      <group
        position={[0.14, pcbHeight + (bootButtonPressed ? 0.015 : 0.025), 0.35]}
        onClick={handleBootClick}
        onPointerDown={(e) => {
          e.stopPropagation();
          setBootButtonPressed(true);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          setBootButtonPressed(false);
        }}
      >
        {/* Metal SMD Base */}
        <mesh castShadow>
          <boxGeometry args={[0.06, 0.025, 0.06]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Clickable Plunger */}
        <mesh position={[0, 0.016, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.015, 16]} />
          <meshStandardMaterial color={bootButtonPressed ? '#fbbf24' : '#374151'} roughness={0.4} />
        </mesh>
      </group>

      {/* 11. Live Interactive Indicator LEDs */}
      {/* Power LED (Red, 5V / 3.3V active) */}
      <group position={[-0.06, pcbHeight + 0.012, 0.32]}>
        <mesh>
          <boxGeometry args={[0.025, 0.015, 0.018]} />
          <meshStandardMaterial
            color={!isResettingMCU ? '#ef4444' : '#450a0a'}
            emissive={!isResettingMCU ? '#ef4444' : '#000000'}
            emissiveIntensity={!isResettingMCU ? 2.0 : 0.0}
            roughness={0.2}
          />
        </mesh>
        {!isResettingMCU && (
          <pointLight color="#ef4444" intensity={0.25} distance={0.4} />
        )}
      </group>

      {/* GPIO 2 User LED (Blue - Built-in LED) */}
      <group position={[0.06, pcbHeight + 0.012, 0.32]}>
        <mesh>
          <boxGeometry args={[0.025, 0.015, 0.018]} />
          <meshStandardMaterial
            color={mcuState.gpioStates.gpio2 && !isResettingMCU ? '#38bdf8' : '#082f49'}
            emissive={mcuState.gpioStates.gpio2 && !isResettingMCU ? '#0284c7' : '#000000'}
            emissiveIntensity={mcuState.gpioStates.gpio2 && !isResettingMCU ? 3.0 : 0.0}
            roughness={0.2}
          />
        </mesh>
        {mcuState.gpioStates.gpio2 && !isResettingMCU && (
          <pointLight color="#38bdf8" intensity={0.4} distance={0.5} />
        )}
      </group>

      {/* TX / RX Activity LEDs (Amber) */}
      <group position={[0, pcbHeight + 0.012, 0.14]}>
        <mesh>
          <boxGeometry args={[0.02, 0.012, 0.015]} />
          <meshStandardMaterial
            color={txRxActive ? '#f59e0b' : '#451a03'}
            emissive={txRxActive ? '#f59e0b' : '#000000'}
            emissiveIntensity={txRxActive ? 2.5 : 0.0}
          />
        </mesh>
      </group>

      {/* 12. Interactive Dual-Row Pin Terminals with Detailed Socket Apertures */}
      {component.pins.map((pin) => {
        const isDraftSource =
          activeDraft?.fromComponentId === component.id &&
          activeDraft?.fromPinId === pin.id;
        const isPinHovered = hoveredPin?.id === pin.id;

        let pinColor = '#3b82f6';
        if (pin.type === 'POWER_VCC') pinColor = '#ef4444';
        else if (pin.type === 'GROUND') pinColor = '#0f172a';
        else if (pin.type === 'ANALOG') pinColor = '#10b981';
        else if (pin.type === 'I2C') pinColor = '#eab308';

        return (
          <group key={pin.id} position={pin.relativePosition}>
            {/* Header Socket Aperture (Dark square hole) */}
            <mesh position={[0, 0.014, 0]} raycast={() => null}>
              <boxGeometry args={[0.026, 0.004, 0.026]} />
              <meshBasicMaterial color="#020617" />
            </mesh>

            {/* Gold Spring Contact Clip Glint Inside Socket */}
            <mesh position={[0, 0.008, 0]} raycast={() => null}>
              <boxGeometry args={[0.014, 0.012, 0.014]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.15} />
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
              <sphereGeometry args={[0.032, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Subtle Snap Ring on Hover or Active Wire Draft */}
            {(isPinHovered || isDraftSource) && (
              <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <ringGeometry args={[0.014, 0.028, 16]} />
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
                    style={{ backgroundColor: pinColor }}
                  />
                  <span className="font-bold text-sky-300">{pin.name}</span>
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* 13. Selection Bounding Wireframe (Raycast passes through) */}
      {isSelected && (
        <mesh position={[0, pcbHeight + 0.04, 0]} raycast={() => null}>
          <boxGeometry args={[pcbWidth + 0.06, 0.12, pcbLength + 0.06]} />
          <meshBasicMaterial color="#0284c7" wireframe transparent opacity={0.65} />
        </mesh>
      )}
    </group>
  );
};

