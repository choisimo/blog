/**
 * MCP Client Tool - Model Context Protocol Integration
 * 
 * Connects to MCP servers to access external tools and resources.
 * Supports filesystem, web search, and custom MCP servers.
 */

import { spawn } from 'child_process';

// Configuration
const MCP_CONFIG_PATH = process.env.MCP_CONFIG_PATH || '/.roo/mcp.json';

// MCP Server definitions
const MCP_SERVERS = {
  filesystem: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.env.WORKSPACE_PATH || '/workspace'],
  },
  // Add more MCP servers as needed
};

/**
 * MCP Client class for communicating with MCP servers
 */
class MCPClient {
  constructor(serverConfig) {
    this.config = serverConfig;
    this.process = null;
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.ready = false;
  }

  /**
   * Start the MCP server process
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.config.command, this.config.args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, ...this.config.env },
        });

        let buffer = '';

        this.process.stdout.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const message = JSON.parse(line);
                this._handleMessage(message);
              } catch (e) {
                // Not JSON, ignore
              }
            }
          }
        });

        this.process.stderr.on('data', (data) => {
          console.error(`[MCP] stderr: ${data}`);
        });

        this.process.on('close', (code) => {
          this.ready = false;
          console.log(`[MCP] Process exited with code ${code}`);
        });

        // Send initialize request
        this._send({
          jsonrpc: '2.0',
          id: this._nextId(),
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'blog-agent',
              version: '1.0.0',
            },
          },
        });

        // Wait for initialization
        setTimeout(() => {
          this.ready = true;
          resolve();
        }, 1000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the MCP server process
   */
  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.ready = false;
  }

  /**
   * Send a message to the MCP server
   */
  _send(message) {
    if (this.process && this.process.stdin.writable) {
      this.process.stdin.write(JSON.stringify(message) + '\n');
    }
  }

  /**
   * Get next request ID
   */
  _nextId() {
    return ++this.requestId;
  }

  /**
   * Handle incoming message from MCP server
   */
  _handleMessage(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
    }
  }

  /**
   * Call an MCP tool
   */
  async callTool(name, args) {
    return new Promise((resolve, reject) => {
      const id = this._nextId();
      this.pendingRequests.set(id, { resolve, reject });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('MCP tool call timeout'));
      }, 30000);

      this._send({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name, arguments: args },
      });

      // Clear timeout on resolution
      this.pendingRequests.get(id).timeout = timeout;
    });
  }

  /**
   * List available tools
   */
  async listTools() {
    return new Promise((resolve, reject) => {
      const id = this._nextId();
      this.pendingRequests.set(id, { resolve, reject });

      this._send({
        jsonrpc: '2.0',
        id,
        method: 'tools/list',
        params: {},
      });
    });
  }

  /**
   * Read a resource
   */
  async readResource(uri) {
    return new Promise((resolve, reject) => {
      const id = this._nextId();
      this.pendingRequests.set(id, { resolve, reject });

      this._send({
        jsonrpc: '2.0',
        id,
        method: 'resources/read',
        params: { uri },
      });
    });
  }
}

// Global MCP clients
const mcpClients = new Map();

/**
 * Get or create an MCP client
 */
async function getMCPClient(serverName) {
  if (mcpClients.has(serverName)) {
    const client = mcpClients.get(serverName);
    if (client.ready) return client;
  }

  const config = MCP_SERVERS[serverName];
  if (!config) {
    throw new Error(`Unknown MCP server: ${serverName}`);
  }

  const client = new MCPClient(config);
  await client.start();
  mcpClients.set(serverName, client);
  return client;
}

/**
 * Create MCP Client Tool
 */
export async function createMCPClientTool() {
  // Check if MCP is enabled
  if (process.env.DISABLE_MCP === 'true') {
    console.log('[MCP] MCP is disabled');
    return null;
  }

  return {
    name: 'mcp_tools',
    description: 'Access external tools and resources via Model Context Protocol (MCP). Can read files, search the web, and interact with various services.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The MCP action to perform',
          enum: ['read_file', 'list_files', 'search_files', 'call_tool'],
        },
        server: {
          type: 'string',
          description: 'The MCP server to use',
          enum: ['filesystem'],
          default: 'filesystem',
        },
        // For file operations
        path: {
          type: 'string',
          description: 'File or directory path',
        },
        pattern: {
          type: 'string',
          description: 'Search pattern (glob or regex)',
        },
        // For call_tool
        tool: {
          type: 'string',
          description: 'Tool name to call',
        },
        args: {
          type: 'object',
          description: 'Arguments for the tool',
        },
      },
      required: ['action'],
    },

    async execute(params) {
      const { action, server = 'filesystem', path, pattern, tool, args } = params;

      console.log(`[MCP] Executing action: ${action} on server: ${server}`);

      try {
        const client = await getMCPClient(server);

        switch (action) {
          case 'read_file': {
            if (!path) {
              return { success: false, error: 'path is required' };
            }
            const result = await client.readResource(`file://${path}`);
            return {
              success: true,
              action,
              path,
              content: result.contents?.[0]?.text?.slice(0, 5000),
            };
          }

          case 'list_files': {
            if (!path) {
              return { success: false, error: 'path is required' };
            }
            const result = await client.callTool('list_directory', { path });
            return {
              success: true,
              action,
              path,
              files: result.content?.map(c => c.text),
            };
          }

          case 'search_files': {
            if (!pattern) {
              return { success: false, error: 'pattern is required' };
            }
            const result = await client.callTool('search_files', {
              path: path || '.',
              pattern,
            });
            return {
              success: true,
              action,
              pattern,
              matches: result.content?.map(c => c.text),
            };
          }

          case 'call_tool': {
            if (!tool) {
              return { success: false, error: 'tool is required' };
            }
            const result = await client.callTool(tool, args || {});
            return {
              success: true,
              action,
              tool,
              result: result.content,
            };
          }

          default:
            return {
              success: false,
              error: `Unknown action: ${action}`,
            };
        }
      } catch (error) {
        console.error(`[MCP] Action failed: ${error.message}`);
        return {
          success: false,
          action,
          error: error.message,
        };
      }
    },
  };
}

/**
 * Cleanup MCP clients on exit
 */
process.on('exit', () => {
  for (const client of mcpClients.values()) {
    client.stop();
  }
});

export default createMCPClientTool;
