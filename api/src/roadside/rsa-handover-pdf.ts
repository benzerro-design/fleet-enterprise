import { existsSync } from 'fs';
import PDFDocument from 'pdfkit';
import type { RsaHandoverKind } from '@prisma/client';

function unicodeFont(kind: 'regular' | 'bold'): string | null {
  const candidates =
    kind === 'bold'
      ? ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'C:\\Windows\\Fonts\\arialbd.ttf']
      : ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'C:\\Windows\\Fonts\\arial.ttf'];
  return candidates.find((p) => existsSync(p)) ?? null;
}

export type HandoverPdfInput = {
  kind: RsaHandoverKind;
  tenantName: string;
  missionId: string;
  interventionDisplay: string | null;
  vehicleReg: string | null;
  supplierName: string;
  driverName: string | null;
  locationText: string | null;
  odometerKm: number | null;
  fuelLevelPct: number | null;
  damageNotes: string | null;
  inventoryNotes: string | null;
  counterpartyName: string | null;
  signedAt: string | null;
  signatures: Array<{ role: string; displayName: string; signedAt: string }>;
  mediaCount: number;
};

const KIND_LABEL: Record<RsaHandoverKind, string> = {
  pickup: 'Proces-verbal de preluare',
  dropoff: 'Proces-verbal de predare',
};

const ROLE_LABEL: Record<string, string> = {
  driver: 'Șofer asistență',
  customer: 'Client / reprezentant',
  receiver: 'Recepție destinatar',
  witness: 'Martor',
};

export function buildHandoverPdf(input: HandoverPdfInput): Promise<Buffer> {
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

    doc.font(strong).fontSize(16).text(KIND_LABEL[input.kind]);
    doc.moveDown(0.3);
    doc.font(body).fontSize(10).fillColor('#444').text(input.tenantName);
    doc.fillColor('#000');
    doc.moveDown();

    const lines: Array<[string, string]> = [
      ['Intervenție', input.interventionDisplay ?? '—'],
      ['Misiune', input.missionId],
      ['Vehicul', input.vehicleReg ?? '—'],
      ['Furnizor RSA', input.supplierName],
      ['Șofer', input.driverName ?? '—'],
      ['Locație', input.locationText ?? '—'],
      [
        'Odometru',
        input.odometerKm != null ? `${input.odometerKm} km` : '—',
      ],
      [
        'Combustibil',
        input.fuelLevelPct != null ? `${input.fuelLevelPct}%` : '—',
      ],
      ['Contrapartidă', input.counterpartyName ?? '—'],
      ['Finalizat', input.signedAt ?? '—'],
      ['Fișiere media', String(input.mediaCount)],
    ];
    for (const [k, v] of lines) {
      doc.font(strong).fontSize(10).text(`${k}: `, { continued: true });
      doc.font(body).text(v);
    }

    if (input.damageNotes?.trim()) {
      doc.moveDown(0.5);
      doc.font(strong).text('Daune / observații');
      doc.font(body).text(input.damageNotes.trim());
    }
    if (input.inventoryNotes?.trim()) {
      doc.moveDown(0.5);
      doc.font(strong).text('Inventar / echipamente');
      doc.font(body).text(input.inventoryNotes.trim());
    }

    doc.moveDown();
    doc.font(strong).fontSize(12).text('Semnături');
    doc.moveDown(0.3);
    for (const s of input.signatures) {
      doc
        .font(body)
        .fontSize(10)
        .text(
          `• ${ROLE_LABEL[s.role] ?? s.role}: ${s.displayName} — ${s.signedAt}`,
        );
    }

    doc.moveDown(1.5);
    doc
      .font(body)
      .fontSize(8)
      .fillColor('#666')
      .text(
        'Document generat electronic. Semnăturile pe ecran (telefon/tabletă) sunt atașate în sistem ca PNG + traseu vectorial de audit.',
      );

    doc.end();
  });
}
