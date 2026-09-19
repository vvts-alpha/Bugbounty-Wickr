import { Logger } from '../logger';
import { toCountlyNumberString } from '@/utils/countly';
import { getWebGLRendererName } from '@/utils/platform';
import { MetricEvent, MetricDetails } from './models';

type AnyMetricDetails = MetricDetails<any>;

const COUNTLY_NUMERIC_PROPS: Array<keyof Omit<AnyMetricDetails, 'segmentation'>> = [
  'count',
  'sum',
  'dur',
];
const logger = new Logger('toMetricEvent');

/** Create a valid countly event */
export function toCountlyMetricEvent<Details extends AnyMetricDetails>(
  key: string,
  details: Details = {} as Details
): MetricEvent {
  const event: MetricEvent = { key, attributes: details.attributes, metrics: details.metrics };
  COUNTLY_NUMERIC_PROPS.forEach((prop) => {
    let value: any = details[prop];
    if (typeof value === 'string') {
      value = parseInt(value, 10);
    }
    if (typeof value === 'number' && !isNaN(value)) {
      if (prop === 'dur') {
        // countly has issues with numbers with too many digits, so make sure milliseconds have no decimal
        value = Math.round(value);
      }
      event[prop] = value;
    }
  });
  const seg: AnyMetricDetails['segmentation'] = {};
  seg['webGLRenderer'] = getWebGLRendererName();
  const { segmentation } = details;
  if (segmentation && typeof segmentation === 'object') {
    Object.keys(segmentation).forEach((key) => {
      const value = segmentation[key];
      try {
        if (typeof value === 'number') {
          seg[key] = toCountlyNumberString(value);
        } else {
          seg[key] = `${value}`;
        }
      } catch (error) {
        logger.error(
          `Error converting ${value} to countly number for ${event.key} prop ${key}`,
          error
        );
      }
    });
  }
  event.segmentation = seg;
  return event;
}
