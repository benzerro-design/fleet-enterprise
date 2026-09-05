import { Injectable, Logger } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { rebuildCivOcrTextFromVision } from './civ-ocr-layout';
import { extractCivPdfImages, type CivPdfImage } from './civ-pdf-image';

type VisionFullTextAnnotation = {
  text?: string;
  pages?: Array<{
    width?: number;
    height?: number;
    blocks?: Array<{
      paragraphs?: Array<{
        words?: Array<{
          boundingBox?: { vertices?: Array<{ x?: number; y?: number }> };
          symbols?: Array<{
            text?: string;
            property?: { detectedBreak?: { type?: string } };
          }>;
        }>;
      }>;
    }>;
  }>;
};

type VisionPageResponse = {
  fullTextAnnotation?: VisionFullTextAnnotation;
  error?: { message?: string; status?: string };
};

type VisionAnnotateResponse = {
  responses?: VisionPageResponse[];
  error?: { message?: string; status?: string };
};

type VisionFileAnnotateResponse = {
  responses?: Array<{
    responses?: VisionPageResponse[];
    error?: { message?: string; status?: string };
  }>;
  error?: { message?: string; status?: string };
};

export type CivOcrResult = {
  text: string | null;
  /** Motiv scurt pentru UI / log când text e null */
  error?: string;
};

/**
 * OCR CIV via Cloud Vision REST (ADC pe Cloud Run).
 * Textul e reconstruit pe linii din bounding box (etichetă:valoare pe aceeași linie),
 * inclusiv split stânga/dreapta pe scan tip carte (2 pagini pe o imagine).
 */
@Injectable()
export class CivOcrService {
  private readonly logger = new Logger(CivOcrService.name);
  private auth: GoogleAuth | null = null;

  isEnabled(): boolean {
    const flag = (process.env.CIV_OCR ?? 'on').trim().toLowerCase();
    return flag !== 'off' && flag !== '0' && flag !== 'false';
  }

