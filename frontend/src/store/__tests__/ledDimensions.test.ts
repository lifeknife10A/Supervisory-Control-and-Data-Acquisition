/// <reference types="node" />
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { Box3, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ledModelTransform, ledPins } from '../../components/3d/ledDimensions';
import { COMPONENT_CATALOG } from '../workbenchStore';

describe('LED dimensions and terminals', () => {
  for (const color of ['green', 'red'] as const) {
    it(`${color}: total height matches ESP32 breadth and pins meet actual CAD tips`, async () => {
      const bytes = await readFile(new URL(`../../../public/models/led_${color}.glb`, import.meta.url));
      const data = Uint8Array.from(bytes).buffer;
      const { scene } = await new GLTFLoader().parseAsync(data, '');
      const transform = ledModelTransform(color);
      expect(new Set(transform.scale).size).toBe(1);
      scene.position.fromArray(transform.position);
      scene.scale.fromArray(transform.scale);
      scene.updateMatrixWorld(true);
      expect(new Box3().setFromObject(scene).getSize(new Vector3()).y).toBeCloseTo(0.52, 6);
      const vertices: Vector3[] = [];
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const positions = object.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
          vertices.push(new Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld));
        }
      });
      const pins = ledPins(color);
      expect(COMPONENT_CATALOG.find(c => c.type === `led_${color}`)?.pins).toEqual(pins);
      for (const [index, pin] of pins.entries()) {
        const side = vertices.filter(v => index === 0 ? v.x < 0 : v.x > 0);
        const tipY = Math.min(...side.map(v => v.y));
        const tip = new Box3().setFromPoints(side.filter(v => Math.abs(v.y - tipY) < 1e-6))
          .getCenter(new Vector3());
        pin.relativePosition.forEach((value, axis) => expect(value).toBeCloseTo(tip.getComponent(axis), 6));
      }
    });
  }
});
