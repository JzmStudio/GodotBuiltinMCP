import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface Config {
  godotPath: string;
  godotLogPath: string;
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  enableDebug: boolean;
}

function loadConfig(): Config {
  const envPath = path.join(process.cwd(), '.env');
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    const envVars: Record<string, string> = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
    
    return {
      godotPath: envVars['GODOT_PATH'] || getDefaultGodotPath(),
      godotLogPath: envVars['GODOT_LOG_PATH'] || getDefaultLogPath(),
      logLevel: (envVars['LOG_LEVEL'] as Config['logLevel']) || 'INFO',
      enableDebug: envVars['ENABLE_DEBUG'] === 'true'
    };
  }
  
  return {
    godotPath: process.env.GODOT_PATH || getDefaultGodotPath(),
    godotLogPath: process.env.GODOT_LOG_PATH || getDefaultLogPath(),
    logLevel: (process.env.LOG_LEVEL as Config['logLevel']) || 'INFO',
    enableDebug: process.env.ENABLE_DEBUG === 'true'
  };
}

function getDefaultGodotPath(): string {
  const platform = process.platform;
  
  if (platform === 'win32') {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    
    const possiblePaths = [
      path.join(programFiles, 'Godot', 'Godot.exe'),
      path.join(programFiles, 'Godot_v4.x', 'Godot_v4.x.exe'),
      path.join(programFilesX86, 'Godot', 'Godot.exe'),
      'C:\\Godot\\Godot.exe'
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    
    return path.join(programFiles, 'Godot', 'Godot.exe');
  }
  
  if (platform === 'darwin') {
    return '/Applications/Godot.app/Contents/MacOS/Godot';
  }
  
  return '/usr/local/bin/godot';
}

function getDefaultLogPath(): string {
  const platform = process.platform;
  const home = os.homedir();
  
  if (platform === 'win32') {
    return path.join(process.env['APPDATA'] || home, 'Godot', 'logs');
  }
  
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Godot', 'logs');
  }
  
  return path.join(home, '.local', 'share', 'Godot', 'logs');
}

export const config = loadConfig();
