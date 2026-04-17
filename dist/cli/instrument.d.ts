export declare function shouldSkipFile(filePath: string): boolean;
export declare function shouldSkipDir(dirName: string): boolean;
export declare function findFiles(root: string): string[];
export interface Detection {
    hasOpenAI: boolean;
    hasAnthropic: boolean;
    alreadyInstrumented: boolean;
    alreadyInit: boolean;
    openAIVars: string[];
    anthropicVars: string[];
}
export declare function detectAIUsage(content: string): Detection;
export declare function generatePatch(content: string, detection: Detection, isTypeScript: boolean): string | null;
export declare function undoInstrumentation(content: string): string | null;
export interface InstrumentResult {
    filesFound: number;
    filesChanged: number;
    filesSkipped: number;
    changes: string[];
}
export declare function instrument(options: {
    target?: string;
    dryRun?: boolean;
    undo?: boolean;
    quiet?: boolean;
}): InstrumentResult;
//# sourceMappingURL=instrument.d.ts.map