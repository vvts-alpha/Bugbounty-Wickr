import { ComponentType, useRef } from 'react';
import useEventListener from '@/hooks/useEventListener';

export function withLinkHandler<P extends object>(
  WrappedComponent: ComponentType<P>
): ComponentType<P> {
  return function WithLinkHandler(props: P) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEventListener(containerRef, 'click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('a')) return;

      e.preventDefault();
      const href = target.closest('a')?.getAttribute('href');
      if (href) {
        window.parent.postMessage({ type: 'openLink', url: href }, window.parent.origin);
      }
    });

    return (
      <div ref={containerRef} style={{ height: '100%' }}>
        <WrappedComponent {...props} />
      </div>
    );
  };
}

export default withLinkHandler;
