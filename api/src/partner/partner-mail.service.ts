import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';
import * as tls from 'tls';

export type MailSendInput = {
  to: string;
  subject: string;
  body: string;
};

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
    const from = process.env.SMTP_FROM!.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const to = input.to.trim().toLowerCase();

    const message = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${input.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      input.body,
    ].join('\r\n');

    await this.smtpSend({ host, port, secure, user, pass, from, to, message });
    this.logger.log(`SMTP sent → ${to}: ${input.subject}`);
  }

  private smtpSend(opts: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
    from: string;
    to: string;
    message: string;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      let stage = 'greet';
      const lines: string[] = [];

      const onData = (chunk: Buffer) => {
        lines.push(chunk.toString('utf8'));
        const buf = lines.join('');
        if (!buf.includes('\r\n')) return;

        if (stage === 'greet') {
          if (!buf.startsWith('220')) return reject(new Error('SMTP greet failed'));
          lines.length = 0;
          stage = 'ehlo';
          socket.write(`EHLO fleet-enterprise\r\n`);
          return;
        }

        if (stage === 'ehlo') {
          if (!buf.includes('250')) return reject(new Error('SMTP EHLO failed'));
          lines.length = 0;
          if (opts.user && opts.pass) {
            stage = 'auth';
            const cred = Buffer.from(`\0${opts.user}\0${opts.pass}`).toString('base64');
            socket.write(`AUTH PLAIN ${cred}\r\n`);
          } else {
            stage = 'mail';
            socket.write(`MAIL FROM:<${opts.from}>\r\n`);
          }
          return;
        }

        if (stage === 'auth') {
          if (!buf.includes('235')) return reject(new Error('SMTP auth failed'));
          lines.length = 0;
          stage = 'mail';
          socket.write(`MAIL FROM:<${opts.from}>\r\n`);
          return;
        }

        if (stage === 'mail') {
          if (!buf.includes('250')) return reject(new Error('SMTP MAIL FROM failed'));
          lines.length = 0;
          stage = 'rcpt';
          socket.write(`RCPT TO:<${opts.to}>\r\n`);
          return;
        }

        if (stage === 'rcpt') {
          if (!buf.includes('250')) return reject(new Error('SMTP RCPT TO failed'));
          lines.length = 0;
          stage = 'data';
          socket.write('DATA\r\n');
          return;
        }

        if (stage === 'data') {
          if (!buf.includes('354')) return reject(new Error('SMTP DATA failed'));
          lines.length = 0;
          stage = 'body';
          socket.write(`${opts.message}\r\n.\r\n`);
          return;
        }

        if (stage === 'body') {
          if (!buf.includes('250')) return reject(new Error('SMTP body rejected'));
          lines.length = 0;
          stage = 'quit';
          socket.write('QUIT\r\n');
          socket.end();
          resolve();
        }
      };

      const socket = opts.secure
        ? tls.connect({ host: opts.host, port: opts.port, servername: opts.host })
        : net.connect({ host: opts.host, port: opts.port });

      socket.setEncoding('utf8');
      socket.on('data', onData);
      socket.on('error', reject);
      socket.on('timeout', () => reject(new Error('SMTP timeout')));
      socket.setTimeout(30_000);
    });
  }
}
