export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: Date;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date(),
    };

    if (this.isDevelopment) {
      this.outputToConsole(entry);
    }

    this.outputToRemote(entry);
  }

  private outputToConsole(entry: LogEntry): void {
    const consoleMethod = {
      [LogLevel.DEBUG]: console.debug,
      [LogLevel.INFO]: console.info,
      [LogLevel.WARN]: console.warn,
      [LogLevel.ERROR]: console.error,
    }[entry.level];

    const prefix = `[${entry.level}] ${entry.timestamp.toISOString()}`;
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';

    consoleMethod?.(`${prefix} ${entry.message}${contextStr}`);
  }

  private outputToRemote(entry: LogEntry): void {
    // TODO: Send to remote logging service
    // Avoid sending in development to reduce noise
    if (this.isDevelopment) return;

    // Example: Send to logging service
    // fetch('/api/logs', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(entry),
    //   keepalive: true,
    // }).catch(() => {
    //   // Silent fail - logging failures shouldn't break the app
    // });
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, unknown> | Error): void {
    const contextObj = context instanceof Error
      ? { error: context.message, stack: context.stack }
      : context;

    this.log(LogLevel.ERROR, message, contextObj);
  }
}

export const logger = new Logger();
