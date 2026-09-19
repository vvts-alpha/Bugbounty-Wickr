import { BridgeWebChannelAdapter } from '@/apis/webChannel/BridgeWebChannelAdapter';
import { devErrorTracker } from '@/lib/devErrors';
import { Logger } from '@/lib/logger';

const logger = new Logger('uploadLogs');

// Function to upload desktop logs with a specific date
export const uploadDesktopLogsWithDate = async (
  date: Date,
  bridge?: BridgeWebChannelAdapter
): Promise<string> => {
  try {
    if (!bridge) {
      throw new Error('Bridge channel is required for desktop logs');
    }

    // Set up a promise to wait for the logsReady signal
    return new Promise<string>((resolve, reject) => {
      let unsub: () => void = () => {
        devErrorTracker.addError(new Error('Did not cleanup logsReady signal connection'));
      };

      // Set up one-time listener for desktop logs
      const handler = (success: boolean, content: string) => {
        if (success) {
          // If successful, content will be the upload ID
          resolve(content);
        } else {
          // If failed, content will be the error message
          logger.warn('Failed to upload desktop logs:', content);
          reject(new Error(content));
        }
        // Remove the listener after receiving the response
        unsub();
      };

      // Connect to the logsReady signal, update unsub to the true cleanup function
      unsub = bridge.connect('logsReady', handler);

      // Trigger desktop log collection and upload for the specified date with the pre-signed URL
      bridge.getDesktopLogsForDate(date);

      // Set a timeout in case the desktop never responds
      setTimeout(() => {
        logger.warn('Timeout waiting for desktop logs upload');
        unsub();
        reject(new Error('Timeout waiting for desktop logs upload'));
      }, 30000); // 30 second timeout
    });
  } catch (error) {
    logger.error('Error uploading desktop logs:', error);
    throw error;
  }
};
