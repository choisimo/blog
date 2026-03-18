import { Hono } from 'hono';
import type { HonoEnv } from '../../types';
import { success, error, badRequest, notFound } from '../../lib/response';
import { requireAdmin } from '../../middleware/auth';
import { queryOne, queryAll, execute } from '../../lib/d1';
import { generateId } from './types';
import type { PromptTemplate } from './types';

const templates = new Hono<HonoEnv>();

templates.get('/', requireAdmin, async (c) => {
  const category = c.req.query('category');

  try {
    let query = `SELECT * FROM ai_prompt_templates WHERE 1=1`;
    const params: string[] = [];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    query += ` ORDER BY usage_count DESC, name ASC`;

    const templatesList = await queryAll<PromptTemplate>(c.env.DB, query, ...params);

    return success(c, {
      templates: templatesList,
      total: templatesList.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch templates';
    return error(c, message, 500);
  }
});

templates.post('/', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const {
    name,
    description,
    category = 'general',
    system_prompt,
    user_prompt_template,
    variables,
    default_model_id,
    default_temperature = 0.7,
    default_max_tokens,
    is_public = false,
  } = body as {
    name?: string;
    description?: string;
    category?: string;
    system_prompt?: string;
    user_prompt_template?: string;
    variables?: string[];
    default_model_id?: string;
    default_temperature?: number;
    default_max_tokens?: number;
    is_public?: boolean;
  };

  if (!name || !user_prompt_template) {
    return badRequest(c, 'name and user_prompt_template are required');
  }

  const id = generateId('pt');

  try {
    await execute(
      c.env.DB,
      `INSERT INTO ai_prompt_templates (
        id, name, description, category, system_prompt, user_prompt_template,
        variables, default_model_id, default_temperature, default_max_tokens, is_public
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      name,
      description || null,
      category,
      system_prompt || null,
      user_prompt_template,
      variables ? JSON.stringify(variables) : null,
      default_model_id || null,
      default_temperature,
      default_max_tokens || null,
      is_public ? 1 : 0
    );

    const template = await queryOne<PromptTemplate>(
      c.env.DB,
      `SELECT * FROM ai_prompt_templates WHERE id = ?`,
      id
    );

    return success(c, { template }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create template';
    if (message.includes('UNIQUE constraint')) {
      return badRequest(c, `Template with name '${name}' already exists`);
    }
    return error(c, message, 500);
  }
});

templates.put('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  try {
    const existing = await queryOne<PromptTemplate>(
      c.env.DB,
      `SELECT * FROM ai_prompt_templates WHERE id = ?`,
      id
    );

    if (!existing) {
      return notFound(c, `Template not found: ${id}`);
    }

    const {
      name,
      description,
      category,
      system_prompt,
      user_prompt_template,
      variables,
      default_model_id,
      default_temperature,
      default_max_tokens,
      is_public,
    } = body as Partial<{
      name: string;
      description: string;
      category: string;
      system_prompt: string;
      user_prompt_template: string;
      variables: string[];
      default_model_id: string;
      default_temperature: number;
      default_max_tokens: number;
      is_public: boolean;
    }>;

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }
    if (system_prompt !== undefined) {
      updates.push('system_prompt = ?');
      values.push(system_prompt || null);
    }
    if (user_prompt_template !== undefined) {
      updates.push('user_prompt_template = ?');
      values.push(user_prompt_template);
    }
    if (variables !== undefined) {
      updates.push('variables = ?');
      values.push(JSON.stringify(variables));
    }
    if (default_model_id !== undefined) {
      updates.push('default_model_id = ?');
      values.push(default_model_id || null);
    }
    if (default_temperature !== undefined) {
      updates.push('default_temperature = ?');
      values.push(default_temperature);
    }
    if (default_max_tokens !== undefined) {
      updates.push('default_max_tokens = ?');
      values.push(default_max_tokens);
    }
    if (is_public !== undefined) {
      updates.push('is_public = ?');
      values.push(is_public ? 1 : 0);
    }

    if (updates.length === 0) {
      return badRequest(c, 'No fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await execute(
      c.env.DB,
      `UPDATE ai_prompt_templates SET ${updates.join(', ')} WHERE id = ?`,
      ...values
    );

    const template = await queryOne<PromptTemplate>(
      c.env.DB,
      `SELECT * FROM ai_prompt_templates WHERE id = ?`,
      id
    );

    return success(c, { template });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update template';
    return error(c, message, 500);
  }
});

templates.delete('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const existing = await queryOne(
      c.env.DB,
      `SELECT id FROM ai_prompt_templates WHERE id = ?`,
      id
    );

    if (!existing) {
      return notFound(c, `Template not found: ${id}`);
    }

    await execute(c.env.DB, `DELETE FROM ai_prompt_templates WHERE id = ?`, id);

    return success(c, { deleted: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete template';
    return error(c, message, 500);
  }
});

templates.post('/:id/use', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const template = await queryOne<PromptTemplate>(
      c.env.DB,
      `SELECT * FROM ai_prompt_templates WHERE id = ?`,
      id
    );

    if (!template) {
      return notFound(c, `Template not found: ${id}`);
    }

    await execute(
      c.env.DB,
      `UPDATE ai_prompt_templates SET usage_count = usage_count + 1 WHERE id = ?`,
      id
    );

    return success(c, {
      template: { ...template, usage_count: template.usage_count + 1 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to use template';
    return error(c, message, 500);
  }
});

export default templates;
