import { ILogger, LogLevel } from './ILogger';

export abstract class BaseLogger<ClearOptions = void, ClearReturns = void> implements ILogger {
  protected abstract log(level: LogLevel, args: any[]): void;
  debug = (...args: any[]) => this.log('debug', args);
  info = (...args: any[]) => this.log('info', args);
  warn = (...args: any[]) => this.log('warn', args);
  error = (...args: any[]) => this.log('error', args);
  abstract clear(options?: ClearOptions): ClearReturns;
}
