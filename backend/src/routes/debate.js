import { Router } from "express";
import crypto from "crypto";
import { aiService } from "../lib/ai-service.js";
import { AI_MODELS } from "../config/constants.js";

const router = Router();

// In-memory session storage
const debateSessions = new Map();

/**
 * POST /api/v1/debate/sessions
 * Create a new debate session
 * Body: { topicTitle, topicDescription?, rounds? }
 */
router.post("/sessions", async (req, res, next) => {
  try {
    const { topicTitle, topicDescription, rounds = 5 } = req.body;

    // Validate required fields
    if (!topicTitle || typeof topicTitle !== "string") {
      return res.status(400).json({
        ok: false,
        error: "topicTitle is required and must be a string",
      });
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const session = {
      id: sessionId,
      topicTitle,
      topicDescription: topicDescription || "",
      rounds,
      currentRound: 0,
      history: [], // Array of all messages from all rounds
      votes: {}, // { roundNumber: { attacker: count, defender: count } }
      status: "active",
      createdAt: new Date().toISOString(),
    };

    debateSessions.set(sessionId, session);

    // Return session info that matches frontend expectation
    res.status(201).json({
      ok: true,
      data: {
        sessionId,
        topicId: sessionId,
        topic: {
          title: topicTitle,
          description: topicDescription,
        },
        agents: [
          { name: "찬성자", role: "defender", color: "#22c55e" },
          { name: "반대자", role: "attacker", color: "#ef4444" },
          { name: "진행자", role: "moderator", color: "#3b82f6" },
        ],
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/debate/sessions/:sessionId/round
 * Generate next round of debate
 */
router.post("/sessions/:sessionId/round", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = debateSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        ok: false,
        error: "Session not found",
      });
    }

    if (session.status !== "active") {
      return res.status(400).json({
        ok: false,
        error: "Session is not active",
      });
    }

    session.currentRound += 1;

    // Validate round limit
    if (session.currentRound > session.rounds) {
      return res.status(400).json({
        ok: false,
        error: `Cannot exceed ${session.rounds} rounds`,
      });
    }

    // Generate debate positions using AI
    let defenderPosition = "";
    let attackerPosition = "";

    try {
      const roundPrompt = `You are facilitating a debate about: "${session.topicTitle}"
${session.topicDescription ? `Context: ${session.topicDescription}` : ""}

This is round ${session.currentRound} of a ${session.rounds}-round debate.

Generate a response from the perspective of someone defending this position. Be concise and compelling. One paragraph only.`;

      defenderPosition = await aiService.generate(roundPrompt, {
        model: AI_MODELS.DEFAULT,
        temperature: 0.7,
      });
    } catch (error) {
      defenderPosition = `찬성자의 입장: 이 주제에 대해 저는 긍정적인 견해를 가지고 있습니다.`;
    }

    try {
      const roundPrompt = `You are facilitating a debate about: "${session.topicTitle}"
${session.topicDescription ? `Context: ${session.topicDescription}` : ""}

This is round ${session.currentRound} of a ${session.rounds}-round debate.

Generate a response from the perspective of someone attacking/opposing this position. Be concise and compelling. One paragraph only.`;

      attackerPosition = await aiService.generate(roundPrompt, {
        model: AI_MODELS.DEFAULT,
        temperature: 0.7,
      });
    } catch (error) {
      attackerPosition = `반대자의 입장: 이 주제에 대해 저는 비판적인 관점을 가지고 있습니다.`;
    }

    // Create messages for this round
    const messages = [
      {
        role: "defender",
        name: "찬성자",
        content: defenderPosition,
        color: "#22c55e",
      },
      {
        role: "attacker",
        name: "반대자",
        content: attackerPosition,
        color: "#ef4444",
      },
    ];

    // Store in history
    session.history.push(...messages);

    // Initialize vote count for this round if not exists
    if (!session.votes[session.currentRound]) {
      session.votes[session.currentRound] = { attacker: 0, defender: 0 };
    }

    res.json({
      ok: true,
      data: {
        roundNumber: session.currentRound,
        messages,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/debate/sessions/:sessionId/vote
 * Record user vote for current round
 * Body: { roundNumber, votedFor: 'attacker' | 'defender' }
 */
router.post("/sessions/:sessionId/vote", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { roundNumber, votedFor } = req.body;

    const session = debateSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        ok: false,
        error: "Session not found",
      });
    }

    if (!["attacker", "defender"].includes(votedFor)) {
      return res.status(400).json({
        ok: false,
        error: 'votedFor must be "attacker" or "defender"',
      });
    }

    // Initialize vote count for this round if not exists
    if (!session.votes[roundNumber]) {
      session.votes[roundNumber] = { attacker: 0, defender: 0 };
    }

    // Record vote
    session.votes[roundNumber][votedFor] += 1;

    res.json({
      ok: true,
      data: {
        votes: session.votes[roundNumber],
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/debate/sessions/:sessionId/end
 * End debate and determine winner
 */
router.post("/sessions/:sessionId/end", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = debateSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        ok: false,
        error: "Session not found",
      });
    }

    session.status = "ended";

    // Determine winner based on votes
    let totalDefender = 0;
    let totalAttacker = 0;

    Object.values(session.votes).forEach((roundVotes) => {
      totalDefender += roundVotes.defender || 0;
      totalAttacker += roundVotes.attacker || 0;
    });

    let winner = null;
    if (totalDefender > totalAttacker) {
      winner = "찬성자";
    } else if (totalAttacker > totalDefender) {
      winner = "반대자";
    }
    // If equal, winner is null (draw)

    // Optional: Generate summary using AI
    let summary = "";
    try {
      const historyText = session.history
        .map((msg) => `${msg.name}: ${msg.content}`)
        .join("\n\n");

      const summaryPrompt = `Provide a brief summary of this debate:

Topic: ${session.topicTitle}

Debate arguments:
${historyText}

Write 1-2 sentences summarizing the key points and outcome.`;

      summary = await aiService.generate(summaryPrompt, {
        model: AI_MODELS.DEFAULT,
        temperature: 0.5,
      });
    } catch (error) {
      summary = `The debate on "${session.topicTitle}" concluded with ${winner ? `${winner} winning` : "a draw"}.`;
    }

    res.json({
      ok: true,
      data: {
        winner,
        summary,
        finalVotes: {
          defender: totalDefender,
          attacker: totalAttacker,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
