import { createServerFn } from "@tanstack/react-start";

type OperatorTokenInput = { token: string };
type OperatorSessionInput = { accessToken: string };

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

export const verifySupabaseOperatorSession = createServerFn({ method: "POST" })
  .validator((input: unknown): OperatorSessionInput => {
    if (
      typeof input !== "object" ||
      input === null ||
      !("accessToken" in input) ||
      typeof input.accessToken !== "string" ||
      input.accessToken.length === 0 ||
      input.accessToken.length > 16_384
    ) {
      throw new Error("Invalid operator session request.");
    }
    return { accessToken: input.accessToken };
  })
  .handler(async ({ data }) => {
    const url = import.meta.env["VITE_SUPABASE_URL"]?.trim().replace(/\/+$/, "");
    const publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim();
    const operatorUserId = process.env["OSIRIS_OPERATOR_USER_ID"]?.trim();
    if (!url || !publishableKey || !operatorUserId) {
      return {
        configured: false,
        authorized: false,
        operatorName: null,
        operatorFullName: null,
      };
    }

    const response = await fetch(new URL("/auth/v1/user", url), {
      method: "GET",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${data.accessToken}`,
      },
    });
    if (response.status === 401 || response.status === 403) {
      return { configured: true, authorized: false };
    }
    if (!response.ok) {
      throw new Error(`Supabase Auth session verification failed with status ${response.status}.`);
    }

    const user: unknown = await response.json();
    const userId =
      typeof user === "object" && user !== null && "id" in user && typeof user.id === "string"
        ? user.id
        : "";
    const authorized = userId === operatorUserId;
    return {
      configured: true,
      authorized,
      operatorName: authorized ? process.env["OSIRIS_OPERATOR_NAME"]?.trim() || null : null,
      operatorFullName: authorized
        ? process.env["OSIRIS_OPERATOR_FULL_NAME"]?.trim() || null
        : null,
    };
  });
