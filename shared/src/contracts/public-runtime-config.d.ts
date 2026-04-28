export interface PublicRuntimeConfigFeatures {
  aiEnabled: boolean;
  ragEnabled: boolean;
  terminalEnabled: boolean;
  aiInline: boolean;
  codeExecutionEnabled: boolean;
  commentsEnabled: boolean;
}

export interface PublicRuntimeConfigAi {
  modelSelectionEnabled: boolean;
  defaultModel: string | null;
  visionModel: string | null;
}

export interface PublicRuntimeConfigCapabilities {
  supportsChatWebSocket: boolean;
  hasTerminalGatewayUrl: boolean;
}

export interface PublicRuntimeConfig {
  env: string;
  siteBaseUrl: string | null;
  apiBaseUrl: string;
  chatBaseUrl: string;
  chatWsBaseUrl: string | null;
  terminalGatewayUrl: string | null;
  ai: PublicRuntimeConfigAi;
  features: PublicRuntimeConfigFeatures;
  capabilities: PublicRuntimeConfigCapabilities;
}

export interface BuildPublicRuntimeConfigInput {
  env: string;
  siteBaseUrl?: string | null | undefined;
  apiBaseUrl: string;
  chatBaseUrl?: string | null | undefined;
  chatWsBaseUrl?: string | null | undefined;
  terminalGatewayUrl?: string | null | undefined;
  supportsChatWebSocket?: boolean | null | undefined;
  ai?: Partial<PublicRuntimeConfigAi> | null | undefined;
  features?: Partial<PublicRuntimeConfigFeatures> | null | undefined;
}

export function buildPublicRuntimeConfig(
  input: BuildPublicRuntimeConfigInput
): PublicRuntimeConfig;
