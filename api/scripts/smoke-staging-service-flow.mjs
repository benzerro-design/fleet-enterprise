#!/usr/bin/env node
/**
 * Smoke staging: infrastructură + API programări + (opțional) flux service cap-coadă.
 *
 * Usage:
 *   node scripts/smoke-staging-service-flow.mjs
 *   node scripts/smoke-staging-service-flow.mjs --write
 *
 * Env:
 *   API_URL   default https://fleet-api-cxsqhb2qmq-ew.a.run.app
 *   WEB_URL   default https://fleet-web-stg-1096713529891.europe-west1.run.app
 *   TENANT    default demo
 */

const API_URL = (process.env.API_URL ?? 'https://fleet-api-cxsqhb2qmq-ew.a.run.app').replace(/\/$/, '');
const WEB_URL = (process.env.WEB_URL ?? 'https://fleet-web-stg-1096713529891.europe-west1.run.app').replace(/\/$/, '');
const TENANT = process.env.TENANT ?? 'demo';
const WRITE = process.argv.includes('--write');

const ADMIN = { email: 'admin@demo.local', password: 'demo12345' };
const MANAGER = { email: 'manager.alpha@demo.local', password: 'demo12345' };

const results = [];

function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}

function pass(step, detail = '') {
  results.push({ step, ok: true, detail });
  log('✓', detail ? `${step} — ${detail}` : step);
}

function fail(step, detail) {
  results.push({ step, ok: false, detail });
  log('✗', `${step} — ${detail}`);
}

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json', 'X-Tenant-Id': TENANT };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 200) };
    }
  }
  return { res, json };
}

async function login(creds) {
  const { res, json } = await api('/auth/login', {
    method: 'POST',
    body: { email: creds.email, password: creds.password, tenantSlug: TENANT },
  });
  if (!res.ok || !json?.accessToken) {
    throw new Error(`login ${creds.email}: HTTP ${res.status} ${JSON.stringify(json)}`);
  }
  return json.accessToken;
}

function weekRangeIso() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setHours(0, 0, 0, 0);
  mon.setDate(mon.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 7);
  return { from: mon.toISOString(), to: sun.toISOString() };
}

async function smokeReadOnly() {
  log('•', `API ${API_URL} · tenant ${TENANT}`);

  const health = await fetch(`${API_URL}/health`);
  if (health.ok) {
    const h = await health.json();
    pass('GET /health', h.status ?? 'ok');
  } else {
    fail('GET /health', `HTTP ${health.status}`);
  }

  const webScheduler = await fetch(`${WEB_URL}/fleet/scheduler`, { redirect: 'manual' });
  const webStatus = webScheduler.status;
  if (webStatus === 307 || webStatus === 302 || webStatus === 200) {
    pass('WEB /fleet/scheduler', `HTTP ${webStatus} (ruta există)`);
  } else if (webStatus === 404) {
    fail('WEB /fleet/scheduler', '404 — verifică deploy web');
  } else {
    pass('WEB /fleet/scheduler', `HTTP ${webStatus}`);
  }

  let adminToken;
  try {
    adminToken = await login(ADMIN);
    pass('Login admin', ADMIN.email);
  } catch (e) {
    fail('Login admin', String(e));
    return null;
  }

  const me = await api('/auth/me', { token: adminToken });
  if (me.res.ok && me.json?.role === 'tenant_admin') {
    pass('GET /auth/me', me.json.role);
  } else {
    fail('GET /auth/me', `HTTP ${me.res.status}`);
  }

  const stats = await api('/appointments/stats', { token: adminToken });
  if (stats.res.ok) {
    pass('GET /appointments/stats', JSON.stringify(stats.json));
  } else {
    fail('GET /appointments/stats', `HTTP ${stats.res.status} ${JSON.stringify(stats.json)}`);
  }

  const range = weekRangeIso();
  const cal = await api(
    `/appointments/calendar?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
    { token: adminToken },
  );
  if (cal.res.ok && Array.isArray(cal.json)) {
    pass('GET /appointments/calendar', `${cal.json.length} programări`);
  } else {
    fail('GET /appointments/calendar', `HTTP ${cal.res.status} ${JSON.stringify(cal.json)}`);
  }

  const suppliers = await api('/suppliers?status=active&pageSize=5', { token: adminToken });
  if (suppliers.res.ok && suppliers.json?.items) {
    pass('GET /suppliers', `${suppliers.json.items.length} furnizori`);
  } else {
    fail('GET /suppliers', `HTTP ${suppliers.res.status}`);
  }

  try {
    const managerToken = await login(MANAGER);
    pass('Login manager client', MANAGER.email);

    const mStats = await api('/appointments/stats', { token: managerToken });
    if (mStats.res.ok) {
      pass('Manager GET /appointments/stats', JSON.stringify(mStats.json));
    } else {
      fail('Manager GET /appointments/stats', `HTTP ${mStats.res.status}`);
    }

    const mCal = await api(
      `/appointments/calendar?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      { token: managerToken },
    );
    if (mCal.res.ok && Array.isArray(mCal.json)) {
      const codes = [...new Set(mCal.json.map((a) => a.clientCode))];
      pass('Manager calendar scope', `${mCal.json.length} appt · clienți: ${codes.join(', ') || '—'}`);
      if (codes.length > 1) {
        fail('Manager calendar scope', 'ar trebui un singur client (Alpha)');
      }
    } else {
      fail('Manager GET /appointments/calendar', `HTTP ${mCal.res.status}`);
    }

    const mSup = await api('/suppliers?status=active&pageSize=3', { token: managerToken });
    if (mSup.res.ok) {
      pass('Manager GET /suppliers', `${mSup.json?.items?.length ?? 0} furnizori`);
    } else {
      fail('Manager GET /suppliers', `HTTP ${mSup.res.status}`);
    }
  } catch (e) {
    fail('Manager client smoke', String(e));
  }

  return adminToken;
}

