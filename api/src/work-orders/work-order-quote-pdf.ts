import { existsSync } from 'fs';
import PDFDocument from 'pdfkit';
import { displayQuoteMoneyTotals, type WorkOrderQuoteRecord } from './work-order-quotes.types';

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

function quoteStatusRo(status: string): string {
  switch (status) {
    case 'draft':
      return 'Ciornă';
    case 'submitted':
      return 'Trimis';
    case 'approved':
      return 'Aprobat';
    case 'rejected':
      return 'Respins';
    default:
      return status;
  }
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
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
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
    const left = 48;
    const usable = 499;
    const right = left + usable;
    const cols = {
      nr: left,
      name: left + 28,
      qty: left + 248,
      unit: left + 288,
      vat: left + 358,
      net: left + 398,
      gross: left + 458,
    };
    const colW = {
      nr: 24,
      name: 216,
      qty: 36,
      unit: 66,
      vat: 36,
      net: 56,
      gross: 55,
    };

    // Header
    doc.fontSize(18).font(strong).fillColor('#111').text('DEVIZ DE REPARAȚIE', left, 48, {
      width: usable * 0.62,
    });
    const metaTop = 48;
    doc.font(body).fontSize(9).fillColor('#555');
    doc.text('Fleet Enterprise', right - 160, metaTop, { width: 160, align: 'right' });
    if (displayNumber) {
      doc.font(strong).fontSize(10).fillColor('#111');
      doc.text(displayNumber, right - 160, metaTop + 14, { width: 160, align: 'right' });
    }
    doc.y = Math.max(doc.y, metaTop + 36);

    doc.moveDown(0.35);
    doc.font(body).fontSize(10).fillColor('#222');
    doc.text(workOrderTitle, left, doc.y, { width: usable });
    if (supplierName) {
      doc.fillColor('#444').fontSize(9).text(`Furnizor: ${supplierName}`, { width: usable });
    }
    const quoteName = quote.title?.trim() || `Deviz ${quote.version}`;
    const submittedLabel = quote.submittedAt
      ? new Date(quote.submittedAt).toLocaleDateString('ro-RO')
      : new Date().toLocaleDateString('ro-RO');
    doc
      .fillColor('#333')
      .fontSize(9)
      .text(
        `${quoteName}  ·  v${quote.version}  ·  ${quoteStatusRo(quote.status)}  ·  ${submittedLabel}`,
        { width: usable },
      );

    doc.moveDown(0.45);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(1).strokeColor('#222').stroke();
    doc.moveDown(0.35);

    // Table header
    const headerY = doc.y;
    doc.rect(left, headerY - 2, usable, 16).fill('#f3f3f3');
    doc.fillColor('#111').font(strong).fontSize(8);
    doc.text('Nr.', cols.nr, headerY, { width: colW.nr });
    doc.text('Denumire operație / piesă', cols.name, headerY, { width: colW.name });
    doc.text('Buc', cols.qty, headerY, { width: colW.qty, align: 'right' });
    doc.text('Preț net', cols.unit, headerY, { width: colW.unit, align: 'right' });
    doc.text('TVA%', cols.vat, headerY, { width: colW.vat, align: 'right' });
    doc.text('Total net', cols.net, headerY, { width: colW.net, align: 'right' });
    doc.text('Cu TVA', cols.gross, headerY, { width: colW.gross, align: 'right' });
    doc.y = headerY + 16;
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.2);

    const active = quote.lines.filter((l) => l.approvalStatus !== 'rejected');
    const rejected = quote.lines.filter((l) => l.approvalStatus === 'rejected');

    let nr = 0;
    for (const line of active) {
      nr += 1;
      const y = doc.y;
      const lineGross = line.lineNetCents + line.lineVatCents;
      doc.font(body).fontSize(8).fillColor('#111');
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
      doc.y = y + Math.max(nameH, 12) + 6;
      if (doc.y > 720) doc.addPage();
    }

    if (rejected.length) {
      doc.moveDown(0.3);
      doc.font(strong).fontSize(8).fillColor('#666').text('Linii respinse (nu intră în total)');
      doc.moveDown(0.15);
      for (const line of rejected) {
        doc.font(body).fontSize(7).fillColor('#888').text(
          `${line.description} · ${line.quantity} × ${formatMoney(line.unitNetCents, quote.currency)}`,
        );
      }
      doc.fillColor('#111');
    }

    // Totals box — immediately under table, fixed width right-aligned
    doc.moveDown(0.5);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.4);

    const boxW = 220;
    const boxX = right - boxW;
    const rowH = 16;
    let ty = doc.y;

    doc.font(body).fontSize(10).fillColor('#333');
    doc.text('Total net', boxX, ty, { width: boxW * 0.5 });
    doc.text(formatMoney(money.totalNetCents, quote.currency), boxX + boxW * 0.5, ty, {
      width: boxW * 0.5,
      align: 'right',
    });
    ty += rowH;
    doc.text('TVA', boxX, ty, { width: boxW * 0.5 });
    doc.text(formatMoney(money.totalVatCents, quote.currency), boxX + boxW * 0.5, ty, {
      width: boxW * 0.5,
      align: 'right',
    });
    ty += rowH + 4;
    doc
      .rect(boxX - 6, ty - 4, boxW + 12, 22)
      .fillAndStroke('#f7f7f7', '#222');
    doc.font(strong).fontSize(11).fillColor('#111');
    doc.text('TOTAL DE PLATĂ', boxX, ty, { width: boxW * 0.48 });
    doc.text(formatMoney(money.totalGrossCents, quote.currency), boxX + boxW * 0.48, ty, {
      width: boxW * 0.52,
      align: 'right',
    });
    doc.y = ty + 28;

    doc.font(body).fontSize(8).fillColor('#666');
    doc.text('Document generat din Fleet Enterprise. Nu ține loc de factură fiscală.', left, doc.y, {
      width: usable,
      align: 'left',
    });

    if (quote.notes?.trim()) {
      doc.moveDown(0.8);
      doc.font(strong).fontSize(9).fillColor('#333').text('Note');
      doc.font(body).fontSize(9).fillColor('#444').text(quote.notes.trim(), { width: usable });
    }

    doc.end();
  });
}
