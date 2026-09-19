import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * A pair of connected in-memory transports for client-server MCP communication
 * within the same JS environment.
 */
export class InMemoryTransport implements Transport {
  private started = false;
  private processingQueue = false;
  private peer?: InMemoryTransport;
  private messageQueue: Array<{
    message: JSONRPCMessage;
    extra?: { authInfo?: AuthInfo };
  }> = [];

  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (
    message: JSONRPCMessage,
    extra?: { authInfo?: AuthInfo }
  ) => void | Promise<void>;

  /**
   * Creates a connected pair of in-memory transports.
   * Returns [clientTransport, serverTransport]
   */
  static createPair(): [InMemoryTransport, InMemoryTransport] {
    const clientTransport = new InMemoryTransport();
    const serverTransport = new InMemoryTransport();

    // Connect the peers
    clientTransport.peer = serverTransport;
    serverTransport.peer = clientTransport;

    return [clientTransport, serverTransport];
  }

  async start(): Promise<void> {
    if (this.started) return;

    this.started = true;

    await this._processQueue();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.peer) {
      throw new Error('Transport peer not connected');
    }

    this.peer._enqueueMessage(message);
  }

  async close(): Promise<void> {
    if (!this.started) return;

    this.started = false;

    this.onclose?.();

    await this.peer?.close();
  }

  private _enqueueMessage(message: JSONRPCMessage, extra?: { authInfo?: AuthInfo }): void {
    this.messageQueue.push({ message, extra });

    if (this.started && !this.processingQueue) {
      this._processQueue();
    }
  }

  private async _processQueue(): Promise<void> {
    if (this.processingQueue) return;

    this.processingQueue = true;

    try {
      while (this.messageQueue.length > 0 && this.started) {
        const item = this.messageQueue.shift()!;

        try {
          await this.onmessage?.(item.message, item.extra);
        } catch (error) {
          this.onerror?.(error);
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }
}
