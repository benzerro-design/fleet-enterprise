import { Injectable, Logger } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';

type VisionAnnotateResponse = {
  responses?: Array<{
    fullTextAnnotation?: { text?: string };
    error?: { message?: string };
  }>;
};

type VisionFileAnnotateResponse = {
  responses?: Array<{
    responses?: Array<{
      fullTextAnnotation?: { text?: string };
      error?: { message?: string };
    }>;
  }>;
};

/**
 * OCR CIV via Cloud Vision REST (ADC pe Cloud Run).
 * Fără `@google-cloud/vision` — păstrează imaginea Docker mică.
 * Dezactivează cu CIV_OCR=off.
 */
@Injectable()
export class CivOcrService {
  private readonly logger = new Logger(CivOcrService.name);
  private auth: GoogleAuth | null = null;

  isEnabled(): boolean {
    const flag = (process.env.CIV_OCR ?? 'on').trim().toLowerCase();
    return flag !== 'off' && flag !== '0' && flag !== 'false';
  }

  /**
   * Extrage text din imagine (jpeg/png/webp/gif) sau PDF (primele pagini).
   * Returnează null dacă OCR e dezactivat / eșuează.
   */
  async extractText(buf: Buffer, contentType: string): Promise<string | null> {
    if (!this.isEnabled()) return null;
    const ct = (contentType || '').split(';')[0].trim().toLowerCase();
    try {
      if (ct === 'application/pdf' || buf.slice(0, 5).toString('utf8') === '%PDF-') {
        return await this.ocrPdf(buf);
      }
      if (ct.startsWith('image/') || this.looksLikeImage(buf)) {
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
    if (buf[0] === 0xff && buf[1] === 0xd8) return true;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
    if (
      buf.slice(0, 4).toString('ascii') === 'RIFF' &&
      buf.slice(8, 12).toString('ascii') === 'WEBP'
    ) {
      return true;
    }
    if (buf.slice(0, 3).toString('ascii') === 'GIF') return true;
    return false;
  }

  private getAuth(): GoogleAuth {
    if (!this.auth) {
      this.auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-vision'],
      });
    }
    return this.auth;
  }

  private async accessToken(): Promise<string> {
    const client = await this.getAuth().getClient();
    const token = await client.getAccessToken();
    const value = typeof token === 'string' ? token : token?.token;
    if (!value) throw new Error('No Google access token for Vision');
    return value;
  }

  private async ocrImage(buf: Buffer): Promise<string | null> {
    const token = await this.accessToken();
    const res = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: { content: buf.toString('base64') },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Vision images:annotate HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as VisionAnnotateResponse;
    const first = json.responses?.[0];
    if (first?.error?.message) throw new Error(first.error.message);
    const text = first?.fullTextAnnotation?.text?.trim();
    return text || null;
  }

  private async ocrPdf(buf: Buffer): Promise<string | null> {
    const token = await this.accessToken();
    // Sync file annotation — CIV are tipic 4 pagini (A5 împăturit).
    const res = await fetch('https://vision.googleapis.com/v1/files:annotate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            inputConfig: {
              mimeType: 'application/pdf',
              content: buf.toString('base64'),
            },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            pages: [1, 2, 3, 4],
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Vision files:annotate HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as VisionFileAnnotateResponse;
    const parts: string[] = [];
    for (const fileResp of json.responses ?? []) {
      for (const pageResp of fileResp.responses ?? []) {
        if (pageResp.error?.message) {
          this.logger.warn(`Vision PDF page error: ${pageResp.error.message}`);
          continue;
        }
        const t = pageResp.fullTextAnnotation?.text?.trim();
        if (t) parts.push(t);
      }
    }
    const text = parts.join('\n\n').trim();
    return text || null;
  }
}
