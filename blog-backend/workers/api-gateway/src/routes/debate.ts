import { Hono } from 'hono';
import type { HonoEnv, Env } from '../types';
import { success, badRequest, notFound, serverError } from '../lib/response';
import { getApiBaseUrl, getAiServeApiKey } from '../lib/config';

const debate = new Hono<HonoEnv>();

const DEBATE_AGENTS = {
  attacker: {
    name: '도전자',
    role: 'attacker',
    systemPrompt: `당신은 논리적이고 날카로운 토론자입니다. 주어진 주제에 대해 반론을 제기하고, 상대방의 논점에서 허점을 찾아 건설적으로 비판합니다. 존중을 유지하면서도 강력한 반대 의견을 제시하세요.`,
    color: '#ef4444',
  },
  defender: {
    name: '옹호자',
    role: 'defender',
    systemPrompt: `당신은 설득력 있는 옹호자입니다. 주어진 주제를 지지하며, 논리적인 근거와 예시를 들어 입장을 방어합니다. 상대방의 비판에 대해 침착하게 반박하면서 자신의 논점을 강화하세요.`,
    color: '#22c55e',
  },
  moderator: {
    name: '중재자',
    role: 'moderator',
    systemPrompt: `당신은 공정한 토론 중재자입니다. 양측의 논점을 요약하고, 토론이 건설적으로 진행되도록 안내합니다. 각 라운드가 끝날 때 핵심 논점을 정리하고, 청중이 이해하기 쉽게 설명해주세요.`,
    color: '#3b82f6',
  },
} as const;

type AgentRole = keyof typeof DEBATE_AGENTS;

function generateId(): string {
  return crypto.randomUUID();
}

async function callAI(
  env: Env,
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; tokensUsed?: number }> {
  const backendUrl = await getApiBaseUrl(env);
  const apiKey = await getAiServeApiKey(env);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['X-Internal-Gateway-Key'] = apiKey;
  }

  const response = await fetch(`${backendUrl}/api/v1/ai/auto-chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI call failed: ${response.status}`);
  }

  const data = await response.json() as {
    ok?: boolean;
    data?: { content?: string; message?: string; tokensUsed?: number };
    content?: string;
    message?: string;
  };

  const content = data?.data?.content || data?.data?.message || data?.content || data?.message;
  if (!content) {
    throw new Error('No content in AI response');
  }

  return {
    content,
    tokensUsed: data?.data?.tokensUsed,
  };
}

