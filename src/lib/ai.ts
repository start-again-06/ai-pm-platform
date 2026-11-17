// Browser-side client for the server-side AI proxy in netlify/functions/ai.mts.
// The Anthropic key never leaves the server.

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIStatus {
  configured: boolean;
  model?: string;
}

const ENDPOINT = "/.netlify/functions/ai";
const TOKEN_KEY = "aipm.accessToken";

export function getAccessToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAccessToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: token simply isn't remembered */
  }
}

function headers(): HeadersInit {
  const h: Record<string, string> = { "content-type": "application/json" };
  const token = getAccessToken();
  if (token) h["x-app-token"] = token;
  return h;
}

export async function getAIStatus(): Promise<AIStatus> {
  try {
    const res = await fetch(ENDPOINT, { headers: headers() });
    if (!res.ok) return { configured: false };
    return (await res.json()) as AIStatus;
  } catch {
    return { configured: false };
  }
}

export async function askAI(opts: { system: string; messages: AIMessage[]; maxTokens?: number }): Promise<string> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(opts),
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string; code?: string };
  if (!res.ok) {
    if (res.status === 401) throw new Error("Access token rejected. Update it in Settings.");
    throw new Error(data.error ?? `AI request failed (HTTP ${res.status}).`);
  }
  return data.text ?? "";
}
