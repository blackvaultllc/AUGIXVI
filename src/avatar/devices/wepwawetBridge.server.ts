/**
 * WEPWAWET BRIDGE — the server half (Parrot-local). Runs ONE bridge
 * frame through the staged sender script and returns the sender's
 * own printed words as the receipt.
 *
 * Doors, all closed by default:
 *   · WEPWAWET_BRIDGE=off in the server environment closes it.
 *   · The sender must exist at its staged home (env
 *     WEPWAWET_SENDER_PATH, else ~/augie-tools/wepwawet/
 *     wepwawet-send.py) — on any other machine (the hosted Worker
 *     build included) the bridge reports UNAVAILABLE in words.
 *   · One burst at a time: a second frame while one is on air is
 *     refused (409) rather than overlapping advertisements.
 *   · The sender itself refuses to transmit without --live, and
 *     re-verifies its encoder on every start — a mismatch there
 *     fails the run and its words come back as the error.
 */
import { senderArgsForFrame, type WepwawetBridgeRequest } from "./wepwawetBridge";

export type WepwawetBridgeRun =
  | { ok: true; mode: "live" | "dry"; output: string }
  | { ok: false; status: number; error: string };

let bridgeBusy = false;

export async function runWepwawetFrame(
  req: WepwawetBridgeRequest,
): Promise<WepwawetBridgeRun> {
  if (process.env["WEPWAWET_BRIDGE"] === "off") {
    return {
      ok: false,
      status: 501,
      error: "The Wepwawet bridge is switched off on this server (WEPWAWET_BRIDGE=off). Nothing was sent.",
    };
  }
  if (bridgeBusy) {
    return {
      ok: false,
      status: 409,
      error: "A broadcast is already on air from the bridge — wait for it to finish, then send again. Nothing more was sent.",
    };
  }
  let execFile: typeof import("node:child_process").execFile;
  let existsSync: typeof import("node:fs").existsSync;
  let homedir: typeof import("node:os").homedir;
  let join: typeof import("node:path").join;
  try {
    ({ execFile } = await import("node:child_process"));
    ({ existsSync } = await import("node:fs"));
    ({ homedir } = await import("node:os"));
    ({ join } = await import("node:path"));
  } catch {
    return {
      ok: false,
      status: 501,
      error: "The dog bridge lives on the Parrot's own server — this server cannot run the sender. Nothing was sent.",
    };
  }
  const senderPath =
    process.env["WEPWAWET_SENDER_PATH"] ??
    join(homedir(), "augie-tools", "wepwawet", "wepwawet-send.py");
  if (!existsSync(senderPath)) {
    return {
      ok: false,
      status: 501,
      error: `The Wepwawet sender is not staged on this machine (${senderPath} is missing) — the dog bridge lives on the Parrot. Nothing was sent.`,
    };
  }
  bridgeBusy = true;
  try {
    const output = await new Promise<string>((resolve, reject) => {
      execFile(
        "python3",
        senderArgsForFrame(senderPath, req),
        { timeout: req.holdMs + 30_000, maxBuffer: 256 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            const words = `${stdout ?? ""}\n${stderr ?? ""}`.trim();
            reject(
              new Error(
                words
                  ? `The sender refused: ${words.slice(-600)}`
                  : `The sender failed to run (${error.message}).`,
              ),
            );
            return;
          }
          resolve(String(stdout).trim());
        },
      );
    });
    return { ok: true, mode: req.live ? "live" : "dry", output };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: `${error instanceof Error ? error.message : "The sender failed."} Nothing further was sent.`,
    };
  } finally {
    bridgeBusy = false;
  }
}
