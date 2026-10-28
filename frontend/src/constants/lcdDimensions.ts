// Workbench presentation size: 0.08-wide CAD model -> 0.756 scene units.
export const LCD_DISPLAY_SCALE = 9.45;

/** Upgrade old defaults only; do not overwrite deliberately customized scales. */
export function migrateLCDScale(scale: [number, number, number]): [number, number, number] {
  if (scale.every(value => value === 1) || scale.every(value => value === 1.4)) {
    return [LCD_DISPLAY_SCALE, LCD_DISPLAY_SCALE, LCD_DISPLAY_SCALE];
  }
  return scale;
}
