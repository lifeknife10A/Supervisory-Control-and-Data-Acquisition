import type { PinDefinition } from '../../types/workbench';

// LED sizing rules (both LEDs are the same original CAD part):
// 1. Total model height (lead tip -> dome top) must equal the ESP32's
//    rendered PCB breadth (x-extent = 0.52 scene units).
// 2. Wire terminals sit exactly at the straight lead-tip centers.
//    Never spread individual vertices to fake pitch.
// LED mesh: leads from y=-28, dome top at y=8.9 -> total 36.9 CAD units.
// Target height = the ESP32 the user actually sees: the procedural model's
// PCB width (ESP32Model.tsx pcbWidth = 0.52), not the unused esp32.glb.
const LED_MESH_HEIGHT = 36.9;
const ESP32_BREADTH = 0.52;
const LED_TERMINAL_Y = 0.002;
const LED_MODEL_SCALE = ESP32_BREADTH / LED_MESH_HEIGHT;

export function ledModelTransform(color: 'green' | 'red') {
  // Red is the same original CAD part, baked at 0.015 and centered/grounded.
  const scale = color === 'green' ? LED_MODEL_SCALE : LED_MODEL_SCALE / 0.015;
  // Lead tips sit at x=±1.075 (green mesh units); position keeps them at
  // ±1.075*scale around the component origin, tips resting at LED_TERMINAL_Y.
  return {
    scale: [scale, scale, scale] as [number, number, number],
    position: (color === 'green'
      ? [0, 28 * scale + LED_TERMINAL_Y, 0]
      : [-0.002893933095037937 * scale, LED_TERMINAL_Y, 0]) as [number, number, number],
    leadLimit: color === 'green' ? 0 : 0.42,
  };
}

/** Terminals follow the original straight CAD leads, including the shorter cathode. */
export function ledPins(color: 'green' | 'red'): PinDefinition[] {
  const transform = ledModelTransform(color);
  const sourceScale = color === 'green' ? 1 : 0.015;
  const sourceXOffset = color === 'green' ? 0 : 0.002893933095037937;
  const sourceYOffset = color === 'green' ? 0 : 0.42;
  return (['anode', 'cathode'] as const).map((id, index) => {
    const source = [
      (index === 0 ? -1.075 : 1.075) * sourceScale + sourceXOffset,
      (index === 0 ? -28 : -25) * sourceScale + sourceYOffset,
      0,
    ];
    return {
      id,
      name: index === 0 ? 'Anode (+)' : 'Cathode (-)',
      type: index === 0 ? 'DIGITAL_GPIO' : 'GROUND',
      relativePosition: source.map((value, axis) =>
        value * transform.scale[axis] + transform.position[axis]
      ) as [number, number, number],
    };
  });
}

