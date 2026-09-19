import { minutesToMilliseconds } from 'date-fns';
import { safeInterval, SafeIntervalCanceller } from '@/utils/safeInterval';

type SummarizeResult<TResult> = { timestamp: number; result: TResult };

/**
 * Summarizer class is used to collect data points periodically and summarize them.
 * It can be used to collect and summarize data such as heap size, responsiveness, etc.
 *
 * The class has optional data collector which actively collect data point in an interval,
 * and also a summarizer to Summarize data points collected in an interval.
 *
 * The data points and summarize results are generic types, which can be specified by the user.
 * @typeParam TData - The type of data point
 * @typeParam TResult - The type of summarize result
 */
class Summarizer<TData, TResult> {
  public dataPoints: TData[] = [];
  public summarizeResults: SummarizeResult<TResult>[] = [];
  public lastSummarizeRunTime: number | null = null;
  public onStart?: () => void;
  public onStop?: () => void;

  private dataCollectFn?: (prevDataPoint: TData | undefined) => TData | Promise<TData> | undefined;
  private prevDataPoint?: TData;
  private summarizeIntervalCanceller?: SafeIntervalCanceller;
  private dataCollectIntervalCanceller?: SafeIntervalCanceller;
  private dataCollectInterval?: number;

  constructor(
    private summarizeFn: (summarizer: Summarizer<TData, TResult>) => TResult | undefined,
    private summarizeInterval: number = minutesToMilliseconds(60)
  ) {}

  /**
   * Manually add a data point to the summarizer
   */
  public addDataPoint(data: TData): void {
    this.dataPoints.push(data);
  }

  /**
   * Set the data collector function and add data point periodically
   *
   * @param fn - The data collector function, which should return a data point or undefined if no data point is available
   * @param dataCollectInterval - The interval (in milliseconds) at which the data collector function should be called
   */
  public setDataCollector(
    fn: (prevDataPoint: TData | undefined) => TData | Promise<TData>,
    dataCollectInterval: number
  ): void {
    this.dataCollectFn = fn;
    this.dataCollectInterval = dataCollectInterval;
    // start only if summarizer is started
    if (this.summarizeIntervalCanceller) {
      this.startDataCollection(dataCollectInterval);
    }
  }

  /**
   * Start the summarizer
   */
  public startSummarizer(): void {
    if (this.summarizeIntervalCanceller) {
      return;
    }

    this.summarizeIntervalCanceller = safeInterval(() => {
      this.summarize();
    }, this.summarizeInterval);

    if (this.dataCollectInterval) {
      this.startDataCollection(this.dataCollectInterval);
    }

    this.onStart?.();
  }

  private startDataCollection(interval: number): void {
    this.dataCollectIntervalCanceller?.();

    this.dataCollectIntervalCanceller = safeInterval(() => {
      this.collectDataPoint();
    }, interval);
  }

  /**
   * Stop the summarizer
   */
  public stop(): void {
    this.summarizeIntervalCanceller?.();
    this.summarizeIntervalCanceller = undefined;

    this.dataCollectIntervalCanceller?.();
    this.dataCollectIntervalCanceller = undefined;

    this.onStop?.();
  }

  /**
   * Clear all data points
   *
   * Note: we don't actively clear data points on each summarize call
   */
  public clearDataPoints(): void {
    this.dataPoints = [];
  }

  /**
   * Summarize the data points, this will be called by summarizer automatically
   */
  public summarize(): void {
    const now = Date.now();
    const result = this.summarizeFn(this);
    if (result === undefined) return;

    this.summarizeResults.push({ timestamp: now, result });
    this.lastSummarizeRunTime = now;
  }

  /**
   * Collect data point, this will be called by data collector automatically
   */
  public async collectDataPoint(): Promise<void> {
    if (this.dataCollectFn) {
      const dataPoint = await this.dataCollectFn(this.prevDataPoint);
      if (dataPoint === undefined) return;

      this.prevDataPoint = dataPoint;
      this.addDataPoint(dataPoint);
    }
  }

  getSummarizeResults(
    fromTimestamp: number,
    toTimestamp: number = Date.now()
  ): SummarizeResult<TResult>[] {
    return this.summarizeResults.filter(
      ({ timestamp }) => timestamp >= fromTimestamp && timestamp <= toTimestamp
    );
  }

  get latestSummarizeResult(): SummarizeResult<TResult> | undefined {
    return this.summarizeResults[this.summarizeResults.length - 1];
  }
}

export default Summarizer;
