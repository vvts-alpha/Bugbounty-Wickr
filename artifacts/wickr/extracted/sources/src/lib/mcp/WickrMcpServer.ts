import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { Logger } from '../logger';
import { WickrWebChannel } from '@/apis/webChannel';
import { AppStore } from '@/store';
import { Disposable } from '@/utils/disposable';

import { RegisterToolInterface } from './tools';
import {
  createCreateNewConversationTool,
  createEditConversationTool,
  createGetCurrentActiveConvoTool,
  getConvoListItemsTool,
} from './tools/convoTools';
import { getCurrentDateTimeTool } from './tools/dateTimeTools';
import { listKnowledgeBasesTool, queryKnowledgeBaseTool } from './tools/knowledgeBaseTools';
import { createSIMFromMessageTool } from './tools/logTools';
import { createGetMessagesTool, createSendMessageTool } from './tools/messageTools';
import {
  getContactsTool,
  getConvoUsersTool,
  getSelfUserTool,
  getUserTool,
} from './tools/userTools';

const logger = new Logger('WickrMcpServer');
/**
 * WickrMcpServer - A Model Context Protocol server for Wickr Web application
 * Provides tools for interacting with Wickr conversations, messages, and users, and more
 */
export class WickrMcpServer implements Disposable {
  private server: McpServer;
  private isStarted = false;

  constructor(
    private serverTransport: Transport,
    private store: AppStore,
    private webChannel: WickrWebChannel
  ) {
    // Initialize MCP server
    this.server = new McpServer({
      name: 'wickr-mcp-server',
      version: '1.0.0',
      description: 'MCP server providing access to Wickr messaging capabilities',
    });

    this.setupTools();
  }

  async dispose() {
    await this.stop();
  }

  /**
   * Get the server transport (internal use)
   */
  getServerTransport(): Transport {
    return this.serverTransport;
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    try {
      // Connect server to transport
      await this.server.connect(this.serverTransport);

      // Start transports
      await this.serverTransport.start();

      this.isStarted = true;
      logger.info('WickrMcpServer started successfully');
    } catch (error) {
      logger.error('Failed to start WickrMcpServer:', error);
      throw error;
    }
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    try {
      await this.serverTransport.close();
      this.isStarted = false;
      logger.info('WickrMcpServer stopped successfully');
    } catch (error) {
      logger.error('Failed to stop WickrMcpServer:', error);
      throw error;
    }
  }

  /**
   * Check if the server is running
   */
  isRunning(): boolean {
    return this.isStarted;
  }

  /**
   * Setup and register all available tools
   */
  private setupTools(): void {
    // Message Tools
    this.registerTool(createGetMessagesTool(this.store, this.webChannel));
    this.registerTool(createSendMessageTool(this.webChannel));
    // User Tools
    this.registerTool(getUserTool);
    this.registerTool(getSelfUserTool);
    this.registerTool(getContactsTool);
    this.registerTool(getConvoUsersTool);
    // Convo Tools
    this.registerTool(getConvoListItemsTool);
    this.registerTool(createGetCurrentActiveConvoTool(this.store));
    this.registerTool(createCreateNewConversationTool(this.webChannel));
    this.registerTool(createEditConversationTool(this.webChannel));
    // Other Tools
    this.registerTool(getCurrentDateTimeTool);
    this.registerTool(createSIMFromMessageTool(this.store));
    // Knowledge Base Tools
    this.registerTool(listKnowledgeBasesTool);
    this.registerTool(queryKnowledgeBaseTool);
  }
  private registerTool(tool: RegisterToolInterface<any, any, any>): void {
    this.server.registerTool(tool.name, tool.config, tool.callback);
  }
}
