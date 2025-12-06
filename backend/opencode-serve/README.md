## Proxy Server (Auto Proxy) -> AI server
request : /session, /session/{id}/message
response : 

### Bad Request 400 error
- Authorization header is required (Bearer token)

## AI Agent 설정
{
  "agent": {
    "default": {
      "models": ["gpt-4.1", "gpt-4o"]
    },
    "build": {
      "models": ["gpt-4o"]
    }
  }
}
