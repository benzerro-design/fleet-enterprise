import PDFDocument from 'pdfkit';
import type { TripSheetDocType } from '@prisma/client';
import { tripSheetDocTypeLabel } from './trip-sheet-labels';

type PdfDoc = InstanceType<typeof PDFDocument>;

export type TripSheetLine = {
  date: string;
  registrationNumber: string;
  clientId: string;
  reference: string | null;
  route: string;
  distanceKm: number | null;
  purpose: string;
  roadType: string;
  driverName: string | null;
  odometerStartKm: number | null;
  odometerEndKm: number | null;
};

export type FazDailyLine = {
  date: string;
  registrationNumber: string;
  clientId: string;
  tripCount: number;
  distanceKm: number;
  fuelLiters: number;
  odometerStartKm: number | null;
  odometerEndKm: number | null;
};

export type TripSheetPdfInput = {
  docType: TripSheetDocType;
  tenantName: string;
  periodStart: string;
  periodEnd: string;
  driverName: string | null;
  vehicles: Array<{ registrationNumber: string; clientId: string; brand: string | null; model: string | null }>;
  tripLines: TripSheetLine[];
  fazDailyLines: FazDailyLine[];
  totals: {
    tripCount: number;
    distanceKm: number;
    fuelLiters: number;
    fuelCostCents: number;
    odometerStartKm: number | null;
    odometerEndKm: number | null;
  };
};

function formatDateRo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ro-RO');
}

function formatMoneyCents(cents: number): string {
  return `${(cents / 100).toFixed(2)} RON`;
}

function vehicleLabel(v: TripSheetPdfInput['vehicles'][0]): string {
  const parts = [v.registrationNumber];
  const bm = [v.brand, v.model].filter(Boolean).join(' ');
  if (bm) parts.push(`(${bm})`);
  parts.push(`· ${v.clientId}`);
  return parts.join(' ');
}

export function buildTripSheetPdf(input: TripSheetPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const headerTitle =
      input.docType === 'faz_monthly'
        ? 'FISA ACTIVITATI ZILNICE (FAZ)'
        : 'FOAIE DE PARCURS';

    doc.fontSize(16).text(headerTitle, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#444444');
    doc.text(tripSheetDocTypeLabel(input.docType), { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1);

    doc.fontSize(11);
    doc.text(`Organizatie: ${input.tenantName}`);
    doc.text(`Perioada: ${formatDateRo(input.periodStart)} – ${formatDateRo(input.periodEnd)}`);
    if (input.driverName) {
      doc.text(`Conducator: ${input.driverName}`);
    }
    doc.moveDown(0.5);
    doc.text('Vehicule incluse:');
    for (const v of input.vehicles) {
      doc.text(`  • ${vehicleLabel(v)}`, { indent: 8 });
    }
    doc.moveDown(1);

    if (input.docType === 'faz_monthly') {
      drawFazTable(doc, input.fazDailyLines);
    } else {
      drawTripTable(doc, input.tripLines);
    }

    doc.moveDown(1);
    doc.fontSize(11).text('Totaluri perioada', { underline: true });
    doc.fontSize(10);
    doc.text(`Curse: ${input.totals.tripCount}`);
    doc.text(`Km parcursi (din curse): ${input.totals.distanceKm}`);
    doc.text(`Combustibil: ${input.totals.fuelLiters.toFixed(2)} L (${formatMoneyCents(input.totals.fuelCostCents)})`);
    if (input.totals.odometerStartKm != null || input.totals.odometerEndKm != null) {
      doc.text(
        `Odometru (citiri in perioada): ${input.totals.odometerStartKm ?? '—'} → ${input.totals.odometerEndKm ?? '—'}`,
      );
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#666666');
    doc.text(`Generat ${new Date().toLocaleString('ro-RO')} · Fleet Enterprise`, { align: 'center' });

    doc.end();
  });
}

function drawTripTable(doc: PdfDoc, lines: TripSheetLine[]) {
  doc.fontSize(10).text('Detaliu curse', { underline: true });
  doc.moveDown(0.5);
  if (lines.length === 0) {
    doc.text('Nu exista curse in perioada selectata.');
    return;
  }
  const col = { date: 48, reg: 72, route: 140, km: 36, purpose: 52 };
  let y = doc.y;
  const startX = doc.page.margins.left;
  doc.fontSize(8).fillColor('#333333');
  doc.text('Data', startX, y, { width: col.date });
  doc.text('Auto', startX + col.date, y, { width: col.reg });
  doc.text('Traseu', startX + col.date + col.reg, y, { width: col.route });
  doc.text('Km', startX + col.date + col.reg + col.route, y, { width: col.km });
  doc.text('Scop', startX + col.date + col.reg + col.route + col.km, y, { width: col.purpose });
  y += 14;
  doc.moveTo(startX, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke('#cccccc');
  y += 6;
  doc.fillColor('#000000').fontSize(8);

  for (const line of lines) {
    if (y > doc.page.height - doc.page.margins.bottom - 40) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc.text(formatDateRo(line.date), startX, y, { width: col.date });
    doc.text(line.registrationNumber, startX + col.date, y, { width: col.reg });
    doc.text(line.route, startX + col.date + col.reg, y, { width: col.route });
    doc.text(line.distanceKm != null ? String(line.distanceKm) : '—', startX + col.date + col.reg + col.route, y, {
      width: col.km,
    });
    doc.text(line.purpose, startX + col.date + col.reg + col.route + col.km, y, { width: col.purpose });
    y += 12;
  }
  doc.y = y;
}

function drawFazTable(doc: PDFKit.PDFDocument, lines: FazDailyLine[]) {
  doc.fontSize(10).text('Rezumat zilnic', { underline: true });
  doc.moveDown(0.5);
  if (lines.length === 0) {
    doc.text('Nu exista activitate in perioada selectata.');
    return;
  }
  const col = { date: 56, reg: 80, trips: 40, km: 44, fuel: 48 };
  let y = doc.y;
  const startX = doc.page.margins.left;
  doc.fontSize(8).fillColor('#333333');
  doc.text('Data', startX, y, { width: col.date });
  doc.text('Auto', startX + col.date, y, { width: col.reg });
  doc.text('Curse', startX + col.date + col.reg, y, { width: col.trips });
  doc.text('Km', startX + col.date + col.reg + col.trips, y, { width: col.km });
  doc.text('Litri', startX + col.date + col.reg + col.trips + col.km, y, { width: col.fuel });
  y += 14;
  doc.moveTo(startX, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke('#cccccc');
  y += 6;
  doc.fillColor('#000000').fontSize(8);

  for (const line of lines) {
    if (y > doc.page.height - doc.page.margins.bottom - 40) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc.text(formatDateRo(line.date), startX, y, { width: col.date });
    doc.text(line.registrationNumber, startX + col.date, y, { width: col.reg });
    doc.text(String(line.tripCount), startX + col.date + col.reg, y, { width: col.trips });
    doc.text(String(line.distanceKm), startX + col.date + col.reg + col.trips, y, { width: col.km });
    doc.text(line.fuelLiters > 0 ? line.fuelLiters.toFixed(2) : '—', startX + col.date + col.reg + col.trips + col.km, y, {
      width: col.fuel,
    });
    y += 12;
  }
  doc.y = y;
}
