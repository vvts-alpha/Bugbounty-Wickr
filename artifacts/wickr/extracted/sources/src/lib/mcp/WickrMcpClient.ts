import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { CallToolResult, ListToolsResult } from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '../logger';
import { Disposable } from '@/utils/disposable';

const logger = new Logger('WickrMcpClient');
/**
 * WickrMcpClient - A Model Context Protocol client for Wickr Web application
 * Connects to WickrMcpServer to invoke tools for interacting with Wickr conversations, messages, and users
 */
export class WickrMcpClient implements Disposable {
  private client: Client;
  private transport: Transport;
  private isConnected = false;

  constructor(transport: Transport) {
    this.transport = transport;
    this.client = new Client({
      name: 'wickr-mcp-client',
      version: '1.0.0',
      description: 'MCP client for Wickr messaging',
    });
  }

  async dispose() {
    await this.disconnect();
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.transport.start();
      await this.client.connect(this.transport);
      this.isConnected = true;
      logger.info('WickrMcpClient connected successfully');
    } catch (error) {
      logger.error('Failed to connect WickrMcpClient:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.transport.close();
      await this.client.close();
      this.isConnected = false;
      logger.info('WickrMcpClient disconnected successfully');
    } catch (error) {
      logger.error('Failed to disconnect WickrMcpClient:', error);
      throw error;
    }
  }

  /**
   * Check if the client is connected
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * List all available tools from the server
   */
  async listTools(): Promise<ListToolsResult> {
    this.ensureConnected();
    return await this.client.listTools();
  }

  /**
   * Call a tool with the given name and arguments
   */
  async callTool(name: string, args?: Record<string, any>): Promise<CallToolResult> {
    this.ensureConnected();
    const result = await this.client.callTool({ name, arguments: args || {} });
    return result as CallToolResult;
  }
  /**
   * Ensure the client is connected before making calls
   */
  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new Error('Client is not connected. Call connect() first.');
    }
  }
}
