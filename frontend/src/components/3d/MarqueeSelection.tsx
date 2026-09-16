import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorkbenchStore } from '../../store/workbenchStore';

export interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MarqueeManagerProps {
  isMarqueeActive: boolean;
  startClientPos: { x: number; y: number } | null;
  onMarqueeEnd: () => void;
  setMarqueeRect: (rect: MarqueeRect | null) => void;
}

export const MarqueeManager: React.FC<MarqueeManagerProps> = ({
  isMarqueeActive,
  startClientPos,
  onMarqueeEnd,
  setMarqueeRect,
}) => {
  const { camera, gl } = useThree();
  const components = useWorkbenchStore((s) => s.components);
  const setSelectedComponentIds = useWorkbenchStore((s) => s.setSelectedComponentIds);
  const isShiftPressed = useWorkbenchStore((s) => s.isShiftPressed);

  const startPosRef = useRef(startClientPos);
  startPosRef.current = startClientPos;

  useEffect(() => {
    if (!isMarqueeActive || !startPosRef.current) {
      setMarqueeRect(null);
      return;
    }

    const dom = gl.domElement;
    const rect = dom.getBoundingClientRect();
    const startX = startPosRef.current.x - rect.left;
    const startY = startPosRef.current.y - rect.top;

    const handlePointerMove = (e: PointerEvent) => {
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const minX = Math.min(startX, currentX);
      const maxX = Math.max(startX, currentX);
      const minY = Math.min(startY, currentY);
      const maxY = Math.max(startY, currentY);

      const width = maxX - minX;
      const height = maxY - minY;

      if (width > 6 || height > 6) {
        setMarqueeRect({ x: minX, y: minY, width, height });

        // Calculate enclosed components by projecting 3D positions to 2D
        const enclosedIds: string[] = [];

        for (const comp of components) {
          const worldPos = new THREE.Vector3(...comp.position);
          worldPos.project(camera);

          if (worldPos.z < 1.0) {
            const screenX = ((worldPos.x + 1) * rect.width) / 2;
            const screenY = ((-worldPos.y + 1) * rect.height) / 2;

            const pad = 24;
            if (
              screenX + pad >= minX &&
              screenX - pad <= maxX &&
              screenY + pad >= minY &&
              screenY - pad <= maxY
            ) {
              enclosedIds.push(comp.id);
            }
          }
        }

        setSelectedComponentIds(enclosedIds);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      if (width <= 6 && height <= 6 && !e.shiftKey && !isShiftPressed) {
        setSelectedComponentIds([]);
      }

      setMarqueeRect(null);
      onMarqueeEnd();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    isMarqueeActive,
    gl,
    camera,
    components,
    isShiftPressed,
    setSelectedComponentIds,
    setMarqueeRect,
    onMarqueeEnd,
  ]);

  return null;
};
