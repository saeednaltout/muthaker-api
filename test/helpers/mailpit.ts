import { MAILPIT_API } from '../test-env';

interface MailpitMessage {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

export async function clearMailpit(): Promise<void> {
  await fetch(`${MAILPIT_API}/messages`, { method: 'DELETE' });
}

/** Polls Mailpit until a message for `to` arrives (or times out). */
export async function waitForMail(to: string, timeoutMs = 10_000): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    const body = (await res.json()) as { messages: MailpitMessage[] };
    const found = body.messages[0];
    if (found) return found;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No mail for ${to} within ${timeoutMs}ms`);
}

export async function getMailHtml(id: string): Promise<string> {
  const res = await fetch(`${MAILPIT_API}/message/${id}`);
  const body = (await res.json()) as { HTML: string };
  return body.HTML;
}
