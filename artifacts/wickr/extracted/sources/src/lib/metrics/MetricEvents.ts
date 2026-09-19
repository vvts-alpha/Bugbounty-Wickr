import { Emitter, OptionalArgTuple } from '@amzn/async-utils';
import { Logger } from '../logger';
import { ScrollEventType } from '@/components/Convo/ConvoMessagesContainer';
import { PaginationMarkerType } from '@/components/Convo/PaginationMarker';

const logger = new Logger('MetricEvents');

/** Event names (key) and data (value) */
type MetricEventTypes = {
  ConvoSwitchStart: { vgroupId: string };
  ConvoSwitchFetchMessages: { vgroupId: string; isCached: boolean };
  ConvoSwitchEnd: { vgroupId: string; numMessagesRendered: number };
  TextMessageSendStart: { content: string };
  TextMessageSendEnd: { content: string };
  ScrollEventStart: { scrollType: ScrollEventType };
  ScrollEventEnd: { scrollType: ScrollEventType };
  ConvoFetchMessagesStart: { fetchType: PaginationMarkerType };
  ConvoFetchMessagesEnd: { fetchType: PaginationMarkerType };
};

/** Global event emitter for metric events. Use sparingly. */
export class MetricEvents extends Emitter<MetricEventTypes> {
  emit<K extends keyof MetricEventTypes>(
    eventName: K,
    ...event: OptionalArgTuple<MetricEventTypes[K]>
  ): number {
    logger.debug('emit:', eventName);
    return super.emit(eventName, ...event);
  }
}
