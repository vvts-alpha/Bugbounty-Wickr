import memoize from 'lodash/memoize';
import { metrics } from '@/lib/metrics';
import { getQt } from '@/utils/platform';
import { WickrWebChannels } from './WickrWebChannels';

/**
 * Open the QWebChannel
 * @throws if an error occurs
 */
function openQWebChannel<Objects = AnyObject>(
  transport: QWebChannelTransport
): Promise<QWebChannel<Objects>> {
  return new Promise((resolve, reject) => {
    const channel = new QWebChannel<Objects>(transport, (c) => {
      if (c) {
        resolve(channel);
      } else {
        reject(new Error('No channel'));
      }
    });
  });
}

/**
 * First call: opens the QWebChannel
 * Subsequent calls: returns the opened QWebChannel
 * Memoize ensures the QWebChannel is only opened once which avoids stranding concurrent channel adapter function calls
 *
 * @returns the QWebChannel
 * @throws if can't open the QWebChannel
 */
export const getOrOpenWickrQWebChannels = memoize(async () => {
  const qt = getQt();
  if (!qt) {
    throw new Error('Qt not defined');
  }
  const timer = metrics.startTimer('WebChannelOpen');
  const channel = await openQWebChannel<Partial<WickrWebChannels>>(qt.webChannelTransport);
  timer.stop({ attributes: { name: 'WickrWebChannel' } });
  return channel;
});
