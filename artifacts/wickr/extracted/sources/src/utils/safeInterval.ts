export type SafeIntervalCanceller = () => void;

export function safeInterval(handler: () => unknown, timeout: number): SafeIntervalCanceller {
  let lastTimeout: ReturnType<typeof setTimeout> | null = null;
  const tick = async () => {
    const result = handler();
    if (result instanceof Promise) {
      await result;
    }
    if (lastTimeout) {
      lastTimeout = setTimeout(tick, timeout);
    }
  };

  const canceller = () => {
    if (lastTimeout) {
      clearTimeout(lastTimeout);
      lastTimeout = null;
    }
  };

  lastTimeout = setTimeout(tick, timeout);

  return canceller;
}
