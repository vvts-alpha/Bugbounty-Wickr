import { Deferred } from '@amzn/async-utils';
import { Logger } from '../logger';
import { PrefixedError, toError } from '@/utils/error';

const logger = new Logger('DevErrorTracker');

type DevErrorHandler = (error: Error) => void;

export class DevErrorTracker {
  private devErrorHandlerDfd = new Deferred<DevErrorHandler>();

  setDevErrorHandler = (devErrorHandler: DevErrorHandler) => {
    if (this.devErrorHandlerDfd.isPending) {
      this.devErrorHandlerDfd.resolve(devErrorHandler);
    } else {
      this.devErrorHandlerDfd = Deferred.resolve(devErrorHandler);
    }
  };

  addError = (error: unknown, label?: string) => {
    let realError = toError(error);
    if (label) {
      realError = new PrefixedError(label + ' ', realError);
    }
    logger.error(realError);
    this.devErrorHandlerDfd.then((devErrorHandler) => devErrorHandler(realError));
  };
}
