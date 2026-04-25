import { RuntimeError } from './types.js';

export class ErrorParser {
  parseStderr(data: string): RuntimeError[] {
    const errors: RuntimeError[] = [];
    const lines = data.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const error = this.parseErrorLine(trimmed);
      if (error) {
        errors.push(error);
      }
    }
    
    return errors;
  }
  
  private parseErrorLine(line: string): RuntimeError | null {
    const patterns = [
      {
        regex: /^(?:E\s+:?\s*)?(\w+)\s*:\s*(.+?)\s+\(.*?res:\/\/(.+?):(\d+)\)/,
        hasFile: true
      },
      {
        regex: /^(?:E\s+:?\s*)?(\w+)\s*:\s*(.+?)\s+\(.*?at:\s+(.+?):(\d+)\)/,
        hasFile: true
      },
      {
        regex: /^(?:E\s+:?\s*)?(\w+)\s*:\s*(.+?)\s+\(Script\s+line:\s*(\d+)\)/,
        hasFile: false
      },
      {
        regex: /^(?:E\s+:?\s*)?(\w+)\s*:\s*(.+)$/,
        hasFile: false
      },
      {
        regex: /^(?:ERROR|ERR|WARN|FATAL):\s*(.+?)\s+\(.*?res:\/\/(.+?):(\d+)\)/,
        hasFile: true
      }
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern.regex);
      if (match) {
        if (pattern.hasFile) {
          const [, type, message, file, lineNum] = match;
          return {
            timestamp: new Date().toISOString(),
            type: this.normalizeErrorType(type),
            message: message.trim(),
            file: `res://${file}`,
            line: parseInt(lineNum, 10) || 0,
            stackTrace: []
          };
        } else {
          const [, type, message] = match;
          const lineMatch = line.match(/line\s*:?\s*(\d+)/i);
          
          return {
            timestamp: new Date().toISOString(),
            type: this.normalizeErrorType(type),
            message: message.trim(),
            file: lineMatch ? this.extractFileFromContext(line) : 'unknown',
            line: lineMatch ? parseInt(lineMatch[1], 10) : 0,
            stackTrace: []
          };
        }
      }
    }
    
    if (this.isLikelyError(line)) {
      return {
        timestamp: new Date().toISOString(),
        type: 'RuntimeError',
        message: line,
        file: 'unknown',
        line: 0,
        stackTrace: []
      };
    }
    
    return null;
  }
  
  private normalizeErrorType(type: string): string {
    const upper = type.toUpperCase();
    
    const typeMap: Record<string, string> = {
      'ERR': 'RuntimeError',
      'ERROR': 'RuntimeError',
      'FATAL': 'FatalError',
      'WARN': 'Warning',
      'WARNING': 'Warning',
      'ASSERT': 'AssertionError',
      'INVALID_CALL': 'InvalidCallError',
      'INVALID_DATA': 'InvalidDataError',
      'BUG': 'BugError'
    };
    
    return typeMap[upper] || 'RuntimeError';
  }
  
  private extractFileFromContext(line: string): string {
    const resMatch = line.match(/res:\/\/[^)]+/);
    if (resMatch) {
      return resMatch[0];
    }
    return 'unknown';
  }
  
  private isLikelyError(line: string): boolean {
    const errorIndicators = [
      'error', 'fail', 'exception', 'crash',
      'null', 'undefined', 'stack overflow',
      'out of memory', 'access violation'
    ];
    
    const lower = line.toLowerCase();
    return errorIndicators.some(indicator => lower.includes(indicator));
  }
}