debate.post('/sessions', async (c) => {
  type CreateSessionBody = {
    topicTitle: string;
    topicDescription?: string;
    userId?: string;
    fingerprintId?: string;
  };

  const body = await c.req.json<CreateSessionBody>().catch(() => ({} as CreateSessionBody));

  if (!body.topicTitle?.trim()) {
    return badRequest(c, 'topicTitle is required');
  }

  const db = c.env.DB;

  try {
    const topicId = generateId();
    await db
      .prepare(`
        INSERT INTO debate_topics (id, title, description, created_by)
        VALUES (?, ?, ?, ?)
      `)
      .bind(topicId, body.topicTitle.trim(), body.topicDescription || null, body.userId || null)
      .run();

    const sessionId = generateId();
    await db
      .prepare(`
        INSERT INTO debate_sessions (id, topic_id, user_id, fingerprint_id)
        VALUES (?, ?, ?, ?)
      `)
      .bind(sessionId, topicId, body.userId || null, body.fingerprintId || null)
      .run();

    return success(c, {
      sessionId,
      topicId,
      topic: {
        title: body.topicTitle.trim(),
        description: body.topicDescription,
      },
      agents: Object.values(DEBATE_AGENTS).map((a) => ({
        name: a.name,
        role: a.role,
        color: a.color,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create debate session';
    console.error('Debate session creation failed:', message);
    return serverError(c, message);
  }
});

debate.get('/sessions/:id', async (c) => {
  const sessionId = c.req.param('id');
  const db = c.env.DB;

  try {
    const session = await db
      .prepare(`
        SELECT s.*, t.title, t.description
        FROM debate_sessions s
        JOIN debate_topics t ON s.topic_id = t.id
        WHERE s.id = ?
      `)
      .bind(sessionId)
      .first<{
        id: string;
        topic_id: string;
        status: string;
        total_rounds: number;
        title: string;
        description: string;
      }>();

    if (!session) {
      return notFound(c, 'Debate session not found');
    }

    const messages = await db
      .prepare(`
        SELECT * FROM debate_messages WHERE session_id = ? ORDER BY round_number, created_at
      `)
      .bind(sessionId)
      .all<{
        id: string;
        agent_role: string;
        agent_name: string;
        content: string;
        round_number: number;
        created_at: string;
      }>();

    return success(c, {
      session: {
        id: session.id,
        status: session.status,
        totalRounds: session.total_rounds,
      },
      topic: {
        id: session.topic_id,
        title: session.title,
        description: session.description,
      },
      messages: messages.results || [],
      agents: Object.values(DEBATE_AGENTS).map((a) => ({
        name: a.name,
        role: a.role,
        color: a.color,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch debate session';
    console.error('Debate session fetch failed:', message);
    return serverError(c, message);
  }
});

debate.post('/sessions/:id/round', async (c) => {
  const sessionId = c.req.param('id');
  const db = c.env.DB;

  try {
    const session = await db
      .prepare(`
        SELECT s.*, t.title, t.description
        FROM debate_sessions s
        JOIN debate_topics t ON s.topic_id = t.id
        WHERE s.id = ? AND s.status = 'active'
      `)
      .bind(sessionId)
      .first<{
        id: string;
        topic_id: string;
        total_rounds: number;
        title: string;
        description: string;
      }>();

    if (!session) {
      return notFound(c, 'Active debate session not found');
    }

    const roundNumber = session.total_rounds + 1;

    const previousMessages = await db
      .prepare(`
        SELECT agent_role, agent_name, content, round_number 
        FROM debate_messages 
        WHERE session_id = ? 
        ORDER BY round_number, created_at
      `)
      .bind(sessionId)
      .all<{
        agent_role: string;
        agent_name: string;
        content: string;
        round_number: number;
      }>();

    const conversationHistory = (previousMessages.results || [])
      .map((m) => `[${m.agent_name}] ${m.content}`)
      .join('\n\n');

    const topicContext = `주제: ${session.title}\n${session.description ? `설명: ${session.description}` : ''}`;

    const generateAgentResponse = async (role: AgentRole): Promise<{
      content: string;
      responseTimeMs: number;
      tokensUsed?: number;
    }> => {
      const agent = DEBATE_AGENTS[role];
      const startTime = Date.now();

      let prompt = `${topicContext}\n\n`;
      if (conversationHistory) {
        prompt += `이전 토론 내용:\n${conversationHistory}\n\n`;
      }

      if (role === 'attacker') {
        prompt += roundNumber === 1
          ? '이 주제에 대한 첫 번째 반론을 제시해주세요. 2-3문장으로 핵심적인 비판점을 짚어주세요.'
          : '옹호자의 주장에 대해 반박해주세요. 2-3문장으로 논점을 강화해주세요.';
      } else if (role === 'defender') {
        prompt += roundNumber === 1
          ? '이 주제를 지지하는 첫 번째 논거를 제시해주세요. 2-3문장으로 핵심적인 지지 근거를 설명해주세요.'
          : '도전자의 비판에 대해 반박하고 입장을 방어해주세요. 2-3문장으로 답변해주세요.';
      } else {
        prompt += `라운드 ${roundNumber}의 토론 내용을 간단히 요약하고, 양측의 핵심 논점을 정리해주세요. 2-3문장으로 작성해주세요.`;
      }

      const result = await callAI(c.env, agent.systemPrompt, prompt);
      const responseTimeMs = Date.now() - startTime;

      return {
        content: result.content,
        responseTimeMs,
        tokensUsed: result.tokensUsed,
      };
    };

    const [defenderResponse, attackerResponse] = await Promise.all([
      generateAgentResponse('defender'),
      generateAgentResponse('attacker'),
    ]);

    const moderatorResponse = await generateAgentResponse('moderator');

    const responses = [
      { role: 'defender' as AgentRole, ...defenderResponse },
      { role: 'attacker' as AgentRole, ...attackerResponse },
      { role: 'moderator' as AgentRole, ...moderatorResponse },
    ];

    for (const resp of responses) {
      const agent = DEBATE_AGENTS[resp.role];
      await db
        .prepare(`
          INSERT INTO debate_messages (id, session_id, agent_role, agent_name, content, round_number, response_time_ms, tokens_used)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          generateId(),
          sessionId,
          resp.role,
          agent.name,
          resp.content,
          roundNumber,
          resp.responseTimeMs,
          resp.tokensUsed || null
        )
        .run();
    }

    await db
      .prepare(`
        UPDATE debate_sessions SET total_rounds = ?, updated_at = datetime('now') WHERE id = ?
      `)
      .bind(roundNumber, sessionId)
      .run();

    return success(c, {
      roundNumber,
      messages: responses.map((r) => ({
        role: r.role,
        name: DEBATE_AGENTS[r.role].name,
        content: r.content,
        color: DEBATE_AGENTS[r.role].color,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate debate round';
    console.error('Debate round generation failed:', message);
    return serverError(c, message);
  }
});

debate.post('/sessions/:id/vote', async (c) => {
  const sessionId = c.req.param('id');

  type VoteBody = {
    roundNumber: number;
    votedFor: 'attacker' | 'defender';
    userId?: string;
    fingerprintId?: string;
  };

  const body = await c.req.json<VoteBody>().catch(() => ({} as VoteBody));

  if (!body.roundNumber || !body.votedFor) {
    return badRequest(c, 'roundNumber and votedFor are required');
  }

  if (!['attacker', 'defender'].includes(body.votedFor)) {
    return badRequest(c, 'votedFor must be "attacker" or "defender"');
  }

  const db = c.env.DB;

  try {
    await db
      .prepare(`
        INSERT INTO debate_votes (id, session_id, round_number, user_id, fingerprint_id, voted_for)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id, round_number, fingerprint_id)
        DO UPDATE SET voted_for = ?, created_at = datetime('now')
      `)
      .bind(
        generateId(),
        sessionId,
        body.roundNumber,
        body.userId || null,
        body.fingerprintId || 'anonymous',
        body.votedFor,
        body.votedFor
      )
      .run();

    const votes = await db
      .prepare(`
        SELECT voted_for, COUNT(*) as count 
        FROM debate_votes 
        WHERE session_id = ? AND round_number = ?
        GROUP BY voted_for
      `)
      .bind(sessionId, body.roundNumber)
      .all<{ voted_for: string; count: number }>();

    const voteCount: Record<string, number> = {};
    for (const v of votes.results || []) {
      voteCount[v.voted_for] = v.count;
    }

    return success(c, {
      recorded: true,
      roundNumber: body.roundNumber,
      votes: {
        attacker: voteCount.attacker || 0,
        defender: voteCount.defender || 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to record vote';
    console.error('Vote recording failed:', message);
    return serverError(c, message);
  }
});

debate.post('/sessions/:id/end', async (c) => {
  const sessionId = c.req.param('id');
  const db = c.env.DB;

  try {
    const votes = await db
      .prepare(`
        SELECT voted_for, COUNT(*) as count 
        FROM debate_votes 
        WHERE session_id = ?
        GROUP BY voted_for
      `)
      .bind(sessionId)
      .all<{ voted_for: string; count: number }>();

    let winner: string | null = null;
    let maxVotes = 0;

    for (const v of votes.results || []) {
      if (v.count > maxVotes) {
        maxVotes = v.count;
        winner = v.voted_for;
      }
    }

    await db
      .prepare(`
        UPDATE debate_sessions 
        SET status = 'completed', winner_agent = ?, ended_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `)
      .bind(winner, sessionId)
      .run();

    return success(c, {
      status: 'completed',
      winner: winner ? DEBATE_AGENTS[winner as AgentRole]?.name || winner : null,
      winnerRole: winner,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to end debate';
    console.error('Debate ending failed:', message);
    return serverError(c, message);
  }
});

export default debate;
