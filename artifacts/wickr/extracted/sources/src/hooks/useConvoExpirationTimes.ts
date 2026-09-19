import { useAppSelectorExtra } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectConvoBor, selectConvoTtl } from '@/store/slices/convos';
import { MILLISECONDS_PER_SECOND, MILLISECONDS_PER_YEAR } from '@/utils/date';

/** Minimum value for expiration time (60 seconds) */
const MIN_CONVO_TTL_VALUE_MS = MILLISECONDS_PER_SECOND * 60;
/** Minimum value for burn on read if "Off" is not allowed (3 seconds) */
const MIN_CONVO_BOR_VALUE_MS = MILLISECONDS_PER_SECOND * 3;
/** Maximum value in ms that any convo timer can be */
export const MAX_CONVO_TIMER_VALUE_MS = MILLISECONDS_PER_YEAR;

export default function useConvoExpirationTimes(convoId?: string | null | undefined) {
  if (!convoId) convoId = '';
  // The network level expiration time setting from the console
  const networkMaxTTL = useSetting('maxMessageTtl');
  // The network level burn-on-read setting from the console
  const networkMaxBOR = useSetting('maxMessageBOR');
  // The convo level expiration time setting
  const convoTTL = useAppSelectorExtra(selectConvoTtl, convoId) ?? 0; // Zero for use where there is no convo settings, like New Room flow
  // The convo level burn-on-read time setting
  const convoBOR = useAppSelectorExtra(selectConvoBor, convoId) ?? 0; // Zero for use where there is no convo settings, like New Room flow

  /**
   * displayedBOR
   * The current burn-on-read time displayed to the client in the room
   * equals the minimum between the convoBOR and networkMaxBOR if both are non-zero.
   * If the networkMaxBOR is non-zero, then "Off" is not allowed and a convo bor setting of zero is ignored.
   */
  const displayedBOR =
    networkMaxBOR && convoBOR
      ? Math.min(convoBOR, networkMaxBOR)
      : networkMaxBOR
      ? networkMaxBOR
      : convoBOR;

  /**
   * displayedTTL
   * The current TTL displayed to the client in the room
   * equals the minumum between the convoTTL and networkMaxTTL
   */
  const displayedTTL = Math.min(convoTTL, networkMaxTTL);

  /**
   * maxBOR
   * The maximum burn-on-read time allowed to be set by the user
   * is the minimum betwen the non-zero convoTTL and the non-zero networkMaxBOR.
   * If the convoTTL is zero like during the new room flow, the maxBOR is equal to the non-zero networkMaxBOR.
   * If both values are zero, like during the new room flow when the network has burn-on-read off, the maxBOR is 1 year.
   */
  const maxBOR =
    networkMaxBOR && convoTTL
      ? Math.min(convoTTL, networkMaxBOR)
      : !convoTTL && !networkMaxBOR
      ? MAX_CONVO_TIMER_VALUE_MS
      : convoTTL
      ? convoTTL
      : networkMaxBOR;

  /**
   * minBOR
   * The minimum burn-on-read time allowed to be set by the user
   * is the minimum between the networkMaxBOR and lowest allowed non-zero value (3 seconds).
   * If the networkMaxBOR is zero, the user is allowed to turn burn-on-read off.
   */
  const minBOR = Math.min(MIN_CONVO_BOR_VALUE_MS, networkMaxBOR);

  return {
    displayedBOR,
    displayedTTL,
    maxBOR,
    minBOR,
    maxTTL: networkMaxTTL,
    minTTL: MIN_CONVO_TTL_VALUE_MS,
  };
}
