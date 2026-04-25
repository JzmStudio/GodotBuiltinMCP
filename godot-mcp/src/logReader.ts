import * as fs from 'fs';
import * as path from 'path';
import { LogEntry } from './types.js';
import { config } from './config.js';

export class LogReader {
  private logPath: string;
  
  constructor(logPath?: string) {
    this.logPath = logPath || config.godotLogPath;
  }
  
  async getLogs(params: {
    level?: string;
    limit?: number;
    offset?: number;
  }): Promise<LogEntry[]> {
    try {
      if (!fs.existsSync(this.logPath)) {
        return [];
      }
      
      const logFiles = this.findLogFiles();
      if (logFiles.length === 0) {
        return [];
      }
      
      const latestLogFile = logFiles[logFiles.length - 1];
      const content = fs.readFileSync(latestLogFile, 'utf-8');
      const entries = this.parseLogContent(content);
      
      let filtered = entries;
      
      if (params.level) {
        filtered = filtered.filter(e => e.level === params.level);
      }
      
      if (params.offset && params.offset > 0) {
        filtered = filtered.slice(params.offset);
      }
      
      if (params.limit && params.limit > 0) {
        filtered = filtered.slice(0, params.limit);
      }
      
      return filtered;
    } catch (error) {
      console.error('Error reading logs:', error);
      return [];
    }
  }
  
  private findLogFiles(): string[] {
    try {
      const files = fs.readdirSync(this.logPath);
      return files
        .filter(f => f.endsWith('.log') || f.endsWith('.txt'))
        .map(f => path.join(this.logPath, f))
        .sort();
    } catch (error) {
      console.error('Error finding log files:', error);
      return [];
    }
  }
  
  private parseLogContent(content: string): LogEntry[] {
    const entries: LogEntry[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const entry = this.parseLogLine(trimmed);
      if (entry) {
        entries.push(entry);
      }
    }
    
    return entries;
  }
  
  private parseLogLine(line: string): LogEntry | null {
    const patterns = [
      /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+\[(\w+)\]\s+(.+)$/,
      /^\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?)\]\s+(\w+):\s+(.+)$/,
      /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\s*(\d+)\s+-\s+(\w+)\s*-\s+(.+)$/,
      /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}):\s+\[(\w+)\]\s+(.+)$/
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const [, timestamp, level, message] = match;
        const normalizedLevel = this.normalizeLevel(level);
        const source = this.detectSource(message, line);
        
        return {
          timestamp: this.normalizeTimestamp(timestamp),
          level: normalizedLevel,
          message: message.trim(),
          source
        };
      }
    }
    
    return {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: line,
      source: 'Editor'
    };
  }
  
  private normalizeLevel(level: string): LogEntry['level'] {
    const upper = level.toUpperCase();
    if (['DEBUG', 'INFO', 'WARN', 'WARNING', 'ERROR', 'ERR'].includes(upper)) {
      if (upper === 'WARNING') return 'WARN';
      if (upper === 'ERR') return 'ERROR';
      return upper as LogEntry['level'];
    }
    return 'INFO';
  }
  
  private normalizeTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {}
    
    return timestamp;
  }
  
  private detectSource(message: string, fullLine: string): 'Editor' | 'Game' {
    const gameIndicators = [
      'Game', 'Scene', 'Node', 'Script', 
      'res://', 'Game started', 'game_',
      'Running:', 'Play:', 'F5', 'F6'
    ];
    
    const lowerMessage = (message + fullLine).toLowerCase();
    
    for (const indicator of gameIndicators) {
      if (lowerMessage.includes(indicator.toLowerCase())) {
        return 'Game';
      }
    }
    
    return 'Editor';
  }
  
  async getLatestLogPath(): Promise<string | null> {
    const logFiles = this.findLogFiles();
    if (logFiles.length === 0) {
      return null;
    }
    return logFiles[logFiles.length - 1];
  }
}
