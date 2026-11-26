/**
 * VIOLET'S MAIL TRANSPORT — node-only, server-side. A small
 * implicit-TLS SMTP client, just large enough to carry her
 * mail from her own mailbox: connect, EHLO, AUTH LOGIN, MAIL
 * FROM, RCPT TO, DATA, QUIT.
 *
 * Honesty is the whole design: it reports "sent" ONLY when
 * the mail server accepts the message (250 after DATA). Any
 * other outcome — no connection, a refusal, a timeout — comes
 * back as a plain failure, and her message stays a draft.
 * Nothing is ever reported sent that was not accepted.
 */
import { connect as tlsConnect, type TLSSocket } from "node:tls";
import type { VioletMailboxTransport } from "./violetStore.server";
import type { VioletMail } from "./violetSide";

const TIMEOUT_MS = 20_000;

interface SmtpReply {
  code: number;
  text: string;
}

function readReply(socket: TLSSocket): Promise<SmtpReply> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("The mail server took too long to answer."));
    }, TIMEOUT_MS);
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r\n/);
      for (const line of lines) {
        const match = /^(\d{3}) /.exec(line);
        if (match) {
          cleanup();
          resolve({ code: Number(match[1]), text: line });
          return;
        }
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function command(
  socket: TLSSocket,
  line: string,
  expect: number[],
): Promise<SmtpReply> {
  socket.write(`${line}\r\n`);
  const reply = await readReply(socket);
  if (!expect.includes(reply.code)) {
    throw new Error(`The mail server answered: ${reply.text}`);
  }
  return reply;
}

function encodeHeader(value: string): string {
  // Headers stay single-line plain text — anything else is refused upstream.
  return value.replace(/[\r\n]+/g, " ").trim();
}

export async function sendViaSmtp(
  transport: VioletMailboxTransport,
  fromAddress: string,
  mail: Pick<VioletMail, "to" | "subject" | "body">,
): Promise<{ ok: boolean; error?: string }> {
  let socket: TLSSocket | null = null;
  try {
    socket = await new Promise<TLSSocket>((resolve, reject) => {
      const s = tlsConnect(
        { host: transport.host, port: transport.port, servername: transport.host },
        () => resolve(s),
      );
      s.once("error", reject);
      setTimeout(() => reject(new Error("The mail server could not be reached.")), TIMEOUT_MS);
    });
    const greeting = await readReply(socket);
    if (greeting.code !== 220) throw new Error(`The mail server answered: ${greeting.text}`);
    await command(socket, `EHLO iem.local`, [250]);
    await command(socket, "AUTH LOGIN", [334]);
    await command(socket, Buffer.from(transport.user, "utf8").toString("base64"), [334]);
    await command(socket, Buffer.from(transport.pass, "utf8").toString("base64"), [235]);
    await command(socket, `MAIL FROM:<${fromAddress}>`, [250]);
    await command(socket, `RCPT TO:<${mail.to}>`, [250, 251]);
    await command(socket, "DATA", [354]);
    const body = mail.body.replace(/\r\n/g, "\n").replace(/\n\./g, "\n..");
    const message = [
      `From: ${fromAddress}`,
      `To: ${mail.to}`,
      `Subject: ${encodeHeader(mail.subject)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="utf-8"',
      "",
      body,
      ".",
    ].join("\r\n");
    await command(socket, message, [250]);
    await command(socket, "QUIT", [221]).catch(() => undefined);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The mail could not be sent.",
    };
  } finally {
    socket?.destroy();
  }
}
