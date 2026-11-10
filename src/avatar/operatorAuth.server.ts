import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

type OperatorTokenInput = { token: string };
type OperatorSessionInput = { accessToken: string };
type RegistryBinding = {
  idFromName: (name: string) => unknown;
  get: (id: unknown) => { fetch: (request: Request) => Promise<Response> };
};
type RequestWithCloudflareEnv = Request & {
  runtime?: { cloudflare?: { env?: Record<string, unknown> } };
};

function isOperatorTokenInput(input: unknown): input is OperatorTokenInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "token" in input &&
    typeof input.token === "string" &&
    input.token.length > 0 &&
    input.token.length <= 512
  );
}

async function matchesSecret(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(providedDigest);
  const right = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function isOperatorSessionInput(input: unknown): input is OperatorSessionInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "accessToken" in input &&
    typeof input.accessToken === "string" &&
    input.accessToken.length > 0 &&
    input.accessToken.length <= 16_384
  );
}

function getSupabaseConfig() {
  const url = import.meta.env["VITE_SUPABASE_URL"]?.trim().replace(/\/+$/, "");
  const publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim();
  return url && publishableKey ? { url, publishableKey } : null;
}

function getRegistryBinding(): RegistryBinding | null {
  const request = getRequest() as RequestWithCloudflareEnv;
  const binding: unknown = request.runtime?.cloudflare?.env?.["OSIRIS_OPERATOR_REGISTRY"];
  if (
    typeof binding !== "object" ||
    binding === null ||
    !("idFromName" in binding) ||
    typeof binding.idFromName !== "function" ||
    !("get" in binding) ||
    typeof binding.get !== "function"
  ) {
    return null;
  }
  return binding as RegistryBinding;
}

function getRegistryStub() {
  const binding = getRegistryBinding();
  if (!binding) return null;
  return binding.get(binding.idFromName("operator"));
}

async function requestRegistry(path: string, init?: RequestInit): Promise<Response | null> {
  const stub = getRegistryStub();
  if (!stub) return null;
  return stub.fetch(new Request(`https://operator-registry${path}`, init));
}

async function readTokenClaims(
  token: string,
): Promise<{ subject: string; assuranceLevel: string } | null> {
  const encodedPayload = token.split(".")[1];
  if (!encodedPayload) return null;

  try {
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (
      typeof claims !== "object" ||
      claims === null ||
      !("sub" in claims) ||
      typeof claims.sub !== "string" ||
      !("aal" in claims) ||
      typeof claims.aal !== "string"
    ) {
      return null;
    }
    return { subject: claims.sub, assuranceLevel: claims.aal };
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof DOMException) return null;
    throw error;
  }
}

export const verifyOperatorAccess = createServerFn({ method: "POST" })
  .validator((input: unknown): OperatorTokenInput => {
    if (!isOperatorTokenInput(input)) {
      throw new Error("Invalid operator verification request.");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const expected = process.env["AUGI_OPERATOR_TOKEN"];
    if (!expected || expected.length < 32) {
      return { configured: false, authorized: false, operatorName: null };
    }
    const authorized = await matchesSecret(data.token, expected);
    const operatorName = authorized ? process.env["OSIRIS_OPERATOR_NAME"]?.trim() || null : null;
    return { configured: true, authorized, operatorName };
  });

export const getOperatorBootstrapStatus = createServerFn({ method: "GET" }).handler(async () => {
  if (!getSupabaseConfig()) return { configured: false, claimed: false };

  const response = await requestRegistry("/status");
  if (!response) return { configured: false, claimed: false };
  if (!response.ok) {
    throw new Error(`Operator registry status failed with status ${response.status}.`);
  }
  const result: unknown = await response.json();
  const claimed =
    typeof result === "object" &&
    result !== null &&
    "claimed" in result &&
    typeof result.claimed === "boolean"
      ? result.claimed
      : null;
  if (claimed === null) throw new Error("Operator registry returned an invalid status.");
  return { configured: true, claimed };
});

export const verifySupabaseOperatorSession = createServerFn({ method: "POST" })
  .validator((input: unknown): OperatorSessionInput => {
    if (!isOperatorSessionInput(input)) {
      throw new Error("Invalid operator session request.");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const config = getSupabaseConfig();
    if (!config || !getRegistryBinding()) {
      return {
        configured: false,
        authorized: false,
        requiresMfa: false,
        operatorName: null,
        operatorFullName: null,
      };
    }

    const response = await fetch(new URL("/auth/v1/user", config.url), {
      method: "GET",
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${data.accessToken}`,
      },
    });
    if (response.status === 401 || response.status === 403) {
      return { configured: true, authorized: false, requiresMfa: false };
    }
    if (!response.ok) {
      throw new Error(`Supabase Auth session verification failed with status ${response.status}.`);
    }

    const user: unknown = await response.json();
    const userId =
      typeof user === "object" && user !== null && "id" in user && typeof user.id === "string"
        ? user.id
        : "";
    const claims = await readTokenClaims(data.accessToken);
    if (!userId || !claims || claims.subject !== userId) {
      return { configured: true, authorized: false, requiresMfa: false };
    }

    const checkResponse = await requestRegistry("/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!checkResponse) {
      return {
        configured: false,
        authorized: false,
        requiresMfa: false,
        operatorName: null,
        operatorFullName: null,
      };
    }
    if (!checkResponse.ok) {
      throw new Error(`Operator registry check failed with status ${checkResponse.status}.`);
    }
    const checkResult: unknown = await checkResponse.json();
    const registryState =
      typeof checkResult === "object" &&
      checkResult !== null &&
      "claimed" in checkResult &&
      typeof checkResult.claimed === "boolean" &&
      "isOwner" in checkResult &&
      typeof checkResult.isOwner === "boolean"
        ? { claimed: checkResult.claimed, isOwner: checkResult.isOwner }
        : null;
    if (!registryState) throw new Error("Operator registry returned an invalid identity check.");
    if (registryState.claimed && !registryState.isOwner) {
      return { configured: true, authorized: false, requiresMfa: false };
    }
    if (claims.assuranceLevel !== "aal2") {
      return { configured: true, authorized: false, requiresMfa: true };
    }

    const registryResponse = await requestRegistry("/authorize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!registryResponse) {
      return {
        configured: false,
        authorized: false,
        requiresMfa: false,
        operatorName: null,
        operatorFullName: null,
      };
    }
    if (!registryResponse.ok) {
      throw new Error(
        `Operator registry authorization failed with status ${registryResponse.status}.`,
      );
    }
    const registryResult: unknown = await registryResponse.json();
    const authorized =
      typeof registryResult === "object" &&
      registryResult !== null &&
      "authorized" in registryResult &&
      registryResult.authorized === true;
    return {
      configured: true,
      authorized,
      requiresMfa: false,
      operatorName: authorized ? process.env["OSIRIS_OPERATOR_NAME"]?.trim() || null : null,
      operatorFullName: authorized
        ? process.env["OSIRIS_OPERATOR_FULL_NAME"]?.trim() || null
        : null,
    };
  });
