import { PradvionClient } from '../client';
export interface PradvionCallbackOptions {
    customerId?: string;
    project?: string;
    feature?: string;
    team?: string;
    environment?: string;
    conversationId?: string;
    pradvionClient?: PradvionClient;
}
export declare class PradvionCallbackHandler {
    private readonly options;
    readonly raiseError = false;
    private startTimes;
    private runInfo;
    constructor(options?: PradvionCallbackOptions);
    private getClient;
    private getCtx;
    handleLLMStart(serialized: Record<string, any>, _prompts: string[], runId: string, _parentRunId?: string, _extraParams?: Record<string, any>, _tags?: string[], _metadata?: Record<string, any>, kwargs?: Record<string, any>): Promise<void>;
    handleChatModelStart(serialized: Record<string, any>, _messages: any[][], runId: string, _parentRunId?: string, _extraParams?: Record<string, any>, _tags?: string[], _metadata?: Record<string, any>, kwargs?: Record<string, any>): Promise<void>;
    handleLLMEnd(output: any, runId: string): Promise<void>;
    handleLLMError(_error: Error, runId: string): Promise<void>;
    handleChainStart(): Promise<void>;
    handleChainEnd(): Promise<void>;
    handleChainError(): Promise<void>;
    handleToolStart(): Promise<void>;
    handleToolEnd(): Promise<void>;
    handleToolError(): Promise<void>;
    handleText(): Promise<void>;
    handleAgentAction(): Promise<void>;
    handleAgentEnd(): Promise<void>;
    handleRetrieverStart(): Promise<void>;
    handleRetrieverEnd(): Promise<void>;
    handleRetrieverError(): Promise<void>;
}
//# sourceMappingURL=langchain.d.ts.map