import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorkbenchStore } from '../../store/workbenchStore';

export const ActuatorEffects: React.FC = () => {
  const telemetry = useWorkbenchStore((s) => s.telemetry);
  const components = useWorkbenchStore((s) => s.components);
  const circuitHealth = useWorkbenchStore((s) => s.circuitHealth);

  const fanComp = components.find((c) => c.type === 'fan');
  const ledGreenComp = components.find((c) => c.type === 'led_green');
  const ledRedComp = components.find((c) => c.type === 'led_red');

  const fanBladesRef = useRef<THREE.Group>(null);

  // Fan rotation animation - ONLY runs when fan_active is true and fan is wired
  useFrame((_, delta) => {
    if (fanBladesRef.current && telemetry.fan_active && circuitHealth.devices.fanActuator.connected) {
      fanBladesRef.current.rotation.z += delta * 25; // 25 rad/s fast spin
    }
  });

  return (
    <group>
      {/* 1. Rotating Fan Blades Effect */}
      {fanComp && (
        <group position={fanComp.position} rotation={fanComp.rotation}>
          <group ref={fanBladesRef} position={[0, 0.08, 0]}>
            {/* 4 Fan Blades */}
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
                <boxGeometry args={[0.04, 0.18, 0.008]} />
                <meshStandardMaterial
                  color="#334155"
                  roughness={0.4}
                  metalness={0.2}
                />
              </mesh>
            ))}
          </group>
        </group>
      )}

      {/* 2. Green LED Emissive Illumination (Pump Active) */}
      {ledGreenComp && telemetry.pump_active && (
        <group position={ledGreenComp.position}>
          <pointLight color="#22c55e" intensity={0.22} distance={0.18} />
          <mesh position={[0, 0.1, 0]}>
            <sphereGeometry args={[0.007, 16, 16]} />
            <meshBasicMaterial color="#4ade80" transparent opacity={0.45} />
          </mesh>
        </group>
      )}

      {/* 3. Red LED Emissive Illumination (Trip / Valve Open) */}
      {ledRedComp && (telemetry.valve_open || telemetry.status_class === 2) && (
        <group position={ledRedComp.position}>
          <pointLight color="#ef4444" intensity={0.25} distance={0.18} />
          <mesh position={[0, 0.07, 0]}>
            <sphereGeometry args={[0.007, 16, 16]} />
            <meshBasicMaterial color="#f87171" transparent opacity={0.45} />
          </mesh>
        </group>
      )}
    </group>
  );
};
