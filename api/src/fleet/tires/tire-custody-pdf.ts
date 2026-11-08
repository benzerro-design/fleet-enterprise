import { existsSync } from 'fs';
import PDFDocument from 'pdfkit';
import type { TireCustodyProtocolKind } from '@prisma/client';

function unicodeFont(kind: 'regular' | 'bold'): string | null {
  const candidates =
    kind === 'bold'
      ? ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'C:\\Windows\\Fonts\\arialbd.ttf']
      : ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'C:\\Windows\\Fonts\\arial.ttf'];
  return candidates.find((p) => existsSync(p)) ?? null;
}

export type TireCustodyPdfInput = {
  kind: TireCustodyProtocolKind;
  tenantName: string;
  protocolId: string;
  stayId: string;
  plate: string | null;
  setName: string | null;
  season: string | null;
  supplierName: string;
  locationText: string | null;
  bayBin: string | null;
  conditionNotes: string | null;
  inventoryNotes: string | null;
  counterpartyName: string | null;
  workOrderId: string | null;
  signedAt: string | null;
  qrPayload: string | null;
  itemLines: string[];
  mediaCount: number;
  revision: number;
  signatures: Array<{
    role: string;
    displayName: string;
    signedAt: string;
    imageBuffer?: Buffer | null;
  }>;
};

const KIND_LABEL: Record<string, string> = {
  check_in: 'Proces-verbal check-in hotel anvelope',
  check_out: 'Proces-verbal check-out hotel anvelope',
  seasonal: 'Proces-verbal schimb sezonier anvelope',
  transfer: 'Proces-verbal transfer custodie anvelope',
  scrap: 'Proces-verbal casare anvelope',
  leasing_return: 'Proces-verbal returnare leasing anvelope',
  quarantine: 'Proces-verbal carantină anvelope',
};

const ROLE_LABEL: Record<string, string> = {
  partner: 'Partener hotel / service',
  customer: 'Client / reprezentant',
  driver: 'Șofer',
  witness: 'Martor',
};

export function buildTireCustodyPdf(input: TireCustodyPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const regular = unicodeFont('regular');
    const bold = unicodeFont('bold');
    if (regular) doc.registerFont('Ro', regular);
    if (bold) doc.registerFont('Ro-Bold', bold);
    const body = regular ? 'Ro' : 'Helvetica';
    const strong = bold ? 'Ro-Bold' : 'Helvetica-Bold';

    doc.font(strong).fontSize(16).text(KIND_LABEL[input.kind] ?? `PV ${input.kind}`);
    doc.moveDown(0.3);
    doc.font(body).fontSize(10).fillColor('#444').text(input.tenantName);
    doc.fillColor('#000');
    doc.moveDown();

    const lines: Array<[string, string]> = [
      ['Protocol', input.protocolId],
      ['Revizie', String(input.revision)],
      ['Sejur hotel', input.stayId],
      ['Vehicul', input.plate ?? '—'],
      ['Set', input.setName ?? '—'],
      ['Sezon', input.season ?? '—'],
      ['Hotel / furnizor', input.supplierName],
      ['Locație', input.locationText ?? '—'],
      ['Bay / bin', input.bayBin ?? '—'],
      ['Contrapartidă', input.counterpartyName ?? '—'],
      ['Work order', input.workOrderId ?? '—'],
      ['Finalizat', input.signedAt ?? '—'],
      ['Media', String(input.mediaCount)],
      ['QR set', input.qrPayload ?? '—'],
    ];
    for (const [k, v] of lines) {
      doc.font(strong).fontSize(10).text(`${k}: `, { continued: true });
      doc.font(body).text(v);
    }

    if (input.itemLines.length) {
      doc.moveDown(0.5);
      doc.font(strong).text('Anvelope în set');
      for (const line of input.itemLines) {
        doc.font(body).text(`• ${line}`);
      }
    }

    if (input.conditionNotes?.trim()) {
      doc.moveDown(0.5);
      doc.font(strong).text('Stare / uzură / observații');
      doc.font(body).text(input.conditionNotes.trim());
    }
    if (input.inventoryNotes?.trim()) {
      doc.moveDown(0.5);
      doc.font(strong).text('Inventar / jante / accesorii');
      doc.font(body).text(input.inventoryNotes.trim());
    }

    doc.moveDown();
    doc.font(strong).fontSize(12).text('Semnături');
    doc.moveDown(0.3);
    for (const s of input.signatures) {
      doc
        .font(body)
        .fontSize(10)
        .text(`${ROLE_LABEL[s.role] ?? s.role}: ${s.displayName} — ${s.signedAt}`);
      if (s.imageBuffer && s.imageBuffer.length > 0) {
        try {
          const y = doc.y;
          doc.image(s.imageBuffer, doc.page.margins.left, y, { width: 160, height: 56 });
          doc.y = y + 64;
        } catch {
          doc.font(body).fontSize(8).fillColor('#666').text('(imagine semnătură indisponibilă)');
          doc.fillColor('#000');
        }
      }
      doc.moveDown(0.4);
    }

    doc.moveDown(0.8);
    doc
      .font(body)
      .fontSize(8)
      .fillColor('#666')
      .text(
        'Document generat electronic. Semnăturile pe ecran (telefon/tabletă) sunt atașate în sistem ca PNG + traseu vectorial de audit. Bonul operațional rămâne draft până la acceptarea bilaterală.',
      );

    doc.end();
  });
}