async function smokeWriteFlow(adminToken) {
  log('•', 'Flux service cap-coadă (--write) pe tenant demo');

  const vehicles = await api('/fleet/vehicles?page=1&pageSize=5', { token: adminToken });
  const vehicle = vehicles.json?.items?.[0];
  if (!vehicle?.id) {
    fail('Pregătire vehicul', 'lipsă vehicule în demo');
    return;
  }
  pass('Vehicul test', vehicle.registrationNumber);

  const suppliers = await api('/suppliers?status=active&pageSize=1', { token: adminToken });
  const supplier = suppliers.json?.items?.[0];
  if (!supplier?.id) {
    fail('Pregătire furnizor', 'adaugă un furnizor activ în demo');
    return;
  }
  pass('Furnizor test', supplier.code);

  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const ticketRes = await api('/tickets', {
    method: 'POST',
    token: adminToken,
    body: {
      clientId: vehicle.clientId,
      vehicleId: vehicle.id,
      subject: `Smoke service ${stamp}`,
      description: 'Flux automat smoke-staging-service-flow.mjs',
      ticketType: 'maintenance',
      priority: 'normal',
    },
  });
  if (!ticketRes.res.ok || !ticketRes.json?.id) {
    fail('POST /tickets', `HTTP ${ticketRes.res.status} ${JSON.stringify(ticketRes.json)}`);
    return;
  }
  const ticketId = ticketRes.json.id;
  pass('Tichet creat', ticketId);

  const caseRes = await api(`/service-cases/from-ticket/${ticketId}`, {
    method: 'POST',
    token: adminToken,
    body: {},
  });
  if (!caseRes.res.ok || !caseRes.json?.id) {
    fail('POST service-cases/from-ticket', `HTTP ${caseRes.res.status}`);
    return;
  }
  const caseId = caseRes.json.id;
  pass('Dosar lucrare', `${caseId} · ${caseRes.json.currentStage}`);

  const sched = new Date();
  sched.setDate(sched.getDate() + 2);
  sched.setHours(10, 0, 0, 0);
  const apptRes = await api('/appointments', {
    method: 'POST',
    token: adminToken,
    body: {
      vehicleId: vehicle.id,
      supplierId: supplier.id,
      title: `Smoke ITP ${stamp}`,
      scheduledAt: sched.toISOString(),
      durationMin: 60,
      sourceTicketId: ticketId,
    },
  });
  if (!apptRes.res.ok) {
    fail('POST /appointments', `HTTP ${apptRes.res.status} ${JSON.stringify(apptRes.json)}`);
    return;
  }
  pass('Programare', apptRes.json.id);

  const advWo = await api(`/service-cases/${caseId}/advance`, {
    method: 'POST',
    token: adminToken,
    body: { targetStage: 'work_order', supplierId: supplier.id },
  });
  if (!advWo.res.ok) {
    fail('Advance → work_order', `HTTP ${advWo.res.status} ${JSON.stringify(advWo.json)}`);
    return;
  }
  const woId = advWo.json.workOrders?.[0]?.id;
  if (!woId) {
    fail('Work order', 'lipsă după advance');
    return;
  }
  pass('Comandă lucru', woId);

  const quoteRes = await api(`/work-orders/${woId}/quotes`, {
    method: 'POST',
    token: adminToken,
    body: {
      notes: 'Smoke deviz',
      lines: [{ description: 'Manoperă smoke', quantity: 1, unitNetCents: 10000, vatRatePercent: 19 }],
    },
  });
  if (!quoteRes.res.ok || !quoteRes.json?.id) {
    fail('POST quote', `HTTP ${quoteRes.res.status} ${JSON.stringify(quoteRes.json)}`);
    return;
  }
  const quoteId = quoteRes.json.id;
  pass('Deviz draft', quoteId);

  for (const step of ['submit', 'approve']) {
    const r = await api(`/work-orders/${woId}/quotes/${quoteId}/${step}`, {
      method: 'POST',
      token: adminToken,
      body: {},
    });
    if (!r.res.ok) {
      fail(`Quote ${step}`, `HTTP ${r.res.status} ${JSON.stringify(r.json)}`);
      return;
    }
  }
  pass('Deviz aprobat', quoteId);

  const postAppr = await api(`/service-cases/${caseId}/post-approval`, {
    method: 'POST',
    token: adminToken,
    body: { path: 'immediate' },
  });
  if (!postAppr.res.ok) {
    fail('post-approval immediate', `HTTP ${postAppr.res.status} ${JSON.stringify(postAppr.json)}`);
    return;
  }
  pass('Post-aprobare execută acum', postAppr.json.currentStage ?? 'ok');

  const invRes = await api(`/work-orders/${woId}/quotes/${quoteId}/record-invoice`, {
    method: 'POST',
    token: adminToken,
    body: {
      invoiceNumber: `SMK-${Date.now()}`,
      invoiceDate: new Date().toISOString().slice(0, 10),
    },
  });
  if (!invRes.res.ok) {
    fail('record-invoice', `HTTP ${invRes.res.status} ${JSON.stringify(invRes.json)}`);
    return;
  }
  pass('Factură înregistrată', invRes.json.costInvoiceNumber ?? 'ok');

  const costRes = await api(`/work-orders/${woId}/quotes/${quoteId}/post-cost`, {
    method: 'POST',
    token: adminToken,
    body: {},
  });
  if (!costRes.res.ok) {
    fail('post-cost', `HTTP ${costRes.res.status} ${JSON.stringify(costRes.json)}`);
    return;
  }
  pass('Cost din deviz', costRes.json.costEntryId ?? 'ok');

  const doneRes = await api(`/work-orders/${woId}/complete`, {
    method: 'POST',
    token: adminToken,
    body: {},
  });
  if (!doneRes.res.ok) {
    fail('complete WO', `HTTP ${doneRes.res.status} ${JSON.stringify(doneRes.json)}`);
    return;
  }
  pass('WO finalizat', doneRes.json.status ?? 'done');

  const caseCheck = await api(`/service-cases/by-ticket/${ticketId}`, { token: adminToken });
  if (caseCheck.res.ok && caseCheck.json?.currentStage === 'closed') {
    pass('Dosar închis', caseCheck.json.currentStage);
  } else {
    pass('Dosar final', caseCheck.json?.currentStage ?? '—');
  }

  log('→', `Tichet: /fleet/tickets/${ticketId}`);
  log('→', `WO: /fleet/work-orders/${woId}`);
}

async function main() {
  console.log('\n=== Smoke staging — service flow ===\n');
  const adminToken = await smokeReadOnly();
  if (WRITE && adminToken) {
    console.log('');
    await smokeWriteFlow(adminToken);
  } else if (WRITE) {
    fail('--write', 'login admin eșuat');
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n---');
  console.log(`Rezultat: ${results.length - failed.length}/${results.length} OK`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
