import { valueOrInitializer } from '@/utils/function';
import { Metrics } from './Metrics';
import { MetricDetails, MetricName } from './models';

// TODO:
// - pause/resume
// - Maybe allow adding of details at any time before stopping?

/** Track a timer metric. Start time is set when constructed */
export default class MetricTimer<K extends MetricName> {
  private static nextTimerId = 1;

  readonly timerId = MetricTimer.nextTimerId++;
  private _duration = -1;

  constructor(
    private readonly metrics: Metrics,
    readonly name: K,
    readonly startTime = Date.now()
  ) {}

  get duration() {
    return this._duration;
  }

  cancel() {
    this._duration = 0;
  }

  stop(details?: MetricDetails<K> | (() => MetricDetails<K>)): boolean {
    if (this._duration < 0) {
      this._duration = Date.now() - this.startTime;
      this.metrics.addMetrics(this.name, {
        ...valueOrInitializer(details),
        dur: this._duration,
      });
      return true;
    }
    return false;
  }
}
