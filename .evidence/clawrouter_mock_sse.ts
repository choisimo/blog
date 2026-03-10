import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
...
      req.on("end", () => {
        const parsed = JSON.parse(body) as { stream?: boolean };
        if (parsed.stream) {
          // SSE streaming response
          res.writeHead(200, { "Content-Type": "text/event-stream" });
          res.write(
            'data: {"id":"test","object":"chat.completion.chunk","choices":[{"delta":{"role":"assistant"},"index":0,"finish_reason":null}]}\n\n',
          );
          res.write(
            'data: {"id":"test","object":"chat.completion.chunk","choices":[{"delta":{"content":"Test"},"index":0,"finish_reason":null}]}\n\n',
          );
          res.write(
            'data: {"id":"test","object":"chat.completion.chunk","choices":[{"delta":{},"index":0,"finish_reason":"stop"}]}\n\n',
          );
          res.write("data: [DONE]\n\n");
          res.end();
        }
      });
...