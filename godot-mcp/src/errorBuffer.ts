import { RuntimeError } from './types.js';
import { EventEmitter } from 'events';

export class ErrorBuffer extends EventEmitter {
  private errors: RuntimeError[] = [];
  private maxSize: number = 1000;
  private seenErrors: Map<string, number> = new Map();
  
  addError(error: RuntimeError): void {
    const key = this.getErrorKey(error);
    
    const lastSeen = this.seenErrors.get(key);
    if (lastSeen && Date.now() - lastSeen < 1000) {
      return;
    }
    
    this.errors.push(error);
    this.seenErrors.set(key, Date.now());
    
    if (this.errors.length > this.maxSize) {
      const removed = this.errors.shift();
      if (removed) {
        const removedKey = this.getErrorKey(removed);
        this.seenErrors.delete(removedKey);
      }
    }
    
    this.emit('error', error);
  }
  
  getErrors(): RuntimeError[] {
    return [...this.errors];
  }
  
  clear(): void {
    this.errors = [];
    this.seenErrors.clear();
  }
  
  getErrorCount(): number {
    return this.errors.length;
  }
  
  private getErrorKey(error: RuntimeError): string {
    return `${error.type}:${error.message}:${error.file}:${error.line}`;
  }
  
  subscribe(callback: (error: RuntimeError) => void): () => void {
    const handler = (error: RuntimeError) => callback(error);
    this.on('error', handler);
    
    return () => {
      this.off('error', handler);
    };
  }
}
