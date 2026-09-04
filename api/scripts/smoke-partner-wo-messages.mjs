#!/usr/bin/env node
/**
 * Smoke: admin ↔ partner pe WO (mesaje + service-times + settings).
 * Usage: node scripts/smoke-partner-wo-messages.mjs
 */
const API = (process.env.API_URL ?? 'https://fleet-api-1096713529891.europe-west1.run.app').replace(/\/$/, '');
const WEB = (process.env.WEB_URL ?? 'https://fleet-web-stg-1096713529891.europe-west1.run.app').replace(/\/$/, '');
const TENANT = process.env.TENANT ?? 'demo';

const ADMIN = { email: 'admin@demo.local', password: 'demo12345' };
const PARTNER = { email: 'partner@alphaservice.local', password: 'demo12345' };

const results = [];
const pass = (s, d = '') => {
  results.push({ ok: true, s, d });
  console.log(`✓ ${s}${d ? ` — ${d}` : ''}`);
};
const fail = (s, d) => {
  results.push({ ok: false, s, d });
  console.log(`✗ ${s} — ${d}`);
};

async function api(path, { method = 'GET', token, body, tenant = TENANT } = {}) {
  const headers = { Accept: 'application/json', 'X-Tenant-Id': tenant };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { res, json };
}

async function login(creds) {
  const { res, json } = await api('/auth/login', {
    method: 'POST',
    body: { email: creds.email, password: creds.password, tenantSlug: TENANT },
  });
  if (!res.ok || !json?.accessToken) throw new Error(`${creds.email}: ${res.status} ${JSON.stringify(json)}`);
  return json.accessToken;
}

