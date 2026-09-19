import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import {
  ToolAnnotations,
  ServerRequest,
  ServerNotification,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { z, ZodRawShape } from 'zod';

type SimpleToolCallback<TInputSchema extends ZodRawShape, TOutputSchema extends ZodRawShape> = (
  input: z.infer<z.ZodObject<TInputSchema>>,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) => z.infer<z.ZodObject<TOutputSchema>> | Promise<z.infer<z.ZodObject<TOutputSchema>>>;
type CompleteToolCallback<TInputSchema extends ZodRawShape> = (
  args: z.infer<z.ZodObject<TInputSchema>>,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) => CallToolResult | Promise<CallToolResult>;

export interface RegisterToolInterface<
  TInputSchema extends ZodRawShape,
  TOutputSchema extends ZodRawShape,
  TCallback
> {
  name: string;
  config: {
    description: string;
    inputSchema: TInputSchema;
    outputSchema?: TOutputSchema;
    annotations?: ToolAnnotations;
  };
  callback: TCallback;
}

export function createTool<TInputSchema extends ZodRawShape, TOutputSchema extends ZodRawShape>(
  params: RegisterToolInterface<
    TInputSchema,
    TOutputSchema,
    SimpleToolCallback<TInputSchema, TOutputSchema>
  >
): RegisterToolInterface<TInputSchema, TOutputSchema, CompleteToolCallback<TInputSchema>> {
  const originalCallback = params.callback;
  const outputSchemaObject = params.config.outputSchema
    ? z.object(params.config.outputSchema)
    : null;

  const completeCallback: CompleteToolCallback<TInputSchema> = async (
    input: z.infer<z.ZodObject<TInputSchema>>,
    extra
  ) => {
    const originalReturn = await originalCallback(input, extra);

    // Zod.parse() removes extra fields by default
    const trimmedResult = outputSchemaObject
      ? outputSchemaObject.parse(originalReturn)
      : originalReturn;

    // Note that structuredContent is introduced on May, 2025, it's not widely adopted yet
    // so we set text content as fallback
    return {
      structuredContent: trimmedResult,
      content: trimmedResult ? [{ type: 'text', text: JSON.stringify(trimmedResult) }] : [],
    };
  };
  return { ...params, callback: completeCallback };
}

export const optNull = <T extends z.ZodTypeAny>(schema: T) => schema.optional().nullable();
