export type ConfigClassification =
  | 'public-config'
  | 'private-config'
  | 'runtime-mutable-config'
  | 'secret'
  | 'deployment-only'
  | 'infra-only';

export type ConfigRegistryEntry = {
  key: string;
  owner: string;
  classification: ConfigClassification;
  scopes: readonly string[];
  requiredIn: readonly string[];
  delivery: readonly string[];
  publicExposure: boolean;
  mutableAtRuntime: boolean;
  rotation: string;
  deprecatedAliases: readonly string[];
  description: string;
  defaultValue?: string;
  valueType: string;
  admin: Readonly<Record<string, unknown>>;
  publicExposureReason: string | null;
};

export const CONFIG_REGISTRY: readonly ConfigRegistryEntry[];
export function getConfigRegistryEntry(key: string): ConfigRegistryEntry | null;
export function listConfigRegistry(): ConfigRegistryEntry[];
export function listConfigRegistryByScope(scope: string): ConfigRegistryEntry[];
export function listPublicRuntimeConfigKeys(): string[];
export function listWorkerDynamicConfigEntries(): ConfigRegistryEntry[];
export function listWorkerDynamicConfigKeys(): string[];
export function isRuntimeMutableConfigKey(key: string): boolean;
export function isSecretLikeConfigKey(key: string): boolean;
export function isPlaceholderConfigValue(value: unknown): boolean;
export function listRequiredConfigEntries(service: string): ConfigRegistryEntry[];
export function evaluateRequiredConfig(
  service: string,
  source: Record<string, unknown>,
): Array<{
  key: string;
  required: true;
  configured: boolean;
  placeholder: boolean;
  source: string;
  classification: ConfigClassification;
}>;
export function validateConfigRegistry(registry?: readonly ConfigRegistryEntry[]): string[];
export function assertValidConfigRegistry(registry?: readonly ConfigRegistryEntry[]): void;
