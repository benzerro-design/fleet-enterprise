#!/usr/bin/env node
/**
 * UAT-027: partener creează programare pe WO existent (după deviz).
 * UAT-032: POST post-cost de pe partener trebuie 403.
 *
 * Usage: node scripts/smoke-uat027-reschedule.mjs
 * Needs API on PORT (default 4000) + seed demo users.
 */
const API = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const TENANT = process.env.TENANT ?? "demo";
const ADMIN = { email: "admin@demo.local", password: "demo12345" };
const PARTNER = { email: "partner@alphaservice.local", password: "demo12345" };

const results = [];
const pass = (s, d = "") => {
  results.push({ ok: true, s, d });
  console.log(`✓ ${s}${d ? ` — ${d}` : ""}`);
};
const fail = (s, d) => {
  results.push({ ok: false, s, d });
  console.log(`✗ ${s} — ${d}`);
};

async function login(creds) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tenant-id": TENANT },
    body: JSON.stringify({ ...creds, tenantSlug: TENANT }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.accessToken) {
    throw new Error(`login ${creds.email} ${res.status} ${JSON.stringify(body)}`);
  }
  return body.accessToken;
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "x-tenant-id": TENANT,
  };
}

async function json(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: headers(token),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { res, data };
}

async function main() {
  console.log(`API ${API} tenant ${TENANT}`);

  const health = await fetch(`${API}/auth/login`, { method: "OPTIONS" }).catch(() => null);
  const ping = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }).catch((e) => {
    throw new Error(`API nu răspunde pe ${API}: ${e.message}`);
  });
  if (!ping.ok && ping.status >= 500) {
    throw new Error(`API ${API} status ${ping.status}`);
  }
  void health;

  const adminToken = await login(ADMIN);
  const partnerToken = await login(PARTNER);
  pass("login admin + partner");

  const { res: woRes, data: woList } = await json(
    "GET",
    "/work-orders?page=1&pageSize=50",
    partnerToken,
  );
  if (!woRes.ok) throw new Error(`GET work-orders ${woRes.status}`);
  const items = woList.items ?? [];
  if (!items.length) throw new Error("Partenerul nu are nicio comandă WO — nu pot testa reprogramarea");
  pass("listă WO partener", `${items.length} comenzi`);

  let wo = items.find((w) => w.quoteSummary?.status === "approved") ?? null;
  let quoteId = null;

  if (!wo) {
    wo = items[0];
    pass("niciun WO cu deviz aprobat — pregătesc flux pe", wo.displayNumber ?? wo.id.slice(0, 8));

    const { data: quotes } = await json("GET", `/work-orders/${wo.id}/quotes`, partnerToken);
    const draft = Array.isArray(quotes) ? quotes.find((q) => q.status === "draft") : null;
    const submitted = Array.isArray(quotes) ? quotes.find((q) => q.status === "submitted") : null;
    let q = Array.isArray(quotes) ? quotes.find((x) => x.status === "approved") : null;

    if (!q && !submitted) {
      const eta = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const patch = await json("PATCH", `/work-orders/${wo.id}`, partnerToken, {
        estimatedRepairAt: eta,
      });
      if (!patch.res.ok) {
        throw new Error(`PATCH estimatedRepairAt ${patch.res.status} ${JSON.stringify(patch.data)}`);
      }

      let quote;
      if (draft) {
        quote = draft;
      } else {
        const created = await json("POST", `/work-orders/${wo.id}/quotes`, partnerToken, {
          currency: "RON",
          notes: "smoke UAT-027",
          lines: [
            {
              lineType: "labor",
              description: "Manoperă smoke UAT-027",
              quantity: 1,
              unitNetCents: 10000,
              vatRatePercent: 19,
            },
          ],
        });
        if (!created.res.ok) {
          throw new Error(`POST quote ${created.res.status} ${JSON.stringify(created.data)}`);
        }
        quote = created.data;
      }

      const sub = await json("POST", `/work-orders/${wo.id}/quotes/${quote.id}/submit`, partnerToken);
      if (!sub.res.ok) {
        throw new Error(`submit quote ${sub.res.status} ${JSON.stringify(sub.data)}`);
      }
      q = sub.data;
      pass("deviz trimis spre aprobare", `v${q.version}`);
    } else if (submitted) {
      q = submitted;
    }

    if (q && q.status !== "approved") {
      const appr = await json("POST", `/work-orders/${wo.id}/quotes/${q.id}/approve`, adminToken, {});
      if (!appr.res.ok) {
        throw new Error(`approve quote ${appr.res.status} ${JSON.stringify(appr.data)}`);
      }
      q = appr.data;
      pass("admin a aprobat devizul", `v${q.version}`);
    }
    quoteId = q?.id ?? null;
  } else {
    pass("WO cu deviz aprobat", wo.displayNumber ?? wo.id.slice(0, 8));
    const { data: quotes } = await json("GET", `/work-orders/${wo.id}/quotes`, partnerToken);
    quoteId = Array.isArray(quotes) ? quotes.find((q) => q.status === "approved")?.id : null;
  }

  const { res: detRes, data: detail } = await json("GET", `/work-orders/${wo.id}`, partnerToken);
  if (!detRes.ok) throw new Error(`GET WO ${detRes.status}`);
  const vehicleId = detail.vehicleId;
  const serviceCaseId = detail.serviceCaseId;
  if (!vehicleId || !serviceCaseId) throw new Error("WO fără vehicleId/serviceCaseId");

  if (detail.awaitingPostApproval) {
    const pa = await json("POST", `/service-cases/${serviceCaseId}/post-approval`, partnerToken, {
      path: "reschedule",
    });
    if (!pa.res.ok) {
      throw new Error(`post-approval reschedule ${pa.res.status} ${JSON.stringify(pa.data)}`);
    }
    pass("partener: Programează din nou (post-approval)", pa.data.postApprovalPath);
  } else {
    pass(
      "post-approval deja decis",
      `${detail.postApprovalPath ?? "none"} — testez tot create pe dosar`,
    );
  }

  const noCase = await json("POST", "/appointments", partnerToken, {
    vehicleId,
    scheduledAt: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    durationMin: 60,
    title: "smoke UAT-027 fără dosar",
  });
  if (noCase.res.status === 400) {
    pass("fără serviceCaseId → 400 (partenerul nu creează programare orfană)");
  } else {
    fail("fără serviceCaseId trebuia 400", `${noCase.res.status} ${JSON.stringify(noCase.data)}`);
  }

  const when = new Date(Date.now() + 4 * 24 * 3600 * 1000);
  when.setHours(10, 0, 0, 0);
  const created = await json("POST", "/appointments", partnerToken, {
    vehicleId,
    serviceCaseId,
    scheduledAt: when.toISOString(),
    durationMin: 60,
    title: "smoke UAT-027 reprogramare după deviz",
    createdBySupplier: true,
  });
  if (created.res.ok && created.data?.id) {
    pass(
      "partener creează programare pe WO după deviz",
      `${created.data.id.slice(0, 8)} ${created.data.scheduledAt} status=${created.data.status}`,
    );
  } else {
    fail(
      "POST /appointments pe dosar WO",
      `${created.res.status} ${JSON.stringify(created.data)}`,
    );
  }

  if (quoteId && API.includes("localhost")) {
    const cost = await json("POST", `/work-orders/${wo.id}/quotes/${quoteId}/post-cost`, partnerToken, {});
    if (cost.res.status === 403) {
      pass("UAT-032 partener post-cost → 403");
    } else {
      fail("UAT-032 post-cost partener", `${cost.res.status} ${JSON.stringify(cost.data)}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} ok`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
