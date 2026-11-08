import { TireCustodyProtocolStatus } from '@prisma/client';
import { assertTireCustodyArchiveReady } from './tire-custody-archive';

describe('assertTireCustodyArchiveReady', () => {
  it('passes when signed with hash and bytes', () => {
    expect(
      assertTireCustodyArchiveReady({
        status: TireCustodyProtocolStatus.signed,
        pdfSha256: 'abc',
        pdfBytes: Buffer.from('pdf'),
      }).ok,
    ).toBe(true);
  });

  it('fails when draft', () => {
    const r = assertTireCustodyArchiveReady({
      status: TireCustodyProtocolStatus.draft,
      pdfSha256: 'abc',
      pdfBytes: Buffer.from('pdf'),
    });
    expect(r.ok).toBe(false);
  });

  it('fails when hash missing', () => {
    const r = assertTireCustodyArchiveReady({
      status: 'signed',
      pdfSha256: null,
      pdfBytes: Buffer.from('pdf'),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/hash/i);
  });

  it('fails when bytes empty', () => {
    const r = assertTireCustodyArchiveReady({
      status: 'signed',
      pdfSha256: 'abc',
      pdfBytes: Buffer.alloc(0),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/bytes/i);
  });
});
