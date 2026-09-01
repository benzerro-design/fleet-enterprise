import PDFDocument from 'pdfkit';
import { displayQuoteMoneyTotals, type WorkOrderQuoteRecord } from './work-order-quotes.types';

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

function discountNote(
  line: { discountPercent?: number; discountCents?: number },
  currency: string,
): string {
  if ((line.discountPercent ?? 0) > 0) return ` − ${line.discountPercent}%`;
  if ((line.discountCents ?? 0) > 0) return ` − ${formatMoney(line.discountCents ?? 0, currency)}`;
  return '';
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

    const { quote, workOrderTitle, displayNumber, supplierName } = input;
    const money = displayQuoteMoneyTotals(quote);

    doc.fontSize(18).text('Deviz service', { continued: false });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#444');
    if (displayNumber) doc.text(`Comandă: ${displayNumber}`);
    doc.text(`Lucrare: ${workOrderTitle}`);
    if (supplierName) doc.text(`Furnizor: ${supplierName}`);
    doc.text(`Deviz v${quote.version} · ${quote.status}`);
    doc.text(`Data: ${new Date().toLocaleDateString('ro-RO')}`);
    doc.moveDown();

    doc.fillColor('#000').fontSize(11).text('Linii deviz', { underline: true });
    doc.moveDown(0.5);

    for (const line of quote.lines) {
      const rejected = line.approvalStatus === 'rejected';
      const prefix = rejected ? '[RESPINS] ' : '';
      doc
        .fontSize(9)
        .fillColor(rejected ? '#888' : '#000')
        .text(
          `${prefix}${line.description} · ${line.quantity} × ${formatMoney(line.unitNetCents, quote.currency)}${discountNote(line, quote.currency)} + TVA ${line.vatRatePercent}% = ${formatMoney(line.lineNetCents, quote.currency)}`,
        );
      if (line.partNumber) doc.fontSize(8).fillColor('#666').text(`Cod: ${line.partNumber}`);
      doc.fillColor('#000');
    }

    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Total net: ${formatMoney(money.totalNetCents, quote.currency)}`);
    doc.text(`TVA: ${formatMoney(money.totalVatCents, quote.currency)}`);
    doc.fontSize(12).font('Helvetica-Bold').text(`Total: ${formatMoney(money.totalGrossCents, quote.currency)}`);
    doc.font('Helvetica');

    if (quote.notes?.trim()) {
      doc.moveDown();
      doc.fontSize(9).fillColor('#444').text(`Note: ${quote.notes.trim()}`);
    }

    doc.end();
  });
}
