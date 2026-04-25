import { ErrorParser } from './errorParser.js';

describe('ErrorParser', () => {
  let parser: ErrorParser;
  
  beforeEach(() => {
    parser = new ErrorParser();
  });
  
  describe('parseStderr', () => {
    it('should parse standard Godot error format', () => {
      const data = `E 0:00:00:0123 ERROR: Null pointer: Cannot access null instance
  <C++ Source>  res://scripts/Player.gd:45
  <Stack Trace>
    _ready@res://scripts/Player.gd:23
    _init@res://scripts/Player.gd:12`;
      
      const errors = parser.parseStderr(data);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe('RuntimeError');
      expect(errors[0].message).toContain('Null pointer');
      expect(errors[0].file).toContain('Player.gd');
    });
    
    it('should parse error with file path and line number', () => {
      const data = `E 0:00:01:0345 ERROR: Invalid call to function 'get_value' (Script at res://game/Manager.gd:20)`;
      
      const errors = parser.parseStderr(data);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].line).toBe(20);
    });
    
    it('should return empty array for non-error data', () => {
      const data = `INFO: Game started
DEBUG: Loading scene...
INFO: Ready`;
      
      const errors = parser.parseStderr(data);
      
      expect(errors.length).toBe(0);
    });
    
    it('should handle multiple errors in single output', () => {
      const data = `E 0:00:00:0100 ERROR: First error
E 0:00:00:0200 ERROR: Second error
E 0:00:00:0300 ERROR: Third error`;
      
      const errors = parser.parseStderr(data);
      
      expect(errors.length).toBe(3);
    });
    
    it('should parse stack overflow errors', () => {
      const data = `E 0:00:00:0500 ERROR: Stack overflow (stack size exceeds limit)
  <C++ Source>  res://scripts/Recursive.gd:15`;
      
      const errors = parser.parseStderr(data);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message.toLowerCase()).toContain('stack');
    });
    
    it('should handle errors without file information', () => {
      const data = `E 0:00:00:0150 ERROR: Unknown error occurred`;
      
      const errors = parser.parseStderr(data);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].file).toBeTruthy();
    });
    
    it('should normalize error types correctly', () => {
      const data = `E 0:00:00:0100 ERR: Error message
E 0:00:00:0200 FATAL: Fatal error
E 0:00:00:0300 WARN: Warning`;
      
      const errors = parser.parseStderr(data);
      
      expect(errors[0].type).toBe('RuntimeError');
      expect(errors[1].type).toBe('FatalError');
    });
  });
  
  describe('edge cases', () => {
    it('should handle empty string', () => {
      const errors = parser.parseStderr('');
      expect(errors).toEqual([]);
    });
    
    it('should handle whitespace-only lines', () => {
      const data = `   
   
E 0:00:00:0100 ERROR: Error message
   
`;
      
      const errors = parser.parseStderr(data);
      expect(errors.length).toBe(1);
    });
    
    it('should handle malformed error lines gracefully', () => {
      const data = `Random output without error
Some console message
E malformed error line
Another random message`;
      
      const errors = parser.parseStderr(data);
      expect(Array.isArray(errors)).toBe(true);
    });
  });
});
