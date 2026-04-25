import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: {
      GODOT_PATH: 'C:\\Program Files\\Godot\\Godot.exe',
      ENABLE_DEBUG: 'true'
    }
  });
  
  const client = new Client(
    {
      name: 'godot-mcp-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );
  
  try {
    await client.connect(transport);
    console.log('Connected to Godot MCP Server');
    
    const tools = await client.listTools();
    console.log('\nAvailable tools:');
    for (const tool of tools.tools) {
      console.log(`  - ${tool.name}: ${tool.description}`);
    }
    
    console.log('\n--- Testing get_editor_logs ---');
    const logs = await client.callTool({
      name: 'get_editor_logs',
      arguments: {
        level: 'ERROR',
        limit: 5
      }
    });
    console.log('Logs:', logs.content[0].text);
    
    console.log('\n--- Testing get_game_status ---');
    const status = await client.callTool({
      name: 'get_game_status',
      arguments: {}
    });
    console.log('Status:', status.content[0].text);
    
    console.log('\n--- Testing run_game ---');
    const runResult = await client.callTool({
      name: 'run_game',
      arguments: {
        scene_path: 'res://main.tscn'
      }
    });
    console.log('Run result:', runResult.content[0].text);
    
    console.log('\n--- Testing get_game_status after start ---');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const statusAfter = await client.callTool({
      name: 'get_game_status',
      arguments: {}
    });
    console.log('Status after start:', statusAfter.content[0].text);
    
    console.log('\n--- Testing get_runtime_errors ---');
    const errors = await client.callTool({
      name: 'get_runtime_errors',
      arguments: {
        clear: false
      }
    });
    console.log('Errors:', errors.content[0].text);
    
    console.log('\n--- Testing stop_game ---');
    const stopResult = await client.callTool({
      name: 'stop_game',
      arguments: {}
    });
    console.log('Stop result:', stopResult.content[0].text);
    
    console.log('\n--- Testing get_game_status after stop ---');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const statusStopped = await client.callTool({
      name: 'get_game_status',
      arguments: {}
    });
    console.log('Status after stop:', statusStopped.content[0].text);
    
    console.log('\nAll tests completed successfully!');
    
    await client.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
