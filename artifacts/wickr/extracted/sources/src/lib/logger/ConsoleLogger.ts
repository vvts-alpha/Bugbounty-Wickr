import { redactPII } from '@/utils/strings';
import { BaseLogger } from './BaseLogger';
import { LogLevel } from './ILogger';

export class ConsoleLogger extends BaseLogger {
  readonly id = 'ConsoleLogger';
  protected log(level: LogLevel, args: any[]): void {
    // Qt cannot differentiate between info and debug, so skip all debug logging outside of dev
    if (__DEV__ || level !== 'debug') {
      // stringify the logs in prod so [Object object] is not logged in Wickr
      // always run this code to make sure it is safe in prod
      const logStringArray = redactPII(args);

      if (logStringArray.length) {
        console[level].apply(console, __DEV__ ? args : logStringArray);
      }
    }
  }
  clear = () => console.clear();
}
