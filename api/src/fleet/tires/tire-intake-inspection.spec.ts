import {
  buildIntakeInspectionFromDemountReadings,
  parseIntakeTreadNotes,
  serializeIntakeTreadNotes,
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
});
