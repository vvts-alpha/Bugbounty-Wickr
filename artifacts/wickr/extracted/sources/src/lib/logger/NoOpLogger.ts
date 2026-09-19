import { BaseLogger } from './BaseLogger';

/** Useful when you need a logger */
export class NoOpLogger extends BaseLogger {
  protected log(): void {}
  clear() {}
}
