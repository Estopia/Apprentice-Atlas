import { describe, expect, it, vi } from 'vitest';

import { createSingleFlightGate, runSingleFlightAction } from '../src/lib/single-flight-gate';

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

  it('holds the lock until asynchronous auth completion resolves', async () => {
    const gate = createSingleFlightGate();
    let finishCompletion!: () => void;
    const completionWait = new Promise<void>((resolve) => { finishCompletion = resolve; });
    const onSuccess = vi.fn(async () => completionWait);

    const running = runSingleFlightAction(gate, async () => {
      await onSuccess();
      return 'completed';
    });

    expect(onSuccess).toHaveBeenCalledOnce();
    expect(gate.tryAcquire()).toBe(false);
    finishCompletion();
    await expect(running).resolves.toEqual({ started: true, result: 'completed' });
    expect(gate.tryAcquire()).toBe(true);
  });
});
