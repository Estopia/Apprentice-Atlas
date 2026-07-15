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
