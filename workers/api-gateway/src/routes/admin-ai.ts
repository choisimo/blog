import { Hono } from 'hono';
import type { HonoEnv } from '../types';

import providers from './admin-ai/providers';
import models from './admin-ai/models';
import routes from './admin-ai/routes';
import usage from './admin-ai/usage';
import config from './admin-ai/config';
import overview from './admin-ai/overview';
import traces from './admin-ai/traces';
import playground from './admin-ai/playground';
import templates from './admin-ai/templates';

const adminAi = new Hono<HonoEnv>();

adminAi.route('/providers', providers);
adminAi.route('/models', models);
adminAi.route('/routes', routes);
adminAi.route('/usage', usage);
adminAi.route('/config', config);
adminAi.route('/overview', overview);
adminAi.route('/traces', traces);
adminAi.route('/playground', playground);
adminAi.route('/prompt-templates', templates);

export default adminAi;
