export const CONFIG_CLASSIFICATIONS = Object.freeze({
  PUBLIC_CONFIG: 'public-config',
  PRIVATE_CONFIG: 'private-config',
  RUNTIME_MUTABLE_CONFIG: 'runtime-mutable-config',
  SECRET: 'secret',
  DEPLOYMENT_ONLY: 'deployment-only',
  INFRA_ONLY: 'infra-only',
});

export const CONFIG_CLASSIFICATION_VALUES = Object.freeze(
  Object.values(CONFIG_CLASSIFICATIONS),
);

export const SECRET_LIKE_KEY_PATTERN =
  /(^|_)(SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL|API_KEY|ACCESS_KEY|AUTH|BEARER)(_|$)|KEY$/;

export function isSecretLikeKey(key) {
  return SECRET_LIKE_KEY_PATTERN.test(String(key || '').toUpperCase());
}
