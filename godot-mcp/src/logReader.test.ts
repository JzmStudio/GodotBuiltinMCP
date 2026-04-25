import { LogReader } from './logReader.js';
import * as fs from 'fs';
import * as path from 'path';

describe('LogReader', () => {
  const testLogPath = '/tmp/test-logs';
  const testLogFile = path.join(testLogPath, 'test.log');
  
  beforeAll(() => {
    if (!fs.existsSync(testLogPath)) {
      fs.mkdirSync(testLogPath, { recursive: true });
    }
  });
  
  afterAll(() => {
    if (fs.existsSync(testLogPath)) {
      fs.rmSync(testLogPath, { recursive: true, force: true });
    }
  });
  
  beforeEach(() => {
    if (fs.existsSync(testLogFile)) {
      fs.unlinkSync(testLogFile);
    }
  });
  
  describe('getLogs', () => {
    it('should return empty array when no logs exist', async () => {
      const reader = new LogReader(testLogPath);
      const logs = await reader.getLogs({});
      expect(logs).toEqual([]);
    });
    
    it('should read and parse log entries', async () => {
      const logContent = `2024-01-01 12:00:00 [INFO] Test message 1
2024-01-01 12:00:01 [ERROR] Test error message
2024-01-01 12:00:02 [DEBUG] Debug message`;
      
      fs.writeFileSync(testLogFile, logContent);
      
      const reader = new LogReader(testLogPath);
      const logs = await reader.getLogs({});
      
      expect(logs.length).toBe(3);
      expect(logs[0].level).toBe('INFO');
      expect(logs[1].level).toBe('ERROR');
      expect(logs[2].level).toBe('DEBUG');
    });
    
    it('should filter logs by level', async () => {
      const logContent = `2024-01-01 12:00:00 [INFO] Info message
2024-01-01 12:00:01 [ERROR] Error message
2024-01-01 12:00:02 [WARN] Warning message
2024-01-01 12:00:03 [ERROR] Another error`;
      
      fs.writeFileSync(testLogFile, logContent);
      
      const reader = new LogReader(testLogPath);
      const logs = await reader.getLogs({ level: 'ERROR' });
      
      expect(logs.length).toBe(2);
      expect(logs.every(l => l.level === 'ERROR')).toBe(true);
    });
    
    it('should respect limit parameter', async () => {
      const logContent = `2024-01-01 12:00:00 [INFO] Log 1
2024-01-01 12:00:01 [INFO] Log 2
2024-01-01 12:00:02 [INFO] Log 3
2024-01-01 12:00:03 [INFO] Log 4
2024-01-01 12:00:04 [INFO] Log 5`;
      
      fs.writeFileSync(testLogFile, logContent);
      
      const reader = new LogReader(testLogPath);
      const logs = await reader.getLogs({ limit: 3 });
      
      expect(logs.length).toBe(3);
    });
    
    it('should respect offset parameter', async () => {
      const logContent = `2024-01-01 12:00:00 [INFO] Log 1
2024-01-01 12:00:01 [INFO] Log 2
2024-01-01 12:00:02 [INFO] Log 3
2024-01-01 12:00:03 [INFO] Log 4
2024-01-01 12:00:04 [INFO] Log 5`;
      
      fs.writeFileSync(testLogFile, logContent);
      
      const reader = new LogReader(testLogPath);
      const logs = await reader.getLogs({ offset: 2, limit: 2 });
      
      expect(logs.length).toBe(2);
      expect(logs[0].message).toContain('Log 3');
    });
  });
});
