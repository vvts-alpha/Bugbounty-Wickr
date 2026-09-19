import { Logger } from '../logger';
import { ILogger } from '../logger/ILogger';
import { BridgeWebChannelAdapter } from '@/apis/webChannel/BridgeWebChannelAdapter';
import { AppStore } from '@/store';
import { selectSetting } from '@/store/slices/settings';
import { millisecondsToMicroseconds } from '@/utils/date';
import { redactInProd } from '@/utils/strings';
import { AddMetrics, shouldReportMetric } from './models';
import { toCountlyMetricEvent } from './utils';

export function durationOnly(obj: any) {
  try {
    if (obj && typeof obj.dur === 'number') {
      // duration is in ms
      const duration = Math.round(millisecondsToMicroseconds(obj.dur));
      return `{ duration : ${duration} us }`;
    }
  } catch {
    // no-op
  }
  return '';
}

/** Create a metrics handler that logs the metric and reports it over the bridge */
export function createLogAndSendMetricsHandler(
  bridge: BridgeWebChannelAdapter,
  store: AppStore,
  logger: ILogger = new Logger('metrics')
): AddMetrics {
  const isProd = () => selectSetting(store.getState(), 'isProduction');

  return async (name, details) => {
    try {
      if (shouldReportMetric(name)) {
        let sent = false;
        let event;
        // if details are provided, assume a countly event, otherwise fallback to { event }
        if (details) {
          event = toCountlyMetricEvent<AnyObject>(name, details);
          sent = await bridge.sendAnalyticsMessage(event);
        } else {
          event = { event: name };
          sent = await bridge.sendAnalyticsEvent(event);
        }
        if (!isProd()) {
          logger.info(
            sent ? '(sent)' : '(send failed)',
            name,
            durationOnly(details),
            redactInProd(event, ''),
            redactInProd(details, '')
          );
        }
      } else if (!isProd()) {
        logger.info('(local)', name, durationOnly(details), redactInProd(details, ''));
      }
    } catch (err) {
      logger.error(err);
    }
  };
}
