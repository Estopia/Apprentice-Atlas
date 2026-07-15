export type SingleFlightGate = {
  tryAcquire: () => boolean;
  release: () => void;
};

export function createSingleFlightGate(): SingleFlightGate {
  let locked = false;
  return {
    tryAcquire() {
      if (locked) return false;
      locked = true;
      return true;
    },
    release() {
      locked = false;
    },
  };
}

export async function runSingleFlightAction<T>(
  gate: SingleFlightGate,
  action: () => Promise<T>,
): Promise<{ started: false } | { started: true; result: T }> {
  if (!gate.tryAcquire()) return { started: false };
  try {
    return { started: true, result: await action() };
  } finally {
    gate.release();
  }
}
