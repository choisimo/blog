function trimTrailingSlash(value) {
  return typeof value === 'string' ? value.replace(/\/+$/, '') : value;
}

function toOptionalString(value) {
  return typeof value === 'string' && value.trim() ? trimTrailingSlash(value.trim()) : null;
}

function toBoolean(value) {
  return value === true;
}

export function buildPublicRuntimeConfig(input) {
  const apiBaseUrl = trimTrailingSlash(input.apiBaseUrl);
  const chatBaseUrl = trimTrailingSlash(input.chatBaseUrl || apiBaseUrl);
  const supportsChatWebSocket = toBoolean(input.supportsChatWebSocket);
  const chatWsBaseUrl = supportsChatWebSocket
    ? toOptionalString(input.chatWsBaseUrl) ||
      chatBaseUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://')
    : null;
  const terminalGatewayUrl = toOptionalString(input.terminalGatewayUrl);
  const terminalEnabled = toBoolean(input.features?.terminalEnabled) && Boolean(terminalGatewayUrl);

  return {
    env: input.env,
    siteBaseUrl: toOptionalString(input.siteBaseUrl),
    apiBaseUrl,
    chatBaseUrl,
    chatWsBaseUrl,
    terminalGatewayUrl,
    ai: {
      modelSelectionEnabled: toBoolean(input.ai?.modelSelectionEnabled),
      defaultModel: toOptionalString(input.ai?.defaultModel),
      visionModel: toOptionalString(input.ai?.visionModel),
    },
    features: {
      aiEnabled: toBoolean(input.features?.aiEnabled),
      ragEnabled: toBoolean(input.features?.ragEnabled),
      terminalEnabled,
      aiInline: toBoolean(input.features?.aiInline),
      codeExecutionEnabled: toBoolean(input.features?.codeExecutionEnabled),
      commentsEnabled: toBoolean(input.features?.commentsEnabled),
    },
    capabilities: {
      supportsChatWebSocket,
      hasTerminalGatewayUrl: terminalEnabled,
    },
  };
}
