import { existsSync } from 'fs';
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

/** Helvetica (WinAnsi) nu are ă â î ș ț — același pattern ca la deviz WO. */
function unicodeFont(kind: 'regular' | 'bold'): string | null {
  const candidates =
    kind === 'bold'
      ? ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'C:\\Windows\\Fonts\\arialbd.ttf']
      : ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'C:\\Windows\\Fonts\\arial.ttf'];
  return candidates.find((p) => existsSync(p)) ?? null;
}

/** Dată calendaristică din ISO (perioadă FAZ); evită +1 zi la 23:59 UTC. */
function formatDateRo(iso: string): string {
  const day = iso.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('ro-RO');
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('ro-RO');
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

type Fonts = { body: string; strong: string };

export function buildTripSheetPdf(input: TripSheetPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const regular = unicodeFont('regular');
    const bold = unicodeFont('bold');
    if (regular) doc.registerFont('Ro', regular);
    if (bold) doc.registerFont('Ro-Bold', bold);
    const fonts: Fonts = {
      body: regular ? 'Ro' : 'Helvetica',
      strong: bold ? 'Ro-Bold' : 'Helvetica-Bold',
    };

    const left = 48;
    const usable = 499;
    const right = left + usable;

    const headerTitle =
      input.docType === 'faz_monthly' ? 'FIȘĂ ACTIVITĂȚI ZILNICE (FAZ)' : 'FOAIE DE PARCURS';

    // Header — același stil ca devizul WO
    doc.fontSize(16).font(fonts.strong).fillColor('#111').text(headerTitle, left, 48, {
      width: usable * 0.68,
    });
    doc.font(fonts.body).fontSize(9).fillColor('#555');
    doc.text('Fleet Enterprise', right - 150, 48, { width: 150, align: 'right' });
    doc.font(fonts.body).fontSize(8).fillColor('#666');
    doc.text(tripSheetDocTypeLabel(input.docType), right - 150, 62, { width: 150, align: 'right' });
    doc.y = Math.max(doc.y, 78);

    doc.moveDown(0.25);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(1).strokeColor('#222').stroke();
    doc.moveDown(0.4);

    // Meta bloc
    doc.font(fonts.body).fontSize(10).fillColor('#222');
    doc.text(`Organizație: ${input.tenantName}`, left, doc.y, { width: usable });
    doc.text(
      `Perioadă: ${formatDateRo(input.periodStart)} – ${formatDateRo(input.periodEnd)}`,
      { width: usable },
    );
    if (input.driverName) {
      doc.text(`Conducător: ${input.driverName}`, { width: usable });
    }

    doc.moveDown(0.35);
    doc.font(fonts.strong).fontSize(9).fillColor('#333').text('Vehicule incluse');
    doc.font(fonts.body).fontSize(9).fillColor('#444');
    for (const v of input.vehicles) {
      doc.text(`• ${vehicleLabel(v)}`, { width: usable, indent: 4 });
    }

    doc.moveDown(0.5);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.35);

    if (input.docType === 'faz_monthly') {
      drawFazTable(doc, fonts, left, right, usable, input.fazDailyLines);
    } else {
      drawTripTable(doc, fonts, left, right, usable, input.tripLines);
    }

    // Totaluri — casetă aliniată dreapta ca la deviz
    doc.moveDown(0.6);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.4);

    const boxW = 240;
    const boxX = right - boxW;
    const rowH = 15;
    let ty = doc.y;

    doc.font(fonts.strong).fontSize(10).fillColor('#111').text('Totaluri perioadă', left, ty);
    ty = Math.max(ty, doc.y);

    doc.font(fonts.body).fontSize(9).fillColor('#333');
    const rows: Array<[string, string]> = [
      ['Curse', String(input.totals.tripCount)],
      ['Km parcurși', String(input.totals.distanceKm)],
      ['Combustibil', `${input.totals.fuelLiters.toFixed(2)} L`],
      ['Cost combustibil', formatMoneyCents(input.totals.fuelCostCents)],
    ];
    if (input.totals.odometerStartKm != null || input.totals.odometerEndKm != null) {
      rows.push([
        'Odometru',
        `${input.totals.odometerStartKm ?? '—'} → ${input.totals.odometerEndKm ?? '—'}`,
      ]);
    }

    for (const [label, value] of rows) {
      doc.font(fonts.body).fontSize(9).fillColor('#333');
      doc.text(label, boxX, ty, { width: boxW * 0.48 });
      doc.text(value, boxX + boxW * 0.48, ty, { width: boxW * 0.52, align: 'right' });
      ty += rowH;
    }
    doc.y = ty + 8;

    doc.font(fonts.body).fontSize(8).fillColor('#666');
    doc.text(
      `Document generat ${new Date().toLocaleString('ro-RO')} · Fleet Enterprise. Nu ține loc de document fiscal.`,
      left,
      doc.y,
      { width: usable },
    );

    doc.end();
  });
}

function ensureSpace(doc: PdfDoc, needed: number) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - needed) {
    doc.addPage();
  }
}

