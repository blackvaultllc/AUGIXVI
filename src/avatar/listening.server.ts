/**
 * LISTENING SESSIONS — server side (Part 12). Sessions are stored
 * LOCALLY in the data core only (~/.local/share/augie/
 * listening-sessions.jsonl). Nothing is uploaded anywhere. A session
 * exists only when he turned listening on — the window never records
 * in the background, and these functions never invent one.
 */
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import type { ListeningLine } from "./listening";

export interface ListeningSession {
  id: string;
  startedAt: number;
  endedAt: number;
  lines: ListeningLine[];
}

export function listeningSessionsPath(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env["AUGIE_LISTENING_PATH"] ??
    join(homedir(), ".local", "share", "augie", "listening-sessions.jsonl")
  );
}

let writeChain: Promise<void> = Promise.resolve();

export async function appendListeningSession(
  session: ListeningSession,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const path = listeningSessionsPath(env);
  writeChain = writeChain.then(async () => {
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.appendFile(path, `${JSON.stringify(session)}\n`, "utf8");
  });
  await writeChain;
}

export async function readListeningSessions(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ListeningSession[]> {
  try {
    const text = await fs.readFile(listeningSessionsPath(env), "utf8");
    const sessions: ListeningSession[] = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as ListeningSession;
        if (parsed && Array.isArray(parsed.lines)) sessions.push(parsed);
      } catch {
        // torn line skipped
      }
    }
    return sessions.reverse();
  } catch {
    return [];
  }
}

async function requireOperator(accessToken: string): Promise<boolean> {
  const verification = await verifySupabaseOperatorSession({ data: { accessToken } });
  return verification.authorized;
}

export const saveListeningSessionAuthed = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; session: ListeningSession }) => input)
  .handler(async ({ data }): Promise<{ saved: boolean }> => {
    if (!(await requireOperator(data.accessToken))) return { saved: false };
    const session: ListeningSession = {
      ...data.session,
      lines: data.session.lines.slice(0, 500).map((line) => ({
        at: line.at,
        text: String(line.text).slice(0, 2000),
        speaker: String(line.speaker).slice(0, 40),
      })),
    };
    await appendListeningSession(session);
    return { saved: true };
  });

export const listListeningSessions = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => input)
  .handler(
    async ({
      data,
    }): Promise<{ authorized: boolean; sessions: { id: string; startedAt: number; endedAt: number; lineCount: number }[] }> => {
      if (!(await requireOperator(data.accessToken))) return { authorized: false, sessions: [] };
      const sessions = await readListeningSessions();
      return {
        authorized: true,
        sessions: sessions.slice(0, 20).map((s) => ({
          id: s.id,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          lineCount: s.lines.length,
        })),
      };
    },
  );

export const getListeningSession = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; id: string }) => input)
  .handler(async ({ data }): Promise<{ authorized: boolean; session: ListeningSession | null }> => {
    if (!(await requireOperator(data.accessToken))) return { authorized: false, session: null };
    const sessions = await readListeningSessions();
    return { authorized: true, session: sessions.find((s) => s.id === data.id) ?? null };
  });
