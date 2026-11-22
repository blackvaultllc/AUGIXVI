const OWNER_KEY = "operator-user-id";
const SETTINGS_KEY = "operator-settings";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The owner's stage settings as held by the registry (one operator, one record). */
export interface StoredSettingsRecord {
  settings: Record<string, unknown>;
  updatedAt: string;
}

function isSettingsRecord(value: unknown): value is StoredSettingsRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "settings" in value &&
    typeof value.settings === "object" &&
    value.settings !== null &&
    !Array.isArray(value.settings) &&
    "updatedAt" in value &&
    typeof value.updatedAt === "string" &&
    value.updatedAt.length > 0 &&
    value.updatedAt.length <= 64
  );
}

interface RegistryTransaction {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

interface RegistryStorage extends RegistryTransaction {
  transaction<T>(callback: (transaction: RegistryTransaction) => Promise<T>): Promise<T>;
}

interface RegistryState {
  storage: RegistryStorage;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function readUserId(request: Request): Promise<string | Response> {
  let input: unknown;
  try {
    input = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) return jsonResponse({ error: "Invalid JSON." }, 400);
    throw error;
  }

  const userId =
    typeof input === "object" &&
    input !== null &&
    "userId" in input &&
    typeof input.userId === "string"
      ? input.userId
      : "";
  return UUID_PATTERN.test(userId) ? userId : jsonResponse({ error: "Invalid user ID." }, 400);
}

export class OperatorRegistry {
  constructor(private readonly state: RegistryState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/status") {
      const ownerId = await this.state.storage.get<string>(OWNER_KEY);
      return jsonResponse({ claimed: typeof ownerId === "string" });
    }

    if (request.method === "POST" && url.pathname === "/check") {
      const userId = await readUserId(request);
      if (userId instanceof Response) return userId;

      const ownerId = await this.state.storage.get<string>(OWNER_KEY);
      return jsonResponse({
        claimed: typeof ownerId === "string",
        isOwner: ownerId === userId,
      });
    }

    if (request.method === "POST" && url.pathname === "/authorize") {
      const userId = await readUserId(request);
      if (userId instanceof Response) return userId;

      const authorized = await this.state.storage.transaction(async (transaction) => {
        const ownerId = await transaction.get<string>(OWNER_KEY);
        if (ownerId) return ownerId === userId;
        await transaction.put(OWNER_KEY, userId);
        return true;
      });

      return jsonResponse({ authorized });
    }

    // The owner's saved stage settings. Single-owner registry: there is
    // exactly one record, and these endpoints are only ever reached through
    // server functions that have already verified the operator session
    // (registry ownership + MFA) — the same trust shape as the gate log.
    if (request.method === "GET" && url.pathname === "/settings") {
      const record = await this.state.storage.get<StoredSettingsRecord>(SETTINGS_KEY);
      return jsonResponse({ settings: isSettingsRecord(record) ? record : null });
    }

    if (request.method === "POST" && url.pathname === "/settings") {
      let input: unknown;
      try {
        input = await request.json();
      } catch (error) {
        if (error instanceof SyntaxError) return jsonResponse({ error: "Invalid JSON." }, 400);
        throw error;
      }
      if (!isSettingsRecord(input)) {
        return jsonResponse({ error: "Invalid settings record." }, 400);
      }
      await this.state.storage.put(SETTINGS_KEY, input);
      return jsonResponse({ saved: true });
    }

    return jsonResponse({ error: "Not found." }, 404);
  }
}
