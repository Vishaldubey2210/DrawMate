/**
 * Client-side structured logger
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = Boolean((import.meta as any).env?.DEV);

class ClientLogger {
  private format(module: string, message: string): string {
    const time = new Date().toLocaleTimeString();
    return `[${time}] [${module}] ${message}`;
  }

  public debug(module: string, message: string, data?: any): void {
    if (isDev) {
      if (data !== undefined) {
        console.debug(`%c${this.format(module, message)}`, 'color: #9333ea', data);
      } else {
        console.debug(`%c${this.format(module, message)}`, 'color: #9333ea');
      }
    }
  }

  public info(module: string, message: string, data?: any): void {
    if (data !== undefined) {
      console.info(`%c${this.format(module, message)}`, 'color: #0284c7', data);
    } else {
      console.info(`%c${this.format(module, message)}`, 'color: #0284c7');
    }
  }

  public warn(module: string, message: string, data?: any): void {
    if (data !== undefined) {
      console.warn(`%c${this.format(module, message)}`, 'color: #d97706; font-weight: bold;', data);
    } else {
      console.warn(`%c${this.format(module, message)}`, 'color: #d97706; font-weight: bold;');
    }
  }

  public error(module: string, message: string, error?: any): void {
    if (error !== undefined) {
      console.error(`%c${this.format(module, message)}`, 'color: #dc2626; font-weight: bold;', error);
    } else {
      console.error(`%c${this.format(module, message)}`, 'color: #dc2626; font-weight: bold;');
    }
  }
}

export const clientLogger = new ClientLogger();
