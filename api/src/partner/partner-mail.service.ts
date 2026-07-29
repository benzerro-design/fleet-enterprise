import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';
import * as path from 'path';
import * as tls from 'tls';

export type MailAttachment = {
  filename: string;
  contentType: string;
  /** Raw file bytes */
  content: Buffer;
};

export type MailSendInput = {
  to: string;
  subject: string;
  body: string;
  attachments?: MailAttachment[];
  /** Display name for From header (envelope remains SMTP_FROM address). */
  fromName?: string | null;
  replyTo?: string | null;
  cc?: string[];
};

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MiB / fișier
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MiB total (sub limita Gmail ~25MB)

function extractEmail(addr: string): string {
  const m = /<([^>]+)>/.exec(addr);
  return (m?.[1] ?? addr).trim().toLowerCase();
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function encodeDisplayName(name: string): string {
  const clean = name.replace(/[\r\n"]/g, '').trim();
  if (!clean) return '';
  if (/^[\x20-\x7E]*$/.test(clean)) return `"${clean}"`;
  return `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`;
}

function formatFromHeader(envelopeEmail: string, displayName?: string | null): string {
  const email = extractEmail(envelopeEmail);
  const encoded = displayName ? encodeDisplayName(displayName) : '';
  return encoded ? `${encoded} <${email}>` : email;
}

function uniqueEmails(list: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const e = extractEmail(raw);
    if (!e || !isEmail(e) || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

@Injectable()
export class PartnerMailService {
  private readonly logger = new Logger(PartnerMailService.name);

  isConfigured(): boolean {
    return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
  }

  async send(input: MailSendInput): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('SMTP not configured (SMTP_HOST, SMTP_FROM)');
    }

    const host = process.env.SMTP_HOST!.trim();
    const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const smtpFrom = process.env.SMTP_FROM!.trim();
    const envelopeFrom = extractEmail(smtpFrom);
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const to = extractEmail(input.to);
    if (!to || !isEmail(to)) throw new Error('Invalid recipient');

    const cc = uniqueEmails(input.cc ?? []).filter((e) => e !== to);
    const attachments = this.normalizeAttachments(input.attachments ?? []);
    const message = this.buildMimeMessage({
      from: formatFromHeader(smtpFrom, input.fromName),
      to,
      cc,
      replyTo: input.replyTo ? extractEmail(input.replyTo) : null,
      subject: input.subject,
      body: input.body,
      attachments,
    });

    await this.smtpSend({
      host,
      port,
      secure,
      user,
      pass,
      envelopeFrom,
      recipients: [to, ...cc],
      message,
    });
    this.logger.log(
      `SMTP sent → ${to}` +
        (cc.length ? ` (cc: ${cc.join(', ')})` : '') +
        `: ${input.subject}` +
        (attachments.length ? ` (${attachments.length} atașament(e))` : ''),
    );
  }

  /**
   * Descarcă fișiere de la URL-uri absolute (ex. WEB_ORIGIN/uploads/...) pentru atașare SMTP.
   * Eșecurile pe un fișier sunt ignorate (rămân linkurile în body).
   */
  async fetchAttachmentsFromUrls(
    urls: string[],
    opts?: { maxFiles?: number },
  ): Promise<MailAttachment[]> {
    const maxFiles = opts?.maxFiles ?? 15;
    const out: MailAttachment[] = [];
    let total = 0;
    const seen = new Set<string>();

    for (const raw of urls) {
      if (out.length >= maxFiles) break;
      const url = raw.trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      if (!/^https?:\/\//i.test(url)) continue;

      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 25_000);
        const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
        clearTimeout(timer);
        if (!res.ok) {
          this.logger.warn(`Attachment fetch HTTP ${res.status}: ${url}`);
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0 || buf.length > MAX_ATTACHMENT_BYTES) {
          this.logger.warn(`Attachment skip size=${buf.length}: ${url}`);
          continue;
        }
        if (total + buf.length > MAX_TOTAL_ATTACHMENT_BYTES) {
          this.logger.warn(`Attachment total size cap reached — stop at ${out.length} files`);
          break;
        }
        total += buf.length;
        const contentType =
          res.headers.get('content-type')?.split(';')[0]?.trim() ||
          this.guessContentType(url);
        const filename = this.filenameFromUrl(url, res.headers.get('content-disposition'));
        out.push({ filename, contentType, content: buf });
      } catch (e) {
        this.logger.warn(
          `Attachment fetch failed: ${url} — ${e instanceof Error ? e.message : 'error'}`,
        );
      }
    }
    return out;
  }

  private normalizeAttachments(list: MailAttachment[]): MailAttachment[] {
    const out: MailAttachment[] = [];
    let total = 0;
    for (const a of list) {
      if (!a?.content?.length || !a.filename?.trim()) continue;
      if (a.content.length > MAX_ATTACHMENT_BYTES) continue;
      if (total + a.content.length > MAX_TOTAL_ATTACHMENT_BYTES) break;
      total += a.content.length;
      out.push({
        filename: a.filename.trim().replace(/[\r\n"]/g, '_'),
        contentType: a.contentType?.trim() || 'application/octet-stream',
        content: a.content,
      });
    }
    return out;
  }

  private buildMimeMessage(opts: {
    from: string;
    to: string;
    cc: string[];
    replyTo: string | null;
    subject: string;
    body: string;
    attachments: MailAttachment[];
  }): string {
    const headers = [
      `From: ${opts.from}`,
      `To: ${opts.to}`,
      ...(opts.cc.length ? [`Cc: ${opts.cc.join(', ')}`] : []),
      ...(opts.replyTo && isEmail(opts.replyTo) ? [`Reply-To: ${opts.replyTo}`] : []),
      `Subject: ${this.encodeSubject(opts.subject)}`,
      'MIME-Version: 1.0',
    ];

    if (!opts.attachments.length) {
      return [
        ...headers,
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        opts.body,
      ].join('\r\n');
    }

    const boundary = `fleet_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const parts: string[] = [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      opts.body,
    ];

    for (const a of opts.attachments) {
      const b64 = a.content.toString('base64');
      const wrapped = b64.replace(/.{1,76}/g, (line) => `${line}\r\n`).trimEnd();
      parts.push(
        `--${boundary}`,
        `Content-Type: ${a.contentType}; name="${a.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${a.filename}"`,
        '',
        wrapped,
      );
    }
    parts.push(`--${boundary}--`, '');
    return parts.join('\r\n');
  }

  /** RFC 2047 — subiecte cu diacritice (ro). */
  private encodeSubject(subject: string): string {
    if (/^[\x20-\x7E]*$/.test(subject)) return subject;
    return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
  }

  private filenameFromUrl(url: string, contentDisposition: string | null): string {
    if (contentDisposition) {
      const m =
        /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;\s]+)/i.exec(
          contentDisposition,
        );
      const raw = decodeURIComponent(m?.[1] || m?.[2] || m?.[3] || '').trim();
      if (raw) return raw.replace(/[\\/]/g, '_');
    }
    try {
      const base = path.basename(new URL(url).pathname);
      if (base && base !== '/' && base !== '.') return base;
    } catch {
      /* ignore */
    }
    return `attachment_${Date.now()}`;
  }

  private guessContentType(url: string): string {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    const map: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return map[ext] ?? 'application/octet-stream';
  }

  private smtpSend(opts: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
    envelopeFrom: string;
    recipients: string[];
    message: string;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      let stage = 'greet';
      let buf = '';
      let rcptIndex = 0;
      let socket: net.Socket | tls.TLSSocket = opts.secure
        ? tls.connect({ host: opts.host, port: opts.port, servername: opts.host })
        : net.connect({ host: opts.host, port: opts.port });

      const fail = (err: Error) => {
        try {
          socket.destroy();
        } catch {
          /* ignore */
        }
        reject(err);
      };

      const write = (cmd: string) => {
        socket.write(cmd);
      };

      const attachData = (s: net.Socket | tls.TLSSocket) => {
        s.setEncoding('utf8');
        s.on('data', onData);
        s.on('error', fail);
        s.on('timeout', () => fail(new Error('SMTP timeout')));
        s.setTimeout(60_000);
      };

      const onData = (chunk: string) => {
        buf += chunk;
        if (!buf.includes('\n')) return;

        const snapshot = buf;
        const lines = snapshot.split(/\r?\n/).filter((l) => l.length > 0);
        const last = lines[lines.length - 1] ?? '';
        if (!/^\d{3} /.test(last)) return;

        buf = '';

        if (stage === 'greet') {
          if (!snapshot.startsWith('220')) return fail(new Error('SMTP greet failed'));
          stage = 'ehlo';
          write('EHLO fleet-enterprise\r\n');
          return;
        }

        if (stage === 'ehlo') {
          if (!snapshot.includes('250')) return fail(new Error('SMTP EHLO failed'));
          if (!opts.secure && snapshot.toUpperCase().includes('STARTTLS')) {
            stage = 'starttls';
            write('STARTTLS\r\n');
            return;
          }
          if (opts.user && opts.pass) {
            stage = 'auth';
            const cred = Buffer.from(`\0${opts.user}\0${opts.pass}`).toString('base64');
            write(`AUTH PLAIN ${cred}\r\n`);
          } else {
            stage = 'mail';
            write(`MAIL FROM:<${opts.envelopeFrom}>\r\n`);
          }
          return;
        }

        if (stage === 'starttls') {
          if (!snapshot.startsWith('220')) return fail(new Error('SMTP STARTTLS failed'));
          const plain = socket as net.Socket;
          plain.removeAllListeners('data');
          plain.removeAllListeners('error');
          plain.removeAllListeners('timeout');
          socket = tls.connect({
            socket: plain,
            host: opts.host,
            servername: opts.host,
          });
          attachData(socket);
          stage = 'ehlo';
          socket.once('secureConnect', () => {
            write('EHLO fleet-enterprise\r\n');
          });
          return;
        }

        if (stage === 'auth') {
          if (!snapshot.includes('235')) return fail(new Error('SMTP auth failed'));
          stage = 'mail';
          write(`MAIL FROM:<${opts.envelopeFrom}>\r\n`);
          return;
        }

        if (stage === 'mail') {
          if (!snapshot.includes('250')) return fail(new Error('SMTP MAIL FROM failed'));
          stage = 'rcpt';
          rcptIndex = 0;
          write(`RCPT TO:<${opts.recipients[0]}>\r\n`);
          return;
        }

        if (stage === 'rcpt') {
          if (!snapshot.includes('250')) {
            return fail(new Error(`SMTP RCPT TO failed for ${opts.recipients[rcptIndex]}`));
          }
          rcptIndex += 1;
          if (rcptIndex < opts.recipients.length) {
            write(`RCPT TO:<${opts.recipients[rcptIndex]}>\r\n`);
            return;
          }
          stage = 'data';
          write('DATA\r\n');
          return;
        }

        if (stage === 'data') {
          if (!snapshot.includes('354')) return fail(new Error('SMTP DATA failed'));
          stage = 'body';
          write(`${opts.message}\r\n.\r\n`);
          return;
        }

        if (stage === 'body') {
          if (!snapshot.includes('250')) return fail(new Error('SMTP body rejected'));
          stage = 'quit';
          write('QUIT\r\n');
          socket.end();
          resolve();
        }
      };

      attachData(socket);
    });
  }
}
