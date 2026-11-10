import { createServerFn } from "@tanstack/react-start";

type OperatorTokenInput = { token: string };

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
