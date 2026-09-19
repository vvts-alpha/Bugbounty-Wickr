import { hoursToSeconds, minutesToMilliseconds } from 'date-fns';
import { metrics } from '..';
import { BridgeWebChannelAdapter } from '@/apis/webChannel/BridgeWebChannelAdapter';
import { Logger } from '@/lib/logger';
import { getMemoryInfo } from '@/utils/debug';
import { relativeChange } from '@/utils/math';
import { HourlyAverageSummarizer } from './HourlySummarizer';

export type MemorySummarizer = HourlyAverageSummarizer<number, number>;
export type ClientType = 'QT' | 'WEBVIEW';

export type MemoryUsageMetric = {
  attributes: MemoryUsageAttributes;
  metrics: MemoryUsageMetrics;
};
export type MemoryUsageAttributes = {
  clientType: ClientType;
};
export type MemoryUsageMetrics = {
  elapsedSeconds: number;
  initial: number;
  interval: number;
  average: number;
  minimum: number;
  maximum: number;
  numSamples: number;
  difference: number;
};

const logger = new Logger('memorySummarizer');

function logMemoryAndSendMetric(
  clientType: ClientType,
  hour: number,
  initial: number,
  average: number,
  minimum: number,
  maximum: number,
  numSamples: number,
  prevSize?: number
) {
  average = Math.round(average);
  const absDiff = prevSize ? average - prevSize : 0;
  const percentDiff = prevSize ? relativeChange(prevSize, average) : 0;

  logger.info(
    `[${clientType}] hourly average memory size:`,
    `hour ${hour}, memory size ${average}, previous ${prevSize}, diff ${(
      percentDiff * 100
    ).toFixed()}%`
  );

  if (!__DEV__) {
    const mAttributes: MemoryUsageAttributes = {
      clientType: clientType,
    };

    const mMetrics: MemoryUsageMetrics = {
      elapsedSeconds: hoursToSeconds(hour),
      interval: hoursToSeconds(1),
      initial,
      average,
      minimum,
      maximum,
      numSamples,
      difference: absDiff,
    };

    metrics.addMetrics('MemoryUsageInformation', {
      count: 1,
      segmentation: { ...mAttributes, ...mMetrics }, // for countly
      attributes: mAttributes, // for protobuf
      metrics: mMetrics, // for protobuf
    });
  }
}

async function getMemorySize(
  bridge: BridgeWebChannelAdapter,
  clientType: ClientType
): Promise<number> {
  if (clientType === 'WEBVIEW') {
    const heapInfo = getMemoryInfo();
    return heapInfo.totalJSHeapSize;
  } else if (clientType === 'QT') {
    const realMemory = await bridge.getProcessMetrics();
    // convert mb to bytes
    return realMemory.memory * 1024 * 1024;
  } else {
    throw new Error(`Unknown client type: ${clientType}`);
  }
}

export const createMemorySummarizer = async (
  bridge: BridgeWebChannelAdapter,
  clientType: ClientType
) => {
  const initialMemorySize = await getMemorySize(bridge, clientType);
  const memorySummarizer: MemorySummarizer = new HourlyAverageSummarizer(
    (summarizer) => {
      const { hourElapsed, average, minimum, maximum, numSamples } = summarizer;
      logMemoryAndSendMetric(
        clientType,
        hourElapsed,
        initialMemorySize,
        average,
        minimum,
        maximum,
        numSamples,
        summarizer.latestSummarizeResult?.result
      );
      return average;
    },
    (item) => item
  );

  // register a data collector to the summarizer, which will be called every 5 minutes to collect the data point
  memorySummarizer.setDataCollector(async (prevDataPoint) => {
    const memorySize = await getMemorySize(bridge, clientType);

    const diff = prevDataPoint ? relativeChange(prevDataPoint, memorySize) : 0;
    logger.info(
      `[${clientType}] current memory size:`,
      `memory size ${memorySize}, previous ${prevDataPoint}, diff ${(diff * 100).toFixed()}%`
    );
    return memorySize;
  }, minutesToMilliseconds(5));

  // manually trigger the data collector to collect the initial data point
  memorySummarizer.collectDataPoint();

  memorySummarizer.summarizeResults.push({ result: initialMemorySize, timestamp: Date.now() });
  // emit the initial data point to metric
  logMemoryAndSendMetric(
    clientType,
    0,
    initialMemorySize,
    initialMemorySize,
    initialMemorySize,
    initialMemorySize,
    1,
    undefined
  );

  // start the summarizer
  memorySummarizer.startSummarizer();
  return memorySummarizer;
};