function drawTripTable(
  doc: PdfDoc,
  fonts: Fonts,
  left: number,
  right: number,
  usable: number,
  lines: TripSheetLine[],
) {
  doc.font(fonts.strong).fontSize(10).fillColor('#111').text('Detaliu curse', left, doc.y);
  doc.moveDown(0.35);

  if (lines.length === 0) {
    doc.font(fonts.body).fontSize(9).fillColor('#666').text('Nu există curse în perioada selectată.');
    return;
  }

  const cols = {
    date: left,
    reg: left + 58,
    route: left + 128,
    km: left + 318,
    purpose: left + 350,
    driver: left + 410,
  };
  const colW = {
    date: 54,
    reg: 66,
    route: 186,
    km: 28,
    purpose: 56,
    driver: left + usable - 410,
  };

  const headerY = doc.y;
  doc.rect(left, headerY - 2, usable, 16).fill('#f3f3f3');
  doc.fillColor('#111').font(fonts.strong).fontSize(8);
  doc.text('Data', cols.date, headerY, { width: colW.date });
  doc.text('Auto', cols.reg, headerY, { width: colW.reg });
  doc.text('Traseu', cols.route, headerY, { width: colW.route });
  doc.text('Km', cols.km, headerY, { width: colW.km, align: 'right' });
  doc.text('Scop', cols.purpose, headerY, { width: colW.purpose });
  doc.text('Șofer', cols.driver, headerY, { width: colW.driver });
  doc.y = headerY + 16;
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.15);

  for (const line of lines) {
    ensureSpace(doc, 36);
    const y = doc.y;
    const routeText = line.route || '—';
    doc.font(fonts.body).fontSize(8).fillColor('#111');
    doc.text(formatDateRo(line.date), cols.date, y, { width: colW.date });
    doc.text(line.registrationNumber, cols.reg, y, { width: colW.reg });
    doc.text(routeText, cols.route, y, { width: colW.route });
    const routeH = doc.heightOfString(routeText, { width: colW.route });
    doc.text(line.distanceKm != null ? String(line.distanceKm) : '—', cols.km, y, {
      width: colW.km,
      align: 'right',
    });
    doc.text(line.purpose || '—', cols.purpose, y, { width: colW.purpose });
    doc.text(line.driverName || '—', cols.driver, y, { width: colW.driver });
    doc.y = y + Math.max(routeH, 11) + 4;
  }
}

function drawFazTable(
  doc: PdfDoc,
  fonts: Fonts,
  left: number,
  right: number,
  usable: number,
  lines: FazDailyLine[],
) {
  doc.font(fonts.strong).fontSize(10).fillColor('#111').text('Rezumat zilnic', left, doc.y);
  doc.moveDown(0.35);

  if (lines.length === 0) {
    doc
      .font(fonts.body)
      .fontSize(9)
      .fillColor('#666')
      .text('Nu există activitate în perioada selectată.');
    return;
  }

  const cols = {
    date: left,
    reg: left + 70,
    trips: left + 170,
    km: left + 230,
    fuel: left + 290,
    odo: left + 360,
  };
  const colW = {
    date: 66,
    reg: 96,
    trips: 54,
    km: 54,
    fuel: 64,
    odo: left + usable - 360,
  };

  const headerY = doc.y;
  doc.rect(left, headerY - 2, usable, 16).fill('#f3f3f3');
  doc.fillColor('#111').font(fonts.strong).fontSize(8);
  doc.text('Data', cols.date, headerY, { width: colW.date });
  doc.text('Auto', cols.reg, headerY, { width: colW.reg });
  doc.text('Curse', cols.trips, headerY, { width: colW.trips, align: 'right' });
  doc.text('Km', cols.km, headerY, { width: colW.km, align: 'right' });
  doc.text('Litri', cols.fuel, headerY, { width: colW.fuel, align: 'right' });
  doc.text('Odometru', cols.odo, headerY, { width: colW.odo });
  doc.y = headerY + 16;
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.15);

  for (const line of lines) {
    ensureSpace(doc, 28);
    const y = doc.y;
    doc.font(fonts.body).fontSize(8).fillColor('#111');
    doc.text(formatDateRo(line.date), cols.date, y, { width: colW.date });
    doc.text(line.registrationNumber, cols.reg, y, { width: colW.reg });
    doc.text(String(line.tripCount), cols.trips, y, { width: colW.trips, align: 'right' });
    doc.text(String(line.distanceKm), cols.km, y, { width: colW.km, align: 'right' });
    doc.text(line.fuelLiters > 0 ? line.fuelLiters.toFixed(2) : '—', cols.fuel, y, {
      width: colW.fuel,
      align: 'right',
    });
    const odo =
      line.odometerStartKm != null || line.odometerEndKm != null
        ? `${line.odometerStartKm ?? '—'} → ${line.odometerEndKm ?? '—'}`
        : '—';
    doc.text(odo, cols.odo, y, { width: colW.odo });
    doc.y = y + 13;
  }
}
