import { describe, expect, it } from 'vitest';
import { LCD_DISPLAY_SCALE, migrateLCDScale } from '../../constants/lcdDimensions';
import { COMPONENT_CATALOG } from '../workbenchStore';

describe('LCD display sizing', () => {
  it('uses the enlarged uniform scale in the component catalog', () => {
    const lcd = COMPONENT_CATALOG.find(c => c.type === 'lcd_1602')!;
    expect(lcd.scale).toEqual([LCD_DISPLAY_SCALE, LCD_DISPLAY_SCALE, LCD_DISPLAY_SCALE]);
    expect(0.08 * lcd.scale[0]).toBeCloseTo(0.756);
  });

  it('upgrades old default sizes without repeatedly enlarging the display', () => {
    for (const old of [1, 1.4]) {
      const upgraded = migrateLCDScale([old, old, old]);
      expect(upgraded).toEqual([9.45, 9.45, 9.45]);
      expect(migrateLCDScale(upgraded)).toEqual(upgraded);
    }
  });

  it('preserves user-customized scales', () => {
    expect(migrateLCDScale([2, 3, 4])).toEqual([2, 3, 4]);
  });
});
