import { config, initConfig } from '../config.js';

let asyncConfig = null;

async function getFeatureFlags() {
  if (asyncConfig) return asyncConfig.features;
  
  try {
    asyncConfig = await initConfig();
    return asyncConfig.features;
  } catch {
    return config.features;
  }
}

export function requireFeature(featureName) {
  return async (req, res, next) => {
    const features = await getFeatureFlags();
    
    const featureMap = {
      'ai': features.aiEnabled,
      'rag': features.ragEnabled,
      'terminal': features.terminalEnabled,
      'comments': features.commentsEnabled,
      'ai_inline': features.aiInline,
    };
    
    const isEnabled = featureMap[featureName];
    
    if (isEnabled === false) {
      return res.status(503).json({
        ok: false,
        error: {
          message: `Feature '${featureName}' is currently disabled`,
          code: 'FEATURE_DISABLED',
        },
      });
    }
    
    next();
  };
}

export function getFeatures() {
  return getFeatureFlags();
}
