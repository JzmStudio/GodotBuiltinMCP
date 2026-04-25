import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { LogReader } from './logReader.js';
import { LogWatcher } from './logWatcher.js';
import { GameProcessManager } from './gameProcess.js';
import { ErrorParser } from './errorParser.js';
import { ErrorBuffer } from './errorBuffer.js';

export class GodotMCPServer {
  private server: Server;
  private logReader: LogReader;
  private logWatcher: LogWatcher | null = null;
  private gameProcess: GameProcessManager;
  private errorParser: ErrorParser;
  private errorBuffer: ErrorBuffer;
  private errorSubscribers: Set<(error: any) => void> = new Set();
  
  constructor() {
    this.server = new Server(
      {
        name: 'godot-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.logReader = new LogReader();
    this.gameProcess = new GameProcessManager();
    this.errorParser = new ErrorParser();
    this.errorBuffer = new ErrorBuffer();
    
    this.setupErrorMonitoring();
    this.setupToolHandlers();
  }
  
  private setupErrorMonitoring(): void {
    this.gameProcess.on('stderr', (data: string) => {
      const errors = this.errorParser.parseStderr(data);
      for (const error of errors) {
        this.errorBuffer.addError(error);
        for (const subscriber of this.errorSubscribers) {
          subscriber(error);
        }
      }
    });
  }
  
  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_editor_logs',
            description: '获取Godot编辑器日志',
            inputSchema: {
              type: 'object',
              properties: {
                level: {
                  type: 'string',
                  enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'],
                  description: '日志级别过滤'
                },
                limit: {
                  type: 'number',
                  description: '返回的日志条数限制'
                },
                offset: {
                  type: 'number',
                  description: '日志条目的偏移量'
                }
              }
            }
          },
          {
            name: 'run_game',
            description: '在Godot编辑器中启动游戏',
            inputSchema: {
              type: 'object',
              properties: {
                scene_path: {
                  type: 'string',
                  description: '指定启动的场景文件路径'
                }
              }
            }
          },
          {
            name: 'stop_game',
            description: '停止当前运行的游戏'
          },
          {
            name: 'get_game_status',
            description: '获取当前游戏运行状态'
          },
          {
            name: 'get_runtime_errors',
            description: '获取游戏运行时的错误信息',
            inputSchema: {
              type: 'object',
              properties: {
                clear: {
                  type: 'boolean',
                  description: '是否在返回后清除错误记录'
                }
              }
            }
          },
          {
            name: 'subscribe_errors',
            description: '订阅运行时错误事件流'
          }
        ]
      };
    });
    
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;
        
        switch (name) {
          case 'get_editor_logs':
            return await this.handleGetEditorLogs(args);
          case 'run_game':
            return await this.handleRunGame(args);
          case 'stop_game':
            return await this.handleStopGame();
          case 'get_game_status':
            return await this.handleGetGameStatus();
          case 'get_runtime_errors':
            return await this.handleGetRuntimeErrors(args);
          case 'subscribe_errors':
            return await this.handleSubscribeErrors();
          default:
            return {
              content: [
                {
                  type: 'text',
                  text: `Unknown tool: ${name}`
                }
              ],
              isError: true
            };
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    });
  }
  
  private async handleGetEditorLogs(args: any) {
    const logs = await this.logReader.getLogs({
      level: args?.level,
      limit: args?.limit,
      offset: args?.offset
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(logs, null, 2)
        }
      ]
    };
  }
  
  private async handleRunGame(args: any) {
    const status = await this.gameProcess.runGame(args?.scene_path);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(status, null, 2)
        }
      ]
    };
  }
  
  private async handleStopGame() {
    const status = await this.gameProcess.stopGame();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(status, null, 2)
        }
      ]
    };
  }
  
  private async handleGetGameStatus() {
    const status = this.gameProcess.getStatus();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(status, null, 2)
        }
      ]
    };
  }
  
  private async handleGetRuntimeErrors(args: any) {
    const errors = this.errorBuffer.getErrors();
    
    if (args?.clear) {
      this.errorBuffer.clear();
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errors, null, 2)
        }
      ]
    };
  }
  
  private async handleSubscribeErrors() {
    return {
      content: [
        {
          type: 'text',
          text: 'Error subscription started. Use the notification system to receive errors.'
        }
      ]
    };
  }
  
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    this.logWatcher = new LogWatcher(this.logReader);
    this.logWatcher.on('log', (entry) => {
      for (const subscriber of this.errorSubscribers) {
        subscriber({ type: 'log', data: entry });
      }
    });
    
    try {
      await this.logWatcher.start();
    } catch (error) {
      console.error('Failed to start log watcher:', error);
    }
    
    console.error('Godot MCP Server started');
  }
  
  stop(): void {
    if (this.logWatcher) {
      this.logWatcher.stop();
    }
    
    if (this.gameProcess.isRunning()) {
      this.gameProcess.stopGame().catch(console.error);
    }
  }
}
