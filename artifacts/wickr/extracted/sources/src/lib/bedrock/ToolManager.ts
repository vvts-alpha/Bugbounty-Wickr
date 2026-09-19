import { ToolResultBlock, ToolSpecification, ToolUseBlock } from '@aws-sdk/client-bedrock-runtime';
import { Tool } from '@modelcontextprotocol/sdk/types';
import { WickrMcpClient } from '../mcp/WickrMcpClient';
import { Logger } from '@/lib/logger';
import { safeStringify } from '@/utils/strings';

const logger = new Logger('ToolManager');
/**
 * ToolManager - Simplified tool discovery and execution
 *
 * Handles conversion between MCP tools and Claude format,
 * and manages tool execution via MCP client.
 */
export class ToolManager {
  constructor(private wickrMcpClient: WickrMcpClient) {}

  /**
   * Check if tools are available
   */
  hasToolsAvailable(): boolean {
    return this.wickrMcpClient !== null && this.wickrMcpClient.isReady();
  }

  /**
   * Discover available tools from MCP client
   */
  async discoverAvailableTools(): Promise<ToolSpecification[]> {
    if (!this.hasToolsAvailable()) {
      return [];
    }

    try {
      const toolsResult = await this.wickrMcpClient.listTools();
      const mcpTools = toolsResult.tools || [];

      logger.info(`Discovered ${mcpTools.length} MCP tools`);
      return this.convertToAWSTool(mcpTools);
    } catch (error) {
      logger.error('Error discovering tools:', error);
      return [];
    }
  }

  /**
   * Execute a single tool call
   */
  async executeToolCall(toolUse: ToolUseBlock): Promise<ToolResultBlock> {
    try {
      logger.info(`Executing tool: ${toolUse.name}`);

      // Safely extract input as Record<string, any>
      let safeInput: Record<string, any> = {};
      if (
        typeof toolUse.input === 'object' &&
        toolUse.input !== null &&
        !Array.isArray(toolUse.input)
      ) {
        safeInput = toolUse.input;
      }
      logger.debug(`Tool input: ${safeStringify(safeInput)}`);
      const result = await this.wickrMcpClient.callTool(toolUse.name || '', safeInput);
      const content = this.extractTextContent(result.content);

      return {
        toolUseId: toolUse.toolUseId || '',
        content: [{ text: content || 'Tool executed successfully' }],
        status: 'success',
      };
    } catch (error) {
      logger.error(`Error executing tool ${toolUse.name}:`, error);

      return {
        toolUseId: toolUse.toolUseId || '',
        content: [{ text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        status: 'error',
      };
    }
  }

  /**
   * Execute multiple tool calls in parallel
   */
  async executeToolCalls(toolUses: ToolUseBlock[]): Promise<ToolResultBlock[]> {
    logger.info(`Executing ${toolUses.length} tool calls`);

    const results = await Promise.all(toolUses.map((toolUse) => this.executeToolCall(toolUse)));

    const errorCount = results.filter((r: ToolResultBlock) => r.status === 'error').length;
    logger.info(`Completed: ${results.length - errorCount} success, ${errorCount} errors`);

    return results;
  }

  /**
   * Convert MCP tools to AWS SDK ToolSpecification format
   */
  private convertToAWSTool(mcpTools: Tool[]): ToolSpecification[] {
    return mcpTools.map((tool) => {
      const toolSpec: ToolSpecification = {
        name: tool.name,
        description: tool.description || 'No description available',
        inputSchema: {
          json: JSON.parse(
            JSON.stringify({
              type: 'object',
              properties: tool.inputSchema?.properties || {},
              required: tool.inputSchema?.required || [],
            })
          ),
        },
      };
      return toolSpec;
    });
  }

  /**
   * Extract text content from MCP result
   */
  private extractTextContent(content: any[]): string {
    if (!content || content.length === 0) {
      return '';
    }

    const textContent = content.find((c) => c.type === 'text');
    return textContent && 'text' in textContent ? textContent.text : '';
  }
}
