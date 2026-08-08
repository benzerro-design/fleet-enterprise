import { Injectable, Logger } from '@nestjs/common';
import { ImageAnnotatorClient } from '@google-cloud/vision';

/**
 * OCR CIV via Cloud Vision (ADC pe Cloud Run).
 * Dezactivează cu CIV_OCR=off. Fără Vision API enabled → returnează null (caller face fallback).
 */
@Injectable()
export class CivOcrService {
  private readonly logger = new Logger(CivOcrService.name);
  private client: ImageAnnotatorClient | null = null;

  isEnabled(): boolean {
    const flag = (process.env.CIV_OCR ?? 'on').trim().toLowerCase();
    return flag !== 'off' && flag !== '0' && flag !== 'false';
  }

  private getClient(): ImageAnnotatorClient {
    if (!this.client) this.client = new ImageAnnotatorClient();
    return this.client;
  }

  /**
   * Extrage text din imagine (jpeg/png/webp/gif) sau PDF (primele pagini).
   * Returnează null dacă OCR e dezactivat / eșuează (nu aruncă — fallback la paste).
   */
  async extractText(buf: Buffer, contentType: string): Promise<string | null> {
    if (!this.isEnabled()) return null;
    const ct = (contentType || '').split(';')[0].trim().toLowerCase();
    try {
      if (ct === 'application/pdf' || buf.slice(0, 5).toString('utf8') === '%PDF-') {
        return await this.ocrPdf(buf);
      }
      if (
        ct.startsWith('image/') ||
        this.looksLikeImage(buf)
      ) {
        return await this.ocrImage(buf);
      }
      return null;
    } catch (e) {
      this.logger.warn(
        `CIV Vision OCR failed: ${e instanceof Error ? e.message : 'error'}`,
      );
      return null;
    }
  }

  private looksLikeImage(buf: Buffer): boolean {
    if (buf.length < 4) return false;
    // JPEG
    if (buf[0] === 0xff && buf[1] === 0xd8) return true;
    // PNG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
    // WEBP (RIFF....WEBP)
    if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') {
      return true;
    }
    // GIF
    if (buf.slice(0, 3).toString('ascii') === 'GIF') return true;
    return false;
  }

  private async ocrImage(buf: Buffer): Promise<string | null> {
    const client = this.getClient();
    const [result] = await client.documentTextDetection({
      image: { content: buf.toString('base64') },
    });
    const text = result.fullTextAnnotation?.text?.trim();
    return text || null;
  }

  private async ocrPdf(buf: Buffer): Promise<string | null> {
    const client = this.getClient();
    // Sync file annotation — max ~5 pages typically enough for CIV (4 pages folded).
    const [result] = await client.batchAnnotateFiles({
      requests: [
        {
          inputConfig: {
            mimeType: 'application/pdf',
            content: buf.toString('base64'),
          },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          // pages: first 4 (CIV A5 folded)
          pages: [1, 2, 3, 4],
        },
      ],
    });
    const responses = result.responses ?? [];
    const parts: string[] = [];
    for (const fileResp of responses) {
      for (const pageResp of fileResp.responses ?? []) {
        const t = pageResp.fullTextAnnotation?.text?.trim();
        if (t) parts.push(t);
      }
    }
    const text = parts.join('\n\n').trim();
    return text || null;
  }
}
