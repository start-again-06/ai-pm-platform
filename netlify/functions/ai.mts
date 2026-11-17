/**
 * Server-side AI proxy. The Anthropic API key never reaches the browser.
 *
 * GET  /.netlify/functions/ai  -> { configured, model }
 * POST /.netlify/functions/ai  -> body { system, messages[], maxTokens? } -> { text, model, usage }
 *
 * Environment variables (set in Netlify UI or `netlify env:set`):
 *   ANTHROPIC_API_KEY   required for AI features
 *   ANTHROPIC_MODEL     optional, defaults to claude-sonnet-5-5
 *   APP_ACCESS_TOKEN    optional; when set, POST requests must send header x-app-token
 */

const DEFAULT_MODEL = "claude-sonnet-5-5";
const MAX_SYSTEM_CHARS = 20_000;
const MAX_MESSAGE_CHARS = 30_000;
const MAX_MESSAGES = 40;
const MAX_OUTPUT_TOKENS = 4_000;
const UPSTREAM_TIMEOUT_MS = 60_000;

type Role = "user" | "assistant";
interface ChatMessage {
  role: Role;
  content: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function validate(
  body: unknown,
): { system: string; messages: ChatMessage[]; maxTokens: number } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;

  if (typeof b.system !== "string" || b.system.length === 0) return { error: "system must be a non-empty string" };
  if (b.system.length > MAX_SYSTEM_CHARS) return { error: "system prompt is too long" };

  if (!Array.isArray(b.messages) || b.messages.length === 0) return { error: "messages must be a non-empty array" };
  if (b.messages.length > MAX_MESSAGES) return { error: "too many messages" };

  const messages: ChatMessage[] = [];
  for (const m of b.messages) {
    if (!m || typeof m !== "object") return { error: "invalid message" };
    const mm = m as Record<string, unknown>;
    if (mm.role !== "user" && mm.role !== "assistant") return { error: "message role must be user or assistant" };
    if (typeof mm.content !== "string" || mm.content.trim().length === 0) return { error: "message content must be non-empty" };
    if (mm.content.length > MAX_MESSAGE_CHARS) return { error: "message is too long" };
    messages.push({ role: mm.role, content: mm.content });
  }
  if (messages[0].role !== "user") return { error: "first message must be from user" };

  const requested = typeof b.maxTokens === "number" && Number.isFinite(b.maxTokens) ? Math.floor(b.maxTokens) : 1500;
  const maxTokens = Math.min(Math.max(requested, 1), MAX_OUTPUT_TOKENS);

  return { system: b.system, messages, maxTokens };
}

export default async (req: Request): Promise<Response> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  if (req.method === "GET") {
    return json({ configured: Boolean(apiKey), model });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const requiredToken = process.env.APP_ACCESS_TOKEN;
  if (requiredToken && req.headers.get("x-app-token") !== requiredToken) {
    return json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  if (!apiKey) {
    return json(
      {
        error: "AI is not configured. Add ANTHROPIC_API_KEY in Netlify environment variables and redeploy.",
        code: "NOT_CONFIGURED",
      },
      503,
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = validate(raw);
  if ("error" in parsed) return json({ error: parsed.error }, 400);

  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: parsed.maxTokens,
        system: parsed.system,
        messages: parsed.messages,
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return json({ error: "The AI provider could not be reached. Try again." }, 502);
  }

  if (!upstream.ok) {
    // Log the status only; never log or echo request/response bodies that may contain user data or keys.
    console.error(`Anthropic API returned HTTP ${upstream.status}`);
    const message =
      upstream.status === 429
        ? "AI rate limit reached. Wait a moment and try again."
        : "The AI provider returned an error.";
    return json({ error: message }, 502);
  }

  const data = (await upstream.json()) as {
    content?: Array<{ type: string; text?: string }>;
    model?: string;
    usage?: unknown;
  };
  const text = (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();

  return json({ text, model: data.model ?? model, usage: data.usage ?? null });
};
