import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { GameStatus } from './types.js';
import { config } from './config.js';

export class GameProcessManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private status: GameStatus = {
    status: 'stopped',
    pid: null,
    startTime: null
  };
  
  getStatus(): GameStatus {
    return { ...this.status };
  }
  
  async runGame(scenePath?: string): Promise<GameStatus> {
    if (this.status.status === 'running') {
      throw new Error('Game is already running');
    }
    
    const godotPath = config.godotPath;
    
    const args: string[] = [];
    
    if (scenePath) {
      args.push(scenePath);
    } else {
      args.push('--editor');
    }
    
    args.push('--quit');
    
    try {
      this.status = {
        status: 'starting',
        pid: null,
        startTime: null
      };
      
      this.process = spawn(godotPath, args, {
        detached: false,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      this.status.pid = this.process.pid || null;
      this.status.startTime = new Date().toISOString();
      this.status.status = 'running';
      
      this.process.on('exit', (code, signal) => {
        this.status.status = 'stopped';
        this.status.pid = null;
        this.emit('exit', code, signal);
      });
      
      this.process.on('error', (error) => {
        console.error('Game process error:', error);
        this.status.status = 'stopped';
        this.status.pid = null;
        this.emit('error', error);
      });
      
      if (this.process.stdout) {
        this.process.stdout.on('data', (data) => {
          this.emit('stdout', data.toString());
        });
      }
      
      if (this.process.stderr) {
        this.process.stderr.on('data', (data) => {
          this.emit('stderr', data.toString());
        });
      }
      
      return this.getStatus();
    } catch (error) {
      this.status.status = 'stopped';
      throw error;
    }
  }
  
  async stopGame(): Promise<GameStatus> {
    if (!this.process || this.status.status !== 'running') {
      throw new Error('No game is currently running');
    }
    
    return new Promise((resolve, reject) => {
      if (!this.process) {
        reject(new Error('Process not found'));
        return;
      }
      
      const timeout = setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGTERM');
        }
      }, 5000);
      
      this.process.once('exit', () => {
        clearTimeout(timeout);
        this.status.status = 'stopped';
        this.status.pid = null;
        this.process = null;
        resolve(this.getStatus());
      });
      
      if (this.process.stdin) {
        this.process.stdin.write('quit\n');
      }
      
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGTERM');
        }
      }, 100);
    });
  }
  
  isRunning(): boolean {
    return this.status.status === 'running' && this.process !== null;
  }
  
  getPid(): number | null {
    return this.status.pid;
  }
}
