import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { Logger } from '@/lib/logger';

const logger = new Logger('routes');

/** Log route changes */
export const RouteSpy: React.FC = () => {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    logger.info('Location changed to:', `${pathname}${search}${hash}`);
  }, [pathname, search, hash]);
  return null;
};
