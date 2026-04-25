import { ErrorBuffer } from './errorBuffer.js';
import { RuntimeError } from './types.js';

describe('ErrorBuffer', () => {
  let buffer: ErrorBuffer;
  
  beforeEach(() => {
    buffer = new ErrorBuffer();
  });
  
  afterEach(() => {
    buffer.clear();
  });
  
  describe('addError', () => {
    it('should add error to buffer', () => {
      const error: RuntimeError = {
        timestamp: new Date().toISOString(),
        type: 'RuntimeError',
        message: 'Test error',
        file: 'res://test.gd',
        line: 10,
        stackTrace: []
      };
      
      buffer.addError(error);
      
      const errors = buffer.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Test error');
    });
    
    it('should deduplicate similar errors within 1 second', () => {
      const error1: RuntimeError = {
        timestamp: new Date().toISOString(),
        type: 'RuntimeError',
        message: 'Duplicate error',
        file: 'res://test.gd',
        line: 10,
        stackTrace: []
      };
      
      const error2: RuntimeError = {
        timestamp: new Date().toISOString(),
        type: 'RuntimeError',
        message: 'Duplicate error',
        file: 'res://test.gd',
        line: 10,
        stackTrace: []
      };
      
      buffer.addError(error1);
      buffer.addError(error2);
      
      const errors = buffer.getErrors();
      expect(errors.length).toBe(1);
    });
    
    it('should emit error event when error is added', (done) => {
      const error: RuntimeError = {
        timestamp: new Date().toISOString(),
        type: 'RuntimeError',
        message: 'Test error',
        file: 'res://test.gd',
        line: 10,
        stackTrace: []
      };
      
      buffer.on('error', (err) => {
        expect(err.message).toBe('Test error');
        done();
      });
      
      buffer.addError(error);
    });
    
    it('should respect maximum buffer size', () => {
      for (let i = 0; i < 1500; i++) {
        const error: RuntimeError = {
          timestamp: new Date().toISOString(),
          type: 'RuntimeError',
          message: `Error ${i}`,
          file: 'res://test.gd',
          line: i,
          stackTrace: []
        };
        buffer.addError(error);
      }
      
      const errors = buffer.getErrors();
      expect(errors.length).toBeLessThanOrEqual(1000);
    });
  });
  
  describe('getErrors', () => {
    it('should return copy of errors array', () => {
      const error: RuntimeError = {
        timestamp: new Date().toISOString(),
        type: 'RuntimeError',
        message: 'Test',
        file: 'res://test.gd',
        line: 1,
        stackTrace: []
      };
      
      buffer.addError(error);
      const errors1 = buffer.getErrors();
      const errors2 = buffer.getErrors();
      
      expect(errors1).not.toBe(errors2);
      expect(errors1).toEqual(errors2);
    });
  });
  
  describe('clear', () => {
    it('should remove all errors', () => {
      for (let i = 0; i < 5; i++) {
        const error: RuntimeError = {
          timestamp: new Date().toISOString(),
          type: 'RuntimeError',
          message: `Error ${i}`,
          file: 'res://test.gd',
          line: i,
          stackTrace: []
        };
        buffer.addError(error);
      }
      
      buffer.clear();
      
      expect(buffer.getErrorCount()).toBe(0);
    });
  });
  
  describe('subscribe', () => {
    it('should call subscriber when error is added', (done) => {
      const error: RuntimeError = {
        timestamp: new Date().toISOString(),
        type: 'RuntimeError',
        message: 'Test',
        file: 'res://test.gd',
        line: 1,
        stackTrace: []
      };
      
      const unsubscribe = buffer.subscribe((err) => {
        expect(err.message).toBe('Test');
        done();
      });
      
      buffer.addError(error);
      
      setTimeout(() => {
        unsubscribe();
      }, 10);
    });
    
    it('should return unsubscribe function', () => {
      const unsubscribe = buffer.subscribe(() => {});
      
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });
  
  describe('getErrorCount', () => {
    it('should return correct error count', () => {
      expect(buffer.getErrorCount()).toBe(0);
      
      for (let i = 0; i < 10; i++) {
        const error: RuntimeError = {
          timestamp: new Date().toISOString(),
          type: 'RuntimeError',
          message: `Error ${i}`,
          file: 'res://test.gd',
          line: i,
          stackTrace: []
        };
        buffer.addError(error);
      }
      
      expect(buffer.getErrorCount()).toBe(10);
    });
  });
});
