import { Request, Response, NextFunction } from 'express'
import { config } from '@/config'

/**
 * Production-ready logging middleware
 * Provides structured logging for production environments
 */

export interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  meta?: Record<string, any>
  request?: {
    method: string
    url: string
    ip: string
    userAgent?: string
    userId?: string
    appId?: string
  }
  response?: {
    statusCode: number
    responseTime: number
  }
  error?: {
    name: string
    message: string
    stack?: string
  }
}

/**
 * Logger class for structured logging
 */
class Logger {
  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error']
    const configLevel = config.logging.level
    return levels.indexOf(level) >= levels.indexOf(configLevel)
  }

  private formatLog(entry: LogEntry): string {
    if (config.logging.format === 'json') {
      return JSON.stringify(entry)
    } else {
      // Pretty format for development
      const timestamp = entry.timestamp
      const level = entry.level.toUpperCase().padEnd(5)
      const message = entry.message

      let output = `${timestamp} [${level}] ${message}`

      if (entry.request) {
        output += ` | ${entry.request.method} ${entry.request.url}`
      }

      if (entry.response) {
        output += ` | ${entry.response.statusCode} (${entry.response.responseTime}ms)`
      }

      if (entry.meta && Object.keys(entry.meta).length > 0) {
        output += ` | ${JSON.stringify(entry.meta)}`
      }

      if (entry.error) {
        output += `\n  Error: ${entry.error.message}`
        if (entry.error.stack && config.nodeEnv === 'development') {
          output += `\n  ${entry.error.stack}`
        }
      }

      return output
    }
  }

  private log(level: LogEntry['level'], message: string, meta?: Record<string, any>): void {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
    }

    const formattedLog = this.formatLog(entry)

    if (config.logging.console) {
      // Use appropriate console method
      if (level === 'error') {
        console.error(formattedLog)
      } else if (level === 'warn') {
        console.warn(formattedLog)
      } else {
        console.log(formattedLog)
      }
    }

    // TODO: Add file and syslog output if configured
    // if (config.logging.file) {
    //   fs.appendFileSync(config.logging.file, formattedLog + '\n');
    // }
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.log('debug', message, meta)
  }

  info(message: string, meta?: Record<string, any>): void {
    this.log('info', message, meta)
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.log('warn', message, meta)
  }

  error(message: string, error?: Error | Record<string, any>): void {
    const meta: Record<string, any> = {}

    if (error instanceof Error) {
      meta.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } else if (error) {
      meta.error = error
    }

    this.log('error', message, meta)
  }

  // Request logging
  logRequest(req: Request, res: Response, responseTime: number): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'HTTP Request',
      request: {
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.id,
        appId: (req as any).user?.appId,
      },
      response: {
        statusCode: res.statusCode,
        responseTime,
      },
    }

    const formattedLog = this.formatLog(entry)

    if (config.logging.console) {
      console.log(formattedLog)
    }
  }

  // Security event logging
  logSecurityEvent(event: string, req: Request, meta?: Record<string, any>): void {
    this.log('warn', `Security Event: ${event}`, {
      ...meta,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
    })
  }
}

// Singleton logger instance
export const logger = new Logger()

/**
 * HTTP request logging middleware
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now()

  // Override res.end to capture response time
  const originalEnd = res.end.bind(res)
  res.end = function (chunk?: any, encoding?: any, cb?: () => void) {
    const responseTime = Date.now() - startTime

    // Log the request
    logger.logRequest(req, res, responseTime)

    // Call original end method with proper arguments
    if (typeof encoding === 'function') {
      return originalEnd(chunk, encoding)
    } else if (encoding !== undefined) {
      return originalEnd(chunk, encoding, cb)
    } else {
      return originalEnd(chunk, cb)
    }
  }

  next()
}

/**
 * Error logging middleware
 */
export function errorLoggingMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Unhandled HTTP error', {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
      appId: (req as any).user?.appId,
    },
  })

  next(err)
}

/**
 * Audit logging for security events
 */
export function auditLog(event: string, req: Request, meta?: Record<string, any>): void {
  logger.info(`Audit: ${event}`, {
    ...meta,
    userId: (req as any).user?.id,
    appId: (req as any).user?.appId,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  })
}

export default logger
