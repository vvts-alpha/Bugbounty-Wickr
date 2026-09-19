import { Logger } from '../logger';
import { MetricEvents } from './MetricEvents';
import MetricTimer from './MetricTimer';
import { Metrics } from './Metrics';
import { MetricName } from './models';

const logger = new Logger('trackMetrics');

export type ConvoSwitchEventAttributes = {
  isConvoCached: boolean;
  isFirstConvoLoad: boolean;
};
export type ConvoSwitchEventMetrics = {
  switchTime: number;
  numMessagesRendered: number;
};

export function trackConvoSwitching(metrics: Metrics, metricEvents: MetricEvents) {
  logger.debug('trackConvoSwitching: on');
  let previousConvoId = '';
  let previousTimer: MetricTimer<any> | undefined;
  let tracking = true;

  // When ActiveConvoChanged occurs...
  const unsubscribe = metricEvents.on('ConvoSwitchStart', async ({ vgroupId: convoId }) => {
    // Initial load is slower, so track
    const firstConvo = !previousConvoId;
    previousConvoId = convoId;

    // Cancel any previous timer to avoid race condition
    // 1. User switches to convo B while convo A is still loading, so convo A's ConvoSwitchEnd event won't be fired
    // 2. User switches back to convo A and it's loaded, now the ConvoSwitchEnd event is fired and being captured by previous metric tracker
    // 3. The duration would be much longer than the actual duration
    // We should only track one convo at a time
    previousTimer?.cancel();
    const timer = metrics.startTimer('WV:ConvoLoaded');
    previousTimer = timer;
    // Get isConvoCached info and Track how long it takes for the messages to first load
    const [fetchMessagesDetails, switchDetails] = await Promise.all([
      metricEvents.once('ConvoSwitchFetchMessages'),
      metricEvents.once('ConvoSwitchEnd'),
    ]);
    if (
      fetchMessagesDetails.vgroupId === convoId &&
      switchDetails.vgroupId === convoId &&
      tracking
    ) {
      if (
        timer.stop({ segmentation: { firstConvo, messages: switchDetails.numMessagesRendered } })
      ) {
        // if timer is not cancelled before stopping, send metric and log the duration
        // timer.stop will send metric to Countly, this metrics.addMetrics sends metric to Kinesis
        metrics.addMetrics('ConvoSwitch', {
          attributes: {
            isConvoCached: fetchMessagesDetails.isCached,
            isFirstConvoLoad: firstConvo,
          },
          metrics: {
            switchTime: timer.duration,
            numMessagesRendered: switchDetails.numMessagesRendered,
          },
        });
        logger.info(
          `Convo ${convoId} Loaded: ${timer.duration}ms; Cached: ${fetchMessagesDetails.isCached}; NumMessagesRendered: ${switchDetails.numMessagesRendered}`
        );
      }
    }
  });

  return () => {
    tracking = false;
    unsubscribe();
    logger.debug('trackConvoSwitching: off');
  };
}

export function trackTextMessageSending(metrics: Metrics, metricEvents: MetricEvents) {
  logger.debug('trackTextMessageSending: on');

  // For every text message, we start a TextMessageSent timer here and store it based on the message content
  const messageTimerMap = new Map<string, MetricTimer<any>>();

  // When TextMessageSendStart occurs...
  const unsubscribeStart = metricEvents.on('TextMessageSendStart', ({ content }) => {
    // Add content and timer to messageTimerMap to track multiple messages as they start sending
    messageTimerMap.set(content, metrics.startTimer('WV:TextMessageSent'));
  });

  // When TextMessageSendEnd occurs...
  const unsubscribeEnd = metricEvents.on('TextMessageSendEnd', ({ content }) => {
    // Though the approach below wouldn't properly represent a situation where multiple messages
    // with the same content were sent at the same time, for normal use cases, this method
    // should be sufficient to track text message sending times.
    const timer = messageTimerMap.get(content);
    if (timer) {
      messageTimerMap.delete(content);
      timer.stop();
    }
  });

  return () => {
    unsubscribeStart();
    unsubscribeEnd();
    messageTimerMap.clear();
    logger.debug('trackTextMessageSending: off');
  };
}

export function trackScrollingEvents(metrics: Metrics, metricEvents: MetricEvents) {
  logger.debug('trackScrollingEvents: on');
  let tracking = true;

  // When ScrollEventStart occurs...
  const unsubscribe = metricEvents.on('ScrollEventStart', async ({ scrollType }) => {
    let metricName: MetricName = 'WV:ConvoScrolledToBottom';

    // Check scroll type to determine which metric event to start a timer for
    switch (scrollType) {
      case 'ScrollToMention':
        metricName = 'WV:ConvoScrolledToMention';
        break;
      case 'ScrollToError':
        metricName = 'WV:ConvoScrolledToError';
        break;
    }

    const timer = metrics.startTimer(metricName);

    // Track how long it takes to scroll to target message
    const details = await metricEvents.once('ScrollEventEnd');
    if (details.scrollType === scrollType && tracking) {
      timer.stop();
    }
  });

  return () => {
    tracking = false;
    unsubscribe();
    logger.debug('trackScrollingEvents: off');
  };
}

export function trackConvoMessagesFetching(metrics: Metrics, metricEvents: MetricEvents) {
  logger.debug('trackConvoMessagesFetching: on');

  // For each fetch type, we start a ConvoFetchMessages timer here and store it based on the fetch type
  const timerMap = new Map<string, MetricTimer<any>>();

  // When ConvoFetchMessagesStart occurs...
  const unsubscribeStart = metricEvents.on('ConvoFetchMessagesStart', ({ fetchType }) => {
    const metricName: MetricName =
      fetchType === 'leading' ? 'WV:ConvoFetchedOlderMessages' : 'WV:ConvoFetchedNewerMessages';
    // Add fetchType and timer to timerMap to track duration of fetching older or newer messages
    timerMap.set(fetchType, metrics.startTimer(metricName));
  });

  // When ConvoFetchMessagesEnd occurs...
  const unsubscribeEnd = metricEvents.on('ConvoFetchMessagesEnd', ({ fetchType }) => {
    const timer = timerMap.get(fetchType);
    if (timer) {
      timerMap.delete(fetchType);
      timer.stop();
    }
  });

  return () => {
    unsubscribeStart();
    unsubscribeEnd();
    timerMap.clear();
    logger.debug('trackConvoMessagesFetching: off');
  };
}

/** Initiate tracking on metric events */
export function trackMetricEvents(metrics: Metrics, metricEvents: MetricEvents) {
  logger.debug('trackMetricEvents: on');
  const unsubscribes = [
    trackConvoSwitching(metrics, metricEvents),
    trackTextMessageSending(metrics, metricEvents),
    trackScrollingEvents(metrics, metricEvents),
    trackConvoMessagesFetching(metrics, metricEvents),
  ];
  return () =>
    unsubscribes.forEach((unsubscribe) => {
      unsubscribe();
      logger.debug('trackMetricEvents: off');
    });
}
