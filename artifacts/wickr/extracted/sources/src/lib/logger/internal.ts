import { BaseLogger } from './BaseLogger';
import { ILogger, LogLevel } from './ILogger';
import { NoOpLogger } from './NoOpLogger';

const logLevelMap = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} satisfies Record<LogLevel, number>;

export class InternalLogger extends BaseLogger<unknown, unknown> {
  // Static
  private static defaultTransport: ILogger = new NoOpLogger();

  static getDefaultTransport = () => this.defaultTransport;

  static setDefaultTransport = (transport: ILogger) => {
    this.defaultTransport = transport;
    return transport;
  };

  private static defaultLogLevel: LogLevel = 'info';

  static getDefaultLogLevel = () => this.defaultLogLevel;

  static setDefaultLogLevel = (level: LogLevel) => (this.defaultLogLevel = level);

  // Instance
  private _logLevel?: LogLevel;

  readonly prefix: string;

  get logLevel() {
    return this._logLevel ?? InternalLogger.getDefaultLogLevel();
  }
  set logLevel(level: LogLevel) {
    this._logLevel = level;
  }

  private getTransport: () => ILogger;

  constructor(
    prefix: string,
    logLevel?: LogLevel,
    getTransport: () => ILogger = InternalLogger.getDefaultTransport
  ) {
    super();
    this.prefix = `[${prefix}]`;
    this._logLevel = logLevel;
    this.getTransport = getTransport;
  }

  protected log(level: LogLevel, args: any[]): void {
    const instanceLevel = this.logLevel;
    if (instanceLevel && logLevelMap[level] <= logLevelMap[instanceLevel]) {
      this.getTransport()[level](this.prefix, ...args);
    }
  }

  clear = () => this.getTransport().clear();
}
