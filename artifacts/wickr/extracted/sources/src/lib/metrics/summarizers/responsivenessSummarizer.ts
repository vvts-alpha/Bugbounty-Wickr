import { metrics } from '..';
import { Logger } from '../../logger';
import { runAfterFramePaint } from '@/utils/dom';
import { relativeChange } from '@/utils/math';
import { HourlyAverageSummarizer, DailyMetric, HourlyMetric } from './HourlySummarizer';

export type ResponsivenessSummarizer = HourlyAverageSummarizer<number, number>;

export type ResponsivenessMetric = {
  clickToPaintDelay: number;
  clickToPaintDelayChangePercentage: number;
};

const logger = new Logger('responsivenessSummarizer');

export const createResponsivenessSummarizer = () => {
  const responsivenessSummarizer: ResponsivenessSummarizer = new HourlyAverageSummarizer(
    (summarizer) => {
      const { dataPoints, average: hourlyAverage, latestSummarizeResult, hourElapsed } = summarizer;
      const prevSummarizeResult = latestSummarizeResult?.result;
      const hasEnoughDataPoints = dataPoints.length >= 10;
      if (!hasEnoughDataPoints) {
        logger.info(
          'hourly average click to paint delay:',
          `hour ${hourElapsed}, no enought data points, skip`
        );
      } else {
        const diff = prevSummarizeResult ? relativeChange(prevSummarizeResult, hourlyAverage) : 0;

        logger.info(
          'hourly average click to paint delay:',
          `hour ${hourElapsed}, delay ${hourlyAverage} ms, previous ${prevSummarizeResult} ms, diff ${(
            diff * 100
          ).toFixed()}%`
        );
        if (!__DEV__) {
          metrics.addMetrics('WV:HourlyPerformance', {
            count: 1,
            segmentation: {
              hour: hourElapsed,
              clickToPaintDelay: hourlyAverage,
              clickToPaintDelayChangePercentage: diff,
            } as HourlyMetric & ResponsivenessMetric,
          });
        }
      }
      // log daily average click to paint delay
      if (hourElapsed % 24 === 0) {
        const { day, yesterdayAverage, todayAverage, diff } = summarizer.generateDailySummary();
        logger.info(
          'daily average click to paint delay:',
          `today ${todayAverage} ms, yesterday ${yesterdayAverage} ms, diff ${(
            diff * 100
          ).toFixed()}%`
        );
        if (!__DEV__) {
          metrics.addMetrics('WV:DailyPerformance', {
            count: 1,
            segmentation: {
              day,
              clickToPaintDelay: todayAverage,
              clickToPaintDelayChangePercentage: diff,
            } as DailyMetric & ResponsivenessMetric,
          });
        }
      }

      if (hasEnoughDataPoints) {
        return hourlyAverage;
      }
    },
    (item) => item
  );

  const handleUserClick = () => {
    // performance.now is needed for better precision
    const now = performance.now();

    // calculate the delay between the click and the next frame paint, as one of the factors that indicate the responsiveness of an app
    runAfterFramePaint(() => {
      responsivenessSummarizer.addDataPoint(performance.now() - now);
    });
  };

  responsivenessSummarizer.onStart = () => document.addEventListener('click', handleUserClick);
  responsivenessSummarizer.onStop = () => document.removeEventListener('click', handleUserClick);

  responsivenessSummarizer.startSummarizer();
  return responsivenessSummarizer;
};
