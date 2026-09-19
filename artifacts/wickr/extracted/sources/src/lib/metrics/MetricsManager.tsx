import { useEffect } from 'react';
import { useWebChannel } from '@/apis/webChannel/context';
import { useAppStore } from '@/store';
import { createLogAndSendMetricsHandler } from './metricsHandler';
import { metrics } from '.';

export const MetricsManager = () => {
  const { bridge } = useWebChannel();
  const store = useAppStore();

  useEffect(() => {
    metrics.setAddMetricsHandler(createLogAndSendMetricsHandler(bridge, store));
  }, [bridge, store]);

  return null;
};
