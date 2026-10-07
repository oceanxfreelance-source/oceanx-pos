/**
 * Viber delivery providers. Sending to a phone number on Viber requires Viber Business Messages
 * through an approved partner, so the transport is pluggable and configured by the platform operator
 * (environment variables — never in source):
 *
 *   VIBER_PROVIDER=log      → development/demo: messages are recorded and written to the server log only
 *   VIBER_PROVIDER=infobip  → Infobip Viber Business Messages  (VIBER_API_URL, VIBER_API_KEY, VIBER_SENDER)
 *   VIBER_PROVIDER=webhook  → POST {to, text} to your own gateway (VIBER_API_URL, VIBER_API_KEY)
 *   VIBER_PROVIDER=none     → feature disabled platform-wide
 */
export interface ViberProvider {
  readonly name: string;
  send(to: string, text: string): Promise<{ id?: string }>;
}

export interface ViberConfig {
  VIBER_PROVIDER: 'none' | 'log' | 'memory' | 'infobip' | 'webhook';
  VIBER_API_URL?: string;
  VIBER_API_KEY?: string;
  VIBER_SENDER?: string;
}

const TIMEOUT_MS = 8000;

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Keeps sent messages in memory (tests) and logs them (demo). Nothing leaves the server. */
export class RecordingProvider implements ViberProvider {
  readonly sent: { to: string; text: string }[] = [];
  constructor(
    readonly name: string,
    private readonly log?: { info: (o: object, msg: string) => void },
  ) {}
  async send(to: string, text: string) {
    this.sent.push({ to, text });
    this.log?.info({ to, text }, 'viber message (not delivered: VIBER_PROVIDER=log)');
    return { id: `local-${this.sent.length}` };
  }
}

export class InfobipProvider implements ViberProvider {
  readonly name = 'infobip';
  constructor(private readonly cfg: Required<Pick<ViberConfig, 'VIBER_API_URL' | 'VIBER_API_KEY' | 'VIBER_SENDER'>>) {}
  async send(to: string, text: string) {
    const out = await post(`${this.cfg.VIBER_API_URL.replace(/\/$/, '')}/viber/2/messages`, { authorization: `App ${this.cfg.VIBER_API_KEY}` }, {
      messages: [{ sender: this.cfg.VIBER_SENDER, destinations: [{ to }], content: { type: 'TEXT', text } }],
    });
    const msg = (out.messages as { messageId?: string }[] | undefined)?.[0];
    return { id: msg?.messageId };
  }
}

export class WebhookProvider implements ViberProvider {
  readonly name = 'webhook';
  constructor(private readonly cfg: { VIBER_API_URL: string; VIBER_API_KEY?: string }) {}
  async send(to: string, text: string) {
    const out = await post(this.cfg.VIBER_API_URL, this.cfg.VIBER_API_KEY ? { authorization: `Bearer ${this.cfg.VIBER_API_KEY}` } : {}, { channel: 'viber', to, text });
    return { id: typeof out.id === 'string' ? out.id : undefined };
  }
}

export function createViberProvider(cfg: ViberConfig, log?: { info: (o: object, msg: string) => void }): ViberProvider | null {
  switch (cfg.VIBER_PROVIDER) {
    case 'none':
      return null;
    case 'infobip':
      if (!cfg.VIBER_API_URL || !cfg.VIBER_API_KEY || !cfg.VIBER_SENDER) throw new Error('VIBER_PROVIDER=infobip needs VIBER_API_URL, VIBER_API_KEY and VIBER_SENDER');
      return new InfobipProvider({ VIBER_API_URL: cfg.VIBER_API_URL, VIBER_API_KEY: cfg.VIBER_API_KEY, VIBER_SENDER: cfg.VIBER_SENDER });
    case 'webhook':
      if (!cfg.VIBER_API_URL) throw new Error('VIBER_PROVIDER=webhook needs VIBER_API_URL');
      return new WebhookProvider({ VIBER_API_URL: cfg.VIBER_API_URL, VIBER_API_KEY: cfg.VIBER_API_KEY });
    default:
      return new RecordingProvider(cfg.VIBER_PROVIDER, log);
  }
}
