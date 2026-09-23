import { existsSync } from 'fs';
import PDFDocument from 'pdfkit';
import { displayQuoteMoneyTotals, type WorkOrderQuoteRecord } from './work-order-quotes.types';

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

/** Helvetica (WinAnsi) nu are ă â î ș ț. */
function unicodeFont(kind: 'regular' | 'bold'): string | null {
  const candidates =
    kind === 'bold'
      ? ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'C:\\Windows\\Fonts\\arialbd.ttf']
      : ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'C:\\Windows\\Fonts\\arial.ttf'];
  return candidates.find((p) => existsSync(p)) ?? null;
}

export async function buildQuotePdfBuffer(input: {
  workOrderTitle: string;
  displayNumber: string | null;
  supplierName: string | null;
  quote: WorkOrderQuoteRecord;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const regular = unicodeFont('regular');
    const bold = unicodeFont('bold');
    if (regular) doc.registerFont('Ro', regular);
    if (bold) doc.registerFont('Ro-Bold', bold);
    const body = regular ? 'Ro' : 'Helvetica';
    const strong = bold ? 'Ro-Bold' : 'Helvetica-Bold';

    const { quote, workOrderTitle, displayNumber, supplierName } = input;
    const money = displayQuoteMoneyTotals(quote);
    const left = 40;
    const usable = 515;
    const cols = {
      nr: left,
      name: left + 28,
      qty: left + 250,
      unit: left + 290,
      vat: left + 360,
      net: left + 400,
      gross: left + 460,
    };
    const colW = {
      nr: 24,
      name: 218,
      qty: 36,
      unit: 66,
      vat: 36,
      net: 56,
      gross: 55,
    };

    doc.fontSize(16).font(strong).text('DEVIZ DE REPARAȚIE', { continued: false });
    doc.font(body).fontSize(9).fillColor('#333');
    doc.moveDown(0.3);
    doc.text('Fleet Enterprise');
    doc.moveDown(0.4);
    doc.fillColor('#000').fontSize(10);
    if (displayNumber) doc.text(`Comandă ${displayNumber}`);
    doc.text(workOrderTitle);
    if (supplierName) doc.text(`Furnizor: ${supplierName}`);
    const quoteName = quote.title?.trim() || `Deviz ${quote.version}`;
    doc.text(
      `${quoteName}  ·  v${quote.version}  ·  ${quote.status}  ·  ${new Date().toLocaleDateString('ro-RO')}`,
    );
    doc.moveDown(0.5);
    doc.moveTo(left, doc.y).lineTo(left + usable, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.4);

    const headerY = doc.y;
    doc.font(strong).fontSize(8).fillColor('#000');
    doc.text('Nr.', cols.nr, headerY, { width: colW.nr });
    doc.text('Denumire operație / piesă', cols.name, headerY, { width: colW.name });
    doc.text('Buc', cols.qty, headerY, { width: colW.qty, align: 'right' });
    doc.text('Preț net', cols.unit, headerY, { width: colW.unit, align: 'right' });
    doc.text('TVA%', cols.vat, headerY, { width: colW.vat, align: 'right' });
    doc.text('Total net', cols.net, headerY, { width: colW.net, align: 'right' });
    doc.text('Cu TVA', cols.gross, headerY, { width: colW.gross, align: 'right' });
    doc.moveDown(0.2);
    doc.moveTo(left, doc.y).lineTo(left + usable, doc.y).strokeColor('#dddddd').stroke();
    doc.moveDown(0.25);

    const active = quote.lines.filter((l) => l.approvalStatus !== 'rejected');
    const rejected = quote.lines.filter((l) => l.approvalStatus === 'rejected');

    let nr = 0;
    for (const line of active) {
      nr += 1;
      const y = doc.y;
      const lineGross = line.lineNetCents + line.lineVatCents;
      doc.font(body).fontSize(8).fillColor('#000');
      doc.text(String(nr), cols.nr, y, { width: colW.nr });
      const nameBlock = line.partNumber
        ? `${line.description}\nCod: ${line.partNumber}`
        : line.description;
      doc.text(nameBlock, cols.name, y, { width: colW.name });
      const nameH = doc.heightOfString(nameBlock, { width: colW.name });
      doc.text(String(line.quantity), cols.qty, y, { width: colW.qty, align: 'right' });
      doc.text(formatMoney(line.unitNetCents, quote.currency), cols.unit, y, {
        width: colW.unit,
        align: 'right',
      });
      doc.text(String(line.vatRatePercent), cols.vat, y, { width: colW.vat, align: 'right' });
      doc.text(formatMoney(line.lineNetCents, quote.currency), cols.net, y, {
        width: colW.net,
        align: 'right',
      });
      doc.text(formatMoney(lineGross, quote.currency), cols.gross, y, {
        width: colW.gross,
        align: 'right',
      });
      doc.y = y + Math.max(nameH, 12) + 4;
      if (doc.y > 740) doc.addPage();
    }

    if (rejected.length) {
      doc.moveDown(0.4);
      doc.font(strong).fontSize(8).fillColor('#666').text('Linii respinse (nu intră în total)');
      doc.moveDown(0.2);
      for (const line of rejected) {
        doc.font(body).fontSize(7).fillColor('#888').text(
          `${line.description} · ${line.quantity} × ${formatMoney(line.unitNetCents, quote.currency)}`,
        );
      }
      doc.fillColor('#000');
    }

    doc.moveDown(0.6);
    doc.moveTo(left, doc.y).lineTo(left + usable, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.4);
    doc.font(body).fontSize(10).fillColor('#000');
    doc.text(`Total net: ${formatMoney(money.totalNetCents, quote.currency)}`, { align: 'right' });
    doc.text(`TVA: ${formatMoney(money.totalVatCents, quote.currency)}`, { align: 'right' });
    doc.moveDown(0.2);
    doc
      .font(strong)
      .fontSize(12)
      .text(`TOTAL DE PLATĂ: ${formatMoney(money.totalGrossCents, quote.currency)}`, {
        align: 'right',
      });
    doc.font(body).fontSize(8).fillColor('#666');
    doc.moveDown(0.8);
    doc.text('Document generat din Fleet Enterprise. Nu ține loc de factură fiscală.', {
      align: 'left',
    });

    if (quote.notes?.trim()) {
      doc.moveDown();
      doc.font(body).fontSize(9).fillColor('#444').text(`Note: ${quote.notes.trim()}`);
    }

    doc.end();
  });
}