  async extractText(buf: Buffer, contentType: string): Promise<CivOcrResult> {
    if (!this.isEnabled()) {
      return { text: null, error: 'CIV_OCR=off pe API' };
    }
    const ct = (contentType || '').split(';')[0].trim().toLowerCase();
    try {
      if (ct === 'application/pdf' || buf.slice(0, 5).toString('utf8') === '%PDF-') {
        const unwrapped = await this.ocrPdfAsImages(buf);
        if (unwrapped?.text) return unwrapped;
        return await this.ocrPdf(buf);
      }
      if (ct.startsWith('image/') || this.looksLikeImage(buf)) {
        return await this.ocrImage(buf);
      }
      return { text: null, error: `Tip fișier neacceptat pentru OCR: ${ct || 'unknown'}` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Vision OCR error';
      this.logger.warn(`CIV Vision OCR failed: ${msg}`);
      return { text: null, error: this.humanizeVisionError(msg) };
    }
  }

  private humanizeVisionError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes('403') || m.includes('permission') || m.includes('denied')) {
      return 'Vision API: permisiune lipsă (activează vision.googleapis.com + roles/cloudvision.user pe SA API)';
    }
    if (m.includes('404') || m.includes('was not found') || m.includes('has not been used')) {
      return 'Vision API nu e activată pe proiectul GCP (Enable Cloud Vision API)';
    }
    if (m.includes('billing')) {
      return 'Vision API: billing proiect GCP inactiv';
    }
    if (m.includes('429') || m.includes('quota')) {
      return 'Vision API: cotă depășită — reîncearcă mai târziu';
    }
    return msg.length > 220 ? `${msg.slice(0, 220)}…` : msg;
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
    if (!value) throw new Error('No Google access token for Vision (ADC / Cloud Run SA)');
    return value;
  }

  private textFromAnnotation(ann: VisionFullTextAnnotation | undefined): string | null {
    if (!ann) return null;
    const rebuilt = rebuildCivOcrTextFromVision(ann);
    if (rebuilt?.trim()) return rebuilt.trim();
    return ann.text?.trim() || null;
  }

  private async ocrImage(buf: Buffer): Promise<CivOcrResult> {
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
      throw new Error(`Vision images:annotate HTTP ${res.status} ${body.slice(0, 280)}`);
    }
    const json = (await res.json()) as VisionAnnotateResponse;
    if (json.error?.message) throw new Error(json.error.message);
    const first = json.responses?.[0];
    if (first?.error?.message) throw new Error(first.error.message);
    const text = this.textFromAnnotation(first?.fullTextAnnotation);
    if (!text) {
      return { text: null, error: 'Vision nu a găsit text pe imagine (scan neclar?)' };
    }
    return { text };
  }

  /**
   * Un CIV scanat e o singură imagine împachetată în PDF. Pe files:annotate, Google
   * o rasterizează la o rezoluție pe care nu o controlăm și pierde detaliu — așa
   * ajungea un 9 de la S.1 să fie citit 6. O scoatem exact cum e în fișier și o
   * trimitem pe calea de imagine. Null înseamnă „nu e un scan simplu”, deci PDF ca înainte.
   */
  private async ocrPdfAsImages(buf: Buffer): Promise<CivOcrResult | null> {
    let images: CivPdfImage[];
    try {
      images = extractCivPdfImages(buf);
    } catch (e) {
      this.logger.warn(`CIV PDF unwrap failed: ${e instanceof Error ? e.message : e}`);
      return null;
    }
    if (!images.length) return null;

    const parts: string[] = [];
    for (const img of images) {
      const page = await this.ocrImage(img.data);
      if (page.text) parts.push(page.text);
    }
    if (!parts.length) return null;

    const px = images.map((i) => `${i.width}x${i.height}`).join(' + ');
    this.logger.log(`CIV PDF citit ca imagine la rezoluția scanului, cu orientarea din pagină (${px})`);
    return { text: parts.join('\n\n') };
  }

  private async ocrPdf(buf: Buffer): Promise<CivOcrResult> {
    const attempts = [
      [1, 2, 3, 4],
      [1, 2],
      [1],
    ];
    let lastErr: string | null = null;
    for (const pages of attempts) {
      try {
        const result = await this.ocrPdfPages(buf, pages);
        if (result.text) return result;
        lastErr = result.error ?? 'Vision PDF: fără text pe paginile cerute';
      } catch (e) {
        lastErr = e instanceof Error ? e.message : 'Vision PDF error';
        this.logger.warn(`Vision PDF pages=[${pages.join(',')}]: ${lastErr}`);
      }
    }
    return {
      text: null,
      error: this.humanizeVisionError(
        lastErr ?? 'Vision PDF OCR eșuat — încearcă JPEG/PNG cu paginile CIV',
      ),
    };
  }

  private async ocrPdfPages(buf: Buffer, pages: number[]): Promise<CivOcrResult> {
    const token = await this.accessToken();
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
            pages,
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Vision files:annotate HTTP ${res.status} ${body.slice(0, 280)}`);
    }
    const json = (await res.json()) as VisionFileAnnotateResponse;
    if (json.error?.message) throw new Error(json.error.message);
    const parts: string[] = [];
    let pageErr: string | null = null;
    for (const fileResp of json.responses ?? []) {
      if (fileResp.error?.message) {
        pageErr = fileResp.error.message;
        continue;
      }
      for (const pageResp of fileResp.responses ?? []) {
        if (pageResp.error?.message) {
          pageErr = pageResp.error.message;
          continue;
        }
        const t = this.textFromAnnotation(pageResp.fullTextAnnotation);
        if (t) parts.push(t);
      }
    }
    const text = parts.join('\n\n').trim();
    if (text) return { text };
    return {
      text: null,
      error: pageErr
        ? this.humanizeVisionError(pageErr)
        : 'Vision PDF: fără text (document scanat neclar sau API fără răspuns)',
    };
  }
}
