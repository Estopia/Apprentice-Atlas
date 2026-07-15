import { describe, expect, it, vi } from 'vitest';

import { createSingleFlightGate } from '../src/lib/single-flight-gate';

describe('synchronous single-flight gate', () => {
  it('rejects a second acquisition in the same event frame', () => {
    const gate = createSingleFlightGate();

    expect(gate.tryAcquire()).toBe(true);
    expect(gate.tryAcquire()).toBe(false);
    gate.release();
    expect(gate.tryAcquire()).toBe(true);
  });

  it('allows only one service call across email and Apple actions', async () => {
    const gate = createSingleFlightGate();
    let releaseService!: () => void;
    const serviceWait = new Promise<void>((resolve) => { releaseService = resolve; });
    const service = vi.fn(async (_method: 'email' | 'apple') => serviceWait);
    const invoke = async (method: 'email' | 'apple') => {
      if (!gate.tryAcquire()) return false;
      try {
        await service(method);
        return true;
      } finally {
        gate.release();
      }
    };

    const email = invoke('email');
    const duplicateEmail = invoke('email');
    const overlappingApple = invoke('apple');

    expect(service).toHaveBeenCalledOnce();
    expect(await duplicateEmail).toBe(false);
    expect(await overlappingApple).toBe(false);
    releaseService();
    expect(await email).toBe(true);
    expect(await invoke('apple')).toBe(true);
    expect(service).toHaveBeenCalledTimes(2);
  });
});
