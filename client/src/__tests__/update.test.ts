import { describe, expect, it } from 'vitest';
import { updateIsAvailable } from '../update.js';

describe('updateIsAvailable', () => {
  it('is true only when both ids exist and differ', () => {
    expect(updateIsAvailable('a', 'b')).toBe(true);
    expect(updateIsAvailable('a', 'a')).toBe(false);
    expect(updateIsAvailable(null, 'b')).toBe(false);
    expect(updateIsAvailable('a', null)).toBe(false);
  });
});