async function main() {
  console.log(`\n=== Smoke partner WO · ${API} · ${TENANT} ===\n`);

  let adminTok;
  let partnerTok;
  try {
    adminTok = await login(ADMIN);
    pass('Login admin');
  } catch (e) {
    fail('Login admin', String(e));
    return summary();
  }
  try {
    partnerTok = await login(PARTNER);
    pass('Login partner');
  } catch (e) {
    fail('Login partner', String(e));
    return summary();
  }

  const settings = await api('/tenant/work-order-settings', { token: adminTok });
  if (settings.res.ok) {
    pass('WO settings', JSON.stringify(settings.json));
  } else {
    fail('WO settings', `${settings.res.status} ${JSON.stringify(settings.json)}`);
  }

  const partnerSettings = await api('/tenant/work-order-settings', { token: partnerTok });
  if (partnerSettings.res.ok) {
    pass('Partner reads WO settings');
  } else {
    fail('Partner reads WO settings', `${partnerSettings.res.status}`);
  }

  // Find a WO assigned to partner's supplier
  const partnerWos = await api('/work-orders?pageSize=20', { token: partnerTok });
  if (!partnerWos.res.ok || !partnerWos.json?.items?.length) {
    fail('Partner WO list', `${partnerWos.res.status} / empty — need WO assigned to Alpha Service`);
  }

  let wo = partnerWos.json?.items?.[0];
  if (!wo) {
    fail('No partner WO', 'skip message/in-out tests');
    return summary();
  }
  pass('Partner WO', `${wo.displayNumber ?? wo.id} · ${wo.registrationNumber}`);

  const stamp = Date.now();
  const visibleBody = `Smoke vizibil partener ${stamp}`;
  const internalBody = `Smoke intern doar flotă ${stamp}`;

  // Admin posts as client_visible (new default behavior)
  const visMsg = await api(`/work-orders/${wo.id}/messages`, {
    method: 'POST',
    token: adminTok,
    body: { body: visibleBody, visibility: 'client_visible' },
  });
  if (visMsg.res.ok) pass('Admin → client_visible message');
  else fail('Admin → client_visible', `${visMsg.res.status} ${JSON.stringify(visMsg.json)}`);

  const intMsg = await api(`/work-orders/${wo.id}/messages`, {
    method: 'POST',
    token: adminTok,
    body: { body: internalBody, visibility: 'internal' },
  });
  if (intMsg.res.ok) pass('Admin → internal message');
  else fail('Admin → internal', `${intMsg.res.status}`);

  const partnerList = await api(`/work-orders/${wo.id}/messages`, { token: partnerTok });
  if (!partnerList.res.ok) {
    fail('Partner list messages', `${partnerList.res.status}`);
  } else {
    const bodies = (partnerList.json ?? []).map((m) => m.body);
    if (bodies.includes(visibleBody)) pass('Partner SEES admin client_visible');
    else fail('Partner SEES admin client_visible', 'missing from list');
    if (!bodies.includes(internalBody)) pass('Partner does NOT see internal');
    else fail('Partner does NOT see internal', 'internal leaked to partner');
  }

  const adminList = await api(`/work-orders/${wo.id}/messages`, { token: adminTok });
  if (adminList.res.ok) {
    const bodies = (adminList.json ?? []).map((m) => m.body);
    if (bodies.includes(visibleBody) && bodies.includes(internalBody)) {
      pass('Admin sees both message types');
    } else {
      fail('Admin sees both', 'missing one');
    }
  }

  const partnerReply = `Smoke reply partener ${stamp}`;
  const pPost = await api(`/work-orders/${wo.id}/messages`, {
    method: 'POST',
    token: partnerTok,
    body: { body: partnerReply, visibility: 'client_visible' },
  });
  if (pPost.res.ok) pass('Partner posts message');
  else fail('Partner posts', `${pPost.res.status} ${JSON.stringify(pPost.json)}`);

  const adminAfter = await api(`/work-orders/${wo.id}/messages`, { token: adminTok });
  if (adminAfter.res.ok && (adminAfter.json ?? []).some((m) => m.body === partnerReply)) {
    pass('Admin sees partner reply');
  } else {
    fail('Admin sees partner reply', 'missing');
  }

  // In/Out service if not already done
  const detail = await api(`/work-orders/${wo.id}`, { token: partnerTok });
  if (!detail.res.ok) {
    fail('Partner GET WO', `${detail.res.status}`);
  } else {
    const d = detail.json;
    const fleetBefore = d.vehicle?.odometerKm ?? 0;
    pass('WO detail', `in=${d.inServiceAt ? 'yes' : 'no'} out=${d.outServiceAt ? 'yes' : 'no'} fleetKm=${fleetBefore}`);

    if (!d.inServiceAt) {
      const kmIn = fleetBefore + 7;
      const markIn = await api(`/work-orders/${wo.id}/service-times`, {
        method: 'PATCH',
        token: partnerTok,
        body: { inServiceAt: new Date().toISOString(), odometerKmIn: kmIn },
      });
      if (markIn.res.ok) {
        const upd = markIn.json?.fleetOdometerUpdate;
        if (upd?.updated && upd.newKm === kmIn) {
          pass('Partner In service + fleet odometer', `${upd.previousKm} → ${upd.newKm}`);
        } else if (markIn.res.ok) {
          pass('Partner In service', `fleetOdometerUpdate=${JSON.stringify(upd)}`);
        }
      } else {
        fail('Partner In service', `${markIn.res.status} ${JSON.stringify(markIn.json)}`);
      }
    } else {
      pass('Partner In service', 'already set — skip');
    }
  }

  // Web proxy login
  try {
    const wr = await fetch(`${WEB}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: PARTNER.email, password: PARTNER.password, tenantSlug: TENANT }),
    });
    const wt = await wr.text();
    if (wr.ok && wt.includes('"ok"')) pass('WEB partner login proxy');
    else fail('WEB partner login proxy', `${wr.status} ${wt.slice(0, 120)}`);
  } catch (e) {
    fail('WEB partner login proxy', String(e));
  }

  summary();
}

function summary() {
  const ok = results.filter((r) => r.ok).length;
  const n = results.length;
  console.log(`\n---\nRezultat: ${ok}/${n} OK`);
  if (ok < n) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
