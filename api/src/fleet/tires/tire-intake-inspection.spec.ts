import {
  applyIntakeAssetTreads,
  assertAssetTreadsCoverSetItems,
  buildIntakeInspectionFromDemountReadings,
  coerceFiniteTreadMm,
  parseIntakeInspectionBody,
  parseIntakeTreadNotes,
  serializeIntakeTreadNotes,
  formatIntakeTreadNotesForDisplay,
  stripRimFieldsForTyreOnlyIntake,
} from './tire-intake-inspection';

describe('tire-intake-inspection', () => {
  it('round-trips structured JSON in intakeTreadNotes', () => {
    const serialized = serializeIntakeTreadNotes(
      {
        wearUniform: true,
        cracks: false,
        treadMm: { fl: 4.2, fr: 4.0 },
      },
      { summary: 'FL 4.2mm; FR 4.0mm' },
    );
    expect(serialized).toBeTruthy();
    const parsed = parseIntakeTreadNotes(serialized);
    expect(parsed.structured?.wearUniform).toBe(true);
    expect(parsed.structured?.cracks).toBe(false);
    expect(parsed.structured?.treadMm?.fl).toBe(4.2);
    expect(parsed.structured?.summary).toContain('4.2');
  });

  it('preserves legacy plain text', () => {
    const parsed = parseIntakeTreadNotes('FL 4mm');
    expect(parsed.legacyText).toBe('FL 4mm');
    expect(parsed.structured).toBeNull();
  });

  it('builds tread map from demount readings', () => {
    const built = buildIntakeInspectionFromDemountReadings(
      [
        { position: 'fl', treadMm: 3 },
        { position: 'rr', treadMm: 2.5 },
      ],
      { cracks: true },
    );
    expect(built.treadMm?.rr).toBe(2.5);
    expect(built.cracks).toBe(true);
  });

  it('serializes and parses v2 per-asset treads', () => {
    const serialized = serializeIntakeTreadNotes(
      {
        assets: [
          { assetId: 'a1', treadMm: 4.2 },
          { assetId: 'a2', treadMm: 3.5 },
        ],
      },
      { summary: 'recepție ok' },
    );
    expect(serialized).toContain('"v":2');
    const parsed = parseIntakeTreadNotes(serialized);
    expect(parsed.structured?.assets).toEqual([
      { assetId: 'a1', treadMm: 4.2 },
      { assetId: 'a2', treadMm: 3.5 },
    ]);
    expect(parsed.structured?.summary).toBe('recepție ok');
  });

  it('parseIntakeInspectionBody accepts assets array', () => {
    const parsed = parseIntakeInspectionBody({
      assets: [
        { assetId: 'x', treadMm: 2 },
        { assetId: 'y', treadMm: 2.5 },
      ],
    });
    expect(parsed?.assets).toHaveLength(2);
  });

  it('applyIntakeAssetTreads rejects duplicate assetIds', () => {
    expect(() =>
      applyIntakeAssetTreads([
        { assetId: 'a', treadMm: 1 },
        { assetId: 'a', treadMm: 2 },
      ]),
    ).toThrow(/duplicat/i);
  });

  it('assertAssetTreadsCoverSetItems requires full set coverage', () => {
    expect(() =>
      assertAssetTreadsCoverSetItems(['a1', 'a2'], [{ assetId: 'a1', treadMm: 3 }]),
    ).toThrow(/obligatoriu/i);
    expect(() =>
      assertAssetTreadsCoverSetItems(
        ['a1', 'a2'],
        [
          { assetId: 'a1', treadMm: 3 },
          { assetId: 'a2', treadMm: 4 },
        ],
      ),
    ).not.toThrow();
  });

  it('coerceFiniteTreadMm rejects blank and non-numeric coercion to zero', () => {
    expect(coerceFiniteTreadMm('')).toBeNull();
    expect(coerceFiniteTreadMm('   ')).toBeNull();
    expect(coerceFiniteTreadMm(false)).toBeNull();
    expect(coerceFiniteTreadMm([])).toBeNull();
    expect(coerceFiniteTreadMm({})).toBeNull();
    expect(coerceFiniteTreadMm('abc')).toBeNull();
    expect(coerceFiniteTreadMm(4.2)).toBe(4.2);
    expect(coerceFiniteTreadMm('3,5')).toBe(3.5);
  });

  it('applyIntakeAssetTreads rejects invalid treadMm values', () => {
    for (const treadMm of ['', ' ', false, []] as const) {
      expect(() => applyIntakeAssetTreads([{ assetId: 'a1', treadMm }])).toThrow(/invalid/i);
    }
    expect(applyIntakeAssetTreads([{ assetId: 'a1', treadMm: 2.5 }])).toEqual([
      { assetId: 'a1', treadMm: 2.5 },
    ]);
  });

  it('parseIntakeTreadNotes drops v2 assets with invalid tread', () => {
    const raw = JSON.stringify({
      v: 2,
      assets: [
        { assetId: 'ok', treadMm: 4 },
        { assetId: 'bad', treadMm: '' },
      ],
    });
    const parsed = parseIntakeTreadNotes(raw);
    expect(parsed.structured?.assets).toEqual([{ assetId: 'ok', treadMm: 4 }]);
  });

  it('serializes and parses v2 rim condition at set level', () => {
    const serialized = serializeIntakeTreadNotes({
      assets: [{ assetId: 'a1', treadMm: 3 }],
      rimCondition: 'scratched',
      rimNotes: 'zgârieturi ușoare',
    });
    const parsed = parseIntakeTreadNotes(serialized);
    expect(parsed.structured?.rimCondition).toBe('scratched');
    expect(parsed.structured?.rimNotes).toBe('zgârieturi ușoare');
  });

  it('stripRimFieldsForTyreOnlyIntake removes rim fields for tyre_only', () => {
    const stripped = stripRimFieldsForTyreOnlyIntake('tyre_only', {
      assets: [{ assetId: 'a1', treadMm: 3 }],
      rimCondition: 'ok',
      rimNotes: 'n/a',
      wearUniform: true,
    });
    const serialized = serializeIntakeTreadNotes(stripped ?? {});
    const parsed = parseIntakeTreadNotes(serialized);
    expect(parsed.structured?.rimCondition).toBeUndefined();
    expect(parsed.structured?.rimNotes).toBeUndefined();
    expect(parsed.structured?.wearUniform).toBe(true);
  });

  it('parseIntakeInspectionBody accepts rim fields', () => {
    const parsed = parseIntakeInspectionBody({
      rimCondition: 'ok',
      rimNotes: ' fără probleme ',
    });
    expect(parsed?.rimCondition).toBe('ok');
    expect(parsed?.rimNotes).toBe('fără probleme');
  });

  it('formatIntakeTreadNotesForDisplay renders v1 tread positions', () => {
    const raw = serializeIntakeTreadNotes({ treadMm: { fl: 4.2, fr: 4.0 } });
    const out = formatIntakeTreadNotesForDisplay(raw);
    expect(out).toContain('FL 4.2 mm');
    expect(out).not.toContain('"v"');
  });
});
