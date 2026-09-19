import { useEffect, useState } from 'react';
import { useOnResized } from '@/hooks/resizeObserver';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActiveConvoId } from '@/store/slices/shared';
import { configureWebApp } from '@/store/thunks/convos';

const WebAppContainer = () => {
  const dispatch = useAppDispatch();

  const activeConvoId = useAppSelector(selectActiveConvoId);
  const [containerRect, setContainerRect] = useState<DOMRect>();
  const containerRef = useOnResized((entry) => {
    setContainerRect(entry.target.getBoundingClientRect());
  });

  // hide web app when user switches to other tabs
  useEffect(() => {
    return () => {
      dispatch(
        configureWebApp({ id: activeConvoId, visible: false, x: 0, y: 0, width: 0, height: 0 })
      );
    };
  }, []);

  // match web app size with tab content size
  useEffect(() => {
    if (!containerRect) return;
    dispatch(
      configureWebApp({
        id: activeConvoId,
        visible: true,
        x: containerRect.x,
        y: containerRect.y,
        width: containerRect.width,
        height: containerRect.height,
      })
    );
  }, [containerRect]);

  return <div style={{ width: '100%', height: '100%' }} ref={containerRef} />;
};

export default WebAppContainer;
