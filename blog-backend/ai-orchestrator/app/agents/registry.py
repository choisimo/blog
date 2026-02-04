"""Agent registry for managing and running AI agents.

Agents are LangChain-based workflows that can use tools and maintain conversation context.
This module provides registration, discovery, and execution of agents.
"""

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

import structlog

logger = structlog.get_logger()


@dataclass
class AgentResult:
    """Result from an agent execution."""
    
    output: str
    actions: list[dict] | None = None
    metadata: dict | None = field(default_factory=dict)


@runtime_checkable
class Agent(Protocol):
    """Protocol for AI agents."""
    
    name: str
    description: str
    
    async def arun(
        self,
        input: str,
        session_id: str | None = None,
        context: dict | None = None,
    ) -> AgentResult:
        """Execute the agent with given input."""
        ...


class BaseAgent:
    """Base class for AI agents with common functionality."""
    
    name: str = "base"
    description: str = "Base agent"
    
    def __init__(self) -> None:
        self.logger = structlog.get_logger().bind(agent=self.name)
    
    async def arun(
        self,
        input: str,
        session_id: str | None = None,
        context: dict | None = None,
    ) -> AgentResult:
        """Execute the agent. Override in subclasses."""
        raise NotImplementedError("Subclasses must implement arun()")


class ChatAgent(BaseAgent):
    """Simple chat agent for general conversations.
    
    Uses the default chat model for conversational responses.
    """
    
    name = "chat"
    description = "General-purpose chat agent for conversations"
    
    async def arun(
        self,
        input: str,
        session_id: str | None = None,
        context: dict | None = None,
    ) -> AgentResult:
        from app.tools.llm import get_llm_client
        from app.config import get_settings
        
        settings = get_settings()
        client = get_llm_client()
        
        messages = []
        
        # Add system message if provided in context
        if context and context.get("system_prompt"):
            messages.append({"role": "system", "content": context["system_prompt"]})
        
        # Add conversation history if provided
        if context and context.get("history"):
            messages.extend(context["history"])
        
        # Add current user input
        messages.append({"role": "user", "content": input})
        
        self.logger.info("agent_executing", input_length=len(input), session_id=session_id)
        
        response = await client.acompletion(
            model=settings.default_chat_model,
            messages=messages,
            temperature=0.7,
        )
        
        output = response.choices[0].message.content or ""
        
        return AgentResult(
            output=output,
            metadata={
                "model": response.model,
                "usage": response.usage.model_dump() if response.usage else None,
            },
        )


class AnalysisAgent(BaseAgent):
    """Agent for structured analysis tasks.
    
    Provides multi-perspective analysis of content (sketch, prism, chain).
    """
    
    name = "analysis"
    description = "Agent for structured content analysis (sketch, prism, chain)"
    
    async def arun(
        self,
        input: str,
        session_id: str | None = None,
        context: dict | None = None,
    ) -> AgentResult:
        from app.tools.llm import get_llm_client
        from app.config import get_settings
        
        settings = get_settings()
        client = get_llm_client()
        
        # Determine analysis type from context
        analysis_type = (context or {}).get("type", "sketch")
        post_title = (context or {}).get("post_title", "")
        
        system_prompts = {
            "sketch": """You are an expert at creating concise concept sketches.
Analyze the given paragraph and create a structured summary that captures:
1. Key concepts and their relationships
2. Main arguments or claims
3. Supporting evidence or examples
4. Implications or conclusions

Keep your response focused and well-organized.""",
            
            "prism": """You are an expert at multi-perspective analysis.
Analyze the given paragraph from multiple viewpoints:
1. Logical/Analytical perspective
2. Creative/Intuitive perspective  
3. Critical/Skeptical perspective
4. Practical/Applied perspective
5. Historical/Contextual perspective

Provide balanced insights from each angle.""",
            
            "chain": """You are an expert at chain-of-thought reasoning.
Analyze the given paragraph using step-by-step logical reasoning:
1. Identify the main claim or thesis
2. Break down the supporting arguments
3. Examine the logical connections
4. Identify any assumptions or gaps
5. Draw conclusions based on the analysis

Show your reasoning process clearly.""",
        }
        
        system_prompt = system_prompts.get(analysis_type, system_prompts["sketch"])
        
        if post_title:
            system_prompt += f"\n\nContext: This is from a blog post titled '{post_title}'."
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": input},
        ]
        
        self.logger.info(
            "analysis_executing",
            analysis_type=analysis_type,
            input_length=len(input),
        )
        
        response = await client.acompletion(
            model=settings.default_chat_model,
            messages=messages,
            temperature=0.3,  # Lower temperature for analysis
        )
        
        output = response.choices[0].message.content or ""
        
        return AgentResult(
            output=output,
            metadata={
                "analysis_type": analysis_type,
                "model": response.model,
            },
        )


# Agent registry
_AGENTS: dict[str, BaseAgent] = {}


def _register_default_agents() -> None:
    """Register default agents."""
    global _AGENTS
    if not _AGENTS:
        _AGENTS = {
            "chat": ChatAgent(),
            "analysis": AnalysisAgent(),
        }


def get_agent(name: str) -> BaseAgent | None:
    """Get an agent by name.
    
    Args:
        name: Agent name (e.g., "chat", "analysis")
        
    Returns:
        Agent instance or None if not found
    """
    _register_default_agents()
    return _AGENTS.get(name)


def list_agents() -> list[dict]:
    """List all available agents.
    
    Returns:
        List of agent info dicts with name and description
    """
    _register_default_agents()
    return [
        {"name": agent.name, "description": agent.description}
        for agent in _AGENTS.values()
    ]


def register_agent(agent: BaseAgent) -> None:
    """Register a custom agent.
    
    Args:
        agent: Agent instance to register
    """
    _register_default_agents()
    _AGENTS[agent.name] = agent
    logger.info("agent_registered", agent=agent.name)
