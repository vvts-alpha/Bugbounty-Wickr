import { hoursToMilliseconds, minutesToMilliseconds } from 'date-fns';
import { average, relativeChange } from '@/utils/math';
import Summarizer from './Summarizer';

export type HourlyMetric = {
  hour: number;
};

export type DailyMetric = {
  day: number;
};

class HourlySummarizer<TData, TResult> extends Summarizer<TData, TResult> {
  public hourElapsed = 0;

  constructor(summarizeFn: (summarizer: HourlySummarizer<TData, TResult>) => TResult | undefined) {
    super(() => summarizeFn(this), minutesToMilliseconds(60));
  }

  public summarize(): void {
    this.hourElapsed++;
    this.onBeforeSummarize();
    super.summarize();
  }

  protected onBeforeSummarize(): void {
    // Default implementation does nothing
  }
}

export class HourlyAverageSummarizer<TData, TResult extends number> extends HourlySummarizer<
  TData,
  TResult
> {
  public average = 0;
  public maximum = 0;
  public minimum = 0;
  public numSamples = 0;
  constructor(
    summarizeFn: (summarizer: HourlyAverageSummarizer<TData, TResult>) => TResult | undefined,
    private selector: (item: TData) => number
  ) {
    super(() => summarizeFn(this));
  }

  protected onBeforeSummarize(): void {
    this.average = average(this.dataPoints, this.selector);
    this.maximum = Math.max(...this.dataPoints.map(this.selector));
    this.minimum = Math.min(...this.dataPoints.map(this.selector));
    this.numSamples = this.dataPoints.length;
  }

  public summarize(): void {
    super.summarize();
    super.clearDataPoints();
  }

  public generateDailySummary(): {
    day: number;
    todayAverage: number;
    yesterdayAverage: number;
    diff: number;
  } {
    const now = Date.now();
    const day = Math.floor(this.hourElapsed / 24);
    const summarizeResultsToday = this.getSummarizeResults(now - hoursToMilliseconds(24));
    const summarizeResultsYesterday = this.getSummarizeResults(
      now - hoursToMilliseconds(48),
      now - hoursToMilliseconds(24)
    );

    const todayAverage = average(summarizeResultsToday, (item) => item.result);
    const yesterdayAverage = average(summarizeResultsYesterday, (item) => item.result);
    const diff = yesterdayAverage ? relativeChange(yesterdayAverage, todayAverage) : 0;

    return { day, todayAverage, yesterdayAverage, diff };
  }
}
