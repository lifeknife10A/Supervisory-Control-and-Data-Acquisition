import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';
import { useWorkbenchStore } from '../../store/workbenchStore';

export const ComponentTransformGizmo: React.FC = () => {
  const selectedIds = useWorkbenchStore((s) => s.selectedComponentIds);
  const components = useWorkbenchStore((s) => s.components);
  const transformMode = useWorkbenchStore((s) => s.transformMode);
  const updateComponentRotation = useWorkbenchStore((s) => s.updateComponentRotation);
  const updateComponentPosition = useWorkbenchStore((s) => s.updateComponentPosition);
  const setIsDraggingComponent = useWorkbenchStore((s) => s.setIsDraggingComponent);
  const setIsGizmoHovered = useWorkbenchStore((s) => s.setIsGizmoHovered);

  const dummyRef = useRef<THREE.Group>(null);
  const transformRef = useRef<any>(null);
  const selectedComp = selectedIds.length === 1 ? components.find((c) => c.id === selectedIds[0]) : null;

  const isDraggingRef = useRef(false);

  // Sync dummy position and rotation with selected component only when NOT dragging
  useEffect(() => {
    if (dummyRef.current && selectedComp && !isDraggingRef.current) {
      dummyRef.current.position.set(...selectedComp.position);
      dummyRef.current.rotation.set(...selectedComp.rotation);
    }
  }, [selectedComp?.id, selectedComp?.position, selectedComp?.rotation]);

  // Hook into TransformControls instance events for hover & dragging lifecycle
  useEffect(() => {
    const controls = transformRef.current;
    if (!controls) return;

    const handleDraggingChanged = (event: any) => {
      const isDragging = !!event.value;
      isDraggingRef.current = isDragging;
      setIsDraggingComponent(isDragging);
      if (!isDragging && dummyRef.current && selectedComp) {
        commitTransform();
      }
    };

    const handleAxisChanged = (event: any) => {
      setIsGizmoHovered(event.value !== null);
    };

    controls.addEventListener('dragging-changed', handleDraggingChanged);
    controls.addEventListener('axis-changed', handleAxisChanged);

    return () => {
      controls.removeEventListener('dragging-changed', handleDraggingChanged);
      controls.removeEventListener('axis-changed', handleAxisChanged);
      setIsGizmoHovered(false);
      setIsDraggingComponent(false);
      isDraggingRef.current = false;
    };
  }, [selectedComp?.id, setIsDraggingComponent, setIsGizmoHovered]);

  const commitTransform = () => {
    if (dummyRef.current && selectedComp) {
      if (transformMode === 'translate') {
        const clampedY = Math.max(0.005, Math.min(1.0, dummyRef.current.position.y));
        const clampedX = Math.max(-2.5, Math.min(2.5, dummyRef.current.position.x));
        const clampedZ = Math.max(-1.5, Math.min(1.5, dummyRef.current.position.z));
        updateComponentPosition(selectedComp.id, [
          parseFloat(clampedX.toFixed(4)),
          parseFloat(clampedY.toFixed(4)),
          parseFloat(clampedZ.toFixed(4)),
        ]);
      } else {
        updateComponentRotation(selectedComp.id, [
          dummyRef.current.rotation.x,
          dummyRef.current.rotation.y,
          dummyRef.current.rotation.z,
        ]);
      }
    }
  };

  if (!selectedComp) return null;

  return (
    <>
      <group ref={dummyRef} />
      <TransformControls
        ref={transformRef}
        object={dummyRef as any}
        mode={transformMode}
        size={0.75}
        space={transformMode === 'translate' ? 'world' : 'local'}
        makeDefault
        onObjectChange={commitTransform}
        onChange={commitTransform}
      />
    </>
  );
};
