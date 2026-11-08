import { isTireCustodySmsConfigured, sendTireCustodySmsOtp } from './tire-custody-sms';

describe('tire-custody-sms', () => {
  const prevUrl = process.env.TIRE_CUSTODY_SMS_WEBHOOK_URL;
  const prevToken = process.env.TIRE_CUSTODY_SMS_WEBHOOK_TOKEN;

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.TIRE_CUSTODY_SMS_WEBHOOK_URL;
    else process.env.TIRE_CUSTODY_SMS_WEBHOOK_URL = prevUrl;
    if (prevToken === undefined) delete process.env.TIRE_CUSTODY_SMS_WEBHOOK_TOKEN;
    else process.env.TIRE_CUSTODY_SMS_WEBHOOK_TOKEN = prevToken;
    jest.restoreAllMocks();
  });

  it('isTireCustodySmsConfigured requires http(s) URL', () => {
    delete process.env.TIRE_CUSTODY_SMS_WEBHOOK_URL;
    expect(isTireCustodySmsConfigured()).toBe(false);
    process.env.TIRE_CUSTODY_SMS_WEBHOOK_URL = 'not-a-url';
    expect(isTireCustodySmsConfigured()).toBe(false);
    process.env.TIRE_CUSTODY_SMS_WEBHOOK_URL = 'https://sms.example/hook';
    expect(isTireCustodySmsConfigured()).toBe(true);
  });

  it('sendTireCustodySmsOtp fails when webhook missing', async () => {
    delete process.env.TIRE_CUSTODY_SMS_WEBHOOK_URL;
    const r = await sendTireCustodySmsOtp({
      to: '+40722111222',
      otp: '123456',
      url: 'https://app.example/sign/x',
      expiresAt: new Date().toISOString(),
    });
    expect(r.sent).toBe(false);
    if (!r.sent) expect(r.error).toMatch(/not configured/i);
  });

  it('sendTireCustodySmsOtp posts JSON to webhook', async () => {
    process.env.TIRE_CUSTODY_SMS_WEBHOOK_URL = 'https://sms.example/hook';
    process.env.TIRE_CUSTODY_SMS_WEBHOOK_TOKEN = 'secret';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    const r = await sendTireCustodySmsOtp({
      to: '+40 722 111 222',
      otp: '654321',
      url: 'https://app.example/sign/tok',
      expiresAt: '2026-11-07T22:00:00.000Z',
      plate: 'B-01-ABC',
      protocolId: 'prot-1',
    });
    expect(r).toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sms.example/hook');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.to).toBe('+40722111222');
    expect(body.otp).toBe('654321');
    expect(body.protocolId).toBe('prot-1');
  });
});
