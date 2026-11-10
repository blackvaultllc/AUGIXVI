const OWNER_KEY = "operator-user-id";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    return jsonResponse({ error: "Not found." }, 404);
  }
}
