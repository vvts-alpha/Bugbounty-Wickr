import { MetricEvents } from './MetricEvents';
import { Metrics } from './Metrics';
import { trackMetricEvents } from './trackMetrics';

export const metrics = new Metrics();
export const metricEvents = new MetricEvents();

if (__DEV__) {
  Object.assign(globalThis, {
    _metrics: metrics,
    _metricEvents: metricEvents,
  });
}

const stopTracking = trackMetricEvents(metrics, metricEvents);
if (import.meta.hot) {
  // prevent trackers from piling up in HMR
  import.meta.hot.dispose(() => {
    stopTracking();
  });
}
