import http from "http";

export interface FakeLlmServerConfig {
  port?: number;
  mode?: "auto_retry" | "over_limit_refund" | "quota_exhausted" | "custom";
  customProposal?: Record<string, unknown>;
}

export function createFakeLlmServer(config: FakeLlmServerConfig = {}) {
  let currentMode = config.mode || "auto_retry";
  let customProposal = config.customProposal;

  const server = http.createServer((req, res) => {
    const url = req.url || "";

    if (req.method === "POST" && url === "/mode") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          currentMode = parsed.mode || "auto_retry";
          customProposal = parsed.custom;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "OK", mode: currentMode }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (req.method === "POST" && (url.includes("/chat/completions") || url.endsWith("/completions"))) {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });

      req.on("end", () => {
        if (currentMode === "quota_exhausted") {
          res.writeHead(429, {
            "Content-Type": "application/json",
            "Retry-After": "1800",
          });
          res.end(JSON.stringify({ error: "Daily provider quota exhausted (429)" }));
          return;
        }

        let proposalContent: Record<string, unknown>;

        if (currentMode === "over_limit_refund") {
          proposalContent = {
            action: "refund",
            amount: 75.0,
            currency: "USD",
            confidence: 0.95,
            reasoning: "Substantial charge decline of 75.00 for order with instrument failure.",
            message: "We are processing a refund for your order.",
          };
        } else if (currentMode === "custom" && customProposal) {
          proposalContent = customProposal;
        } else {
          // Default: auto_retry
          proposalContent = {
            action: "retry",
            confidence: 0.95,
            reasoning: "Transient instrument decline; safe automatic capture retry is recommended.",
            message: "Your payment card encountered a temporary decline. We will re-attempt the charge.",
          };
        }

        const responsePayload = {
          id: `chatcmpl_fake_${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: "fake-nemotron-free",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify(proposalContent),
              },
              finish_reason: "stop",
            },
          ],
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(responsePayload));
      });
      return;
    }

    // Health probe / key probe
    if (url.includes("/key") || url.includes("/models") || url.includes("/health") || url.includes("/ready")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "OK",
          data: {
            limit: 100,
            usage: 2,
            is_free_tier: true,
          },
        })
      );
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  return {
    server,
    setMode: async (mode: FakeLlmServerConfig["mode"], custom?: Record<string, unknown>) => {
      currentMode = mode || "auto_retry";
      customProposal = custom;
      const fakeUrl = process.env.FAKE_LLM_URL || "http://localhost:4040";
      try {
        await fetch(`${fakeUrl}/mode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, custom }),
        }).catch(() => {});
      } catch {
        // ignore
      }
    },
    listen: (port = config.port || 4040): Promise<number> => {
      return new Promise((resolve, reject) => {
        server.on("error", (err: unknown) => {
          if ((err as { code?: string })?.code === "EADDRINUSE") {
            // Already running externally (e.g. in docker-compose.e2e.yml)
            resolve(port);
          } else {
            reject(err);
          }
        });
        server.listen(port, () => {
          const addr = server.address();
          const actualPort = typeof addr === "object" && addr ? addr.port : port;
          resolve(actualPort);
        });
      });
    },
    close: (): Promise<void> => {
      return new Promise((resolve) => {
        if (!server.listening) {
          resolve();
          return;
        }
        server.close(() => resolve());
      });
    },
  };
}

if (process.argv[1]?.endsWith("fake-llm-server.ts")) {
  const port = parseInt(process.env.PORT || "4040", 10);
  const server = createFakeLlmServer({ port });
  server.listen(port).then((p) => {
    console.log(`Fake OpenAI-compatible LLM server running on port ${p}`);
  });
}

