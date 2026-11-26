/**
 * SECTION REQUESTS STORE — node-only, server-side.
 *
 * The durable half of the "Ask for something to be added"
 * button (Captain's order 2026-11-26): one JSON file on the
 * core (~/.local/share/augie/section-requests.json), owner-only
 * (0600), holding every request Violet and Khadija have filed
 * from their own areas.
 *
 * Filing is one act with two records, both from the request
 * itself: the request lands in this store, and a REQUEST entry
 * lands in the Captain's notifications (the Anubis inbox) —
 * written here, at the moment of filing, carrying the request's
 * id as its source. The inbox law holds: the request record is
 * the event, and there is no entry without it.
 *
 * Where there is no node filesystem (the Cloudflare Worker)
 * the store is unavailable and says so — the requests live on
 * the core machine, like the inbox itself.
 */
import { randomUUID } from "node:crypto";
import {
  newSectionRequestId,
  requestNotification,
  sanitizeSectionRequestsFile,
  SECTION_REQUEST_TEXT_MAX,
  type SectionRequest,
  type SectionRequestSource,
  type SectionRequestsFile,
} from "./sectionRequests";
import { getNotificationsStore } from "./notificationsStore.server";
import { INBOX_MAX } from "./cameras/anubisInbox";

type RequestsFs = typeof import("node:fs/promises");

const STORE_FILE = "section-requests.json";

export class FileSectionRequestsStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: RequestsFs,
    private readonly directory: string,
  ) {}

  private get filePath(): string {
    return `${this.directory}/${STORE_FILE}`;
  }

  async read(): Promise<SectionRequestsFile> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.filePath, "utf8"));
      return sanitizeSectionRequestsFile(parsed);
    } catch {
      return sanitizeSectionRequestsFile(null);
    }
  }

  private async writeAll(file: SectionRequestsFile): Promise<void> {
    await this.fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(this.filePath, JSON.stringify(file, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  private update(
    mutator: (file: SectionRequestsFile) => SectionRequestsFile,
  ): Promise<SectionRequestsFile> {
    const job = async () => {
      const current = await this.read();
      const next = sanitizeSectionRequestsFile(mutator(current));
      await this.writeAll(next);
      return next;
    };
    const result = this.tail.then(job, job);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Append one request; returns the stored record. */
  async append(request: SectionRequest): Promise<SectionRequest> {
    await this.update((file) => ({ requests: [request, ...file.requests] }));
    return request;
  }
}

let storePromise: Promise<FileSectionRequestsStore | null> | null = null;

export function getSectionRequestsStore(): Promise<FileSectionRequestsStore | null> {
  storePromise ??= (async () => {
    const home = process.env["HOME"]?.trim();
    if (!home) return null;
    try {
      const fs = await import("node:fs/promises");
      return new FileSectionRequestsStore(fs, `${home}/.local/share/augie`);
    } catch {
      return null;
    }
  })();
  return storePromise;
}

/**
 * File one request from one of the two areas. Returns the stored
 * request, or null where the core store does not exist on this
 * surface. The inbox mirror is best-effort in one direction only:
 * the request record is written FIRST, and the mirror is written
 * from it — if the inbox store were missing, the request still
 * stands on its own record.
 */
export async function fileSectionRequest(input: {
  from: SectionRequestSource;
  fromName: string;
  text: string;
}): Promise<SectionRequest | null> {
  const text = input.text.trim().slice(0, SECTION_REQUEST_TEXT_MAX);
  if (!text) return null;
  const store = await getSectionRequestsStore();
  if (!store) return null;
  const at = Date.now();
  const request: SectionRequest = {
    id: newSectionRequestId(at, randomUUID()),
    at,
    from: input.from,
    fromName: input.fromName,
    text,
  };
  await store.append(request);
  const inbox = await getNotificationsStore();
  if (inbox) {
    const entry = requestNotification(request);
    await inbox.update((file) => {
      if (file.entries.some((e) => e.id === entry.id)) return file;
      return {
        entries: [entry, ...file.entries].sort((a, b) => b.at - a.at).slice(0, INBOX_MAX),
      };
    });
  }
  return request;
}
