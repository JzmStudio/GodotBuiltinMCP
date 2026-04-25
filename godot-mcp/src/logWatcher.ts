import { watch, FSWatcher } from 'fs';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { LogEntry } from './types.js';
import { LogReader } from './logReader.js';

export class LogWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private logReader: LogReader;
  private lastPosition: number = 0;
  private currentLogFile: string | null = null;
  
  constructor(logReader: LogReader) {
    super();
    this.logReader = logReader;
  }
  
  async start(logPath?: string): Promise<boolean> {
    try {
      const targetPath = logPath || (await this.logReader.getLatestLogPath());
      
      if (!targetPath) {
        console.error('No log file found to watch');
        return false;
      }
      
      this.currentLogFile = targetPath;
      this.lastPosition = fs.statSync(targetPath).size;
      
      this.watcher = watch(this.currentLogFile, (eventType) => {
        if (eventType === 'change') {
          this.handleFileChange();
        }
      });
      
      this.watcher.on('error', (error) => {
        console.error('Log watcher error:', error);
        this.emit('error', error);
      });
      
      return true;
    } catch (error) {
      console.error('Failed to start log watcher:', error);
      return false;
    }
  }
  
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.lastPosition = 0;
    this.currentLogFile = null;
  }
  
  private handleFileChange(): void {
    if (!this.currentLogFile) return;
    
    try {
      const stats = fs.statSync(this.currentLogFile);
      
      if (stats.size < this.lastPosition) {
        this.lastPosition = 0;
      }
      
      if (stats.size > this.lastPosition) {
        const fd = fs.openSync(this.currentLogFile, 'r');
        const buffer = Buffer.alloc(stats.size - this.lastPosition);
        fs.readSync(fd, buffer, 0, buffer.length, this.lastPosition);
        fs.closeSync(fd);
        
        const newContent = buffer.toString('utf-8');
        const newEntries = this.parseNewEntries(newContent);
        
        for (const entry of newEntries) {
          this.emit('log', entry);
        }
        
        this.lastPosition = stats.size;
      }
    } catch (error) {
      console.error('Error reading log changes:', error);
    }
  }
  
  private parseNewEntries(content: string): LogEntry[] {
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
        
        return {
          timestamp: new Date(timestamp).toISOString(),
          level: normalizedLevel,
          message: message.trim(),
          source: 'Editor'
        };
      }
    }
    
    return null;
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
}
