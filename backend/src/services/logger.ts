import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

const logDir = process.env.LOG_DIR || './logs';

// Ensure logging directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom log format for API audit entries
const apiLogFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

const transport = new DailyRotateFile({
  filename: path.join(logDir, 'api-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d', // Keep 14 days of history
  level: 'info',
});

export const logger = winston.createLogger({
  format: apiLogFormat,
  transports: [
    transport,
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});
