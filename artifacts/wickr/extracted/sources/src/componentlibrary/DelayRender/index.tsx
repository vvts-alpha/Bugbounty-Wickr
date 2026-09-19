import React, { useEffect, useState } from 'react';

interface DelayRenderBaseProps {
  mode: 'timeout' | 'idle';
  fallback?: React.ReactNode;
}

interface TimeoutModeProps extends DelayRenderBaseProps {
  mode: 'timeout';
  delay: number;
}

interface IdleModeProps extends DelayRenderBaseProps {
  mode: 'idle';
  maxWait: number;
}

type DelayLoadProps = TimeoutModeProps | IdleModeProps;

const DelayRender: ReactFC<DelayLoadProps> = (props) => {
  const { mode, children } = props;
  const delay = 'delay' in props ? props.delay : undefined;
  const maxWait = 'maxWait' in props ? props.maxWait : undefined;

  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (mode === 'timeout') {
      const timer = setTimeout(() => {
        setShouldLoad(true);
      }, delay);
      return () => {
        clearTimeout(timer);
      };
    } else if (mode === 'idle') {
      const idleCallbackId = requestIdleCallback(
        () => {
          setShouldLoad(true);
        },
        { timeout: maxWait }
      );

      return () => cancelIdleCallback(idleCallbackId);
    }
  }, [mode, delay, maxWait]);

  return shouldLoad ? <>{children}</> : props.fallback ? <>{props.fallback}</> : null;
};

export default DelayRender;
