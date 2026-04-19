// Supabase Edge Function: birthday-sender
// Schedules can call this function frequently; it enforces its own interval via DB settings.

type BirthdayRow = {
  name: string;
  class: string;
  reg_number: string;
  age: number | null;
  parent_email: string | null;
  parent_email_alt: string | null;
};

type PortalResponse = {
  success: boolean;
  date: string;
  count: number;
  birthdays: BirthdayRow[];
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};

function env(key: string, fallback = ""): string {
  return Deno.env.get(key) ?? fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

function minutesBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 60000);
}

async function supabaseRpc(
  supabaseUrl: string,
  serviceRoleKey: string,
  fnName: string,
  payload: Record<string, unknown>,
) {
  const url = `${supabaseUrl}/rest/v1/rpc/${fnName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...jsonHeaders,
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase RPC failed (${res.status}): ${text}`);
  }
  return await res.json();
}

async function supabaseInsert(
  supabaseUrl: string,
  serviceRoleKey: string,
  table: string,
  row: Record<string, unknown>,
) {
  const url = `${supabaseUrl}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...jsonHeaders,
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase insert failed (${res.status}): ${text}`);
  }
  return await res.json();
}

async function supabaseUpsertIgnoreDuplicates(
  supabaseUrl: string,
  serviceRoleKey: string,
  table: string,
  row: Record<string, unknown>,
  onConflict: string,
) {
  const url = `${supabaseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...jsonHeaders,
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase upsert failed (${res.status}): ${text}`);
  }
  return await res.json();
}

async function supabaseUpdate(
  supabaseUrl: string,
  serviceRoleKey: string,
  table: string,
  match: Record<string, string>,
  updates: Record<string, unknown>,
) {
  const query = new URLSearchParams(match).toString();
  const url = `${supabaseUrl}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      ...jsonHeaders,
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      prefer: "return=representation",
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase update failed (${res.status}): ${text}`);
  }
  return await res.json();
}

async function supabaseSelect(
  supabaseUrl: string,
  serviceRoleKey: string,
  tableWithQuery: string,
) {
  const url = `${supabaseUrl}/rest/v1/${tableWithQuery}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase select failed (${res.status}): ${text}`);
  }
  return await res.json();
}

async function fetchPortalBirthdays(apiUrl: string, token: string): Promise<PortalResponse> {
  const res = await fetch(apiUrl, {
    headers: {
      accept: "application/json",
      "x-portal-token": token,
    },
  });

  const contentType = res.headers.get("content-type") ?? "";
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Portal API failed (${res.status}): ${bodyText}`);
  }
  if (!contentType.includes("application/json")) {
    throw new Error(`Portal API did not return JSON: ${bodyText.slice(0, 180)}`);
  }

  const parsed = JSON.parse(bodyText) as PortalResponse;
  if (!parsed?.success) {
    throw new Error("Portal API returned success=false.");
  }
  return parsed;
}

function buildEmailHtml(studentName: string): string {
  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5">
      <p>Dear Parent/Guardian,</p>
      <p>We are happy to celebrate <strong>${studentName}</strong> today.</p>
      <p>Happy Birthday from all of us at Sure Foundation Group of Schools!</p>
      <p style="margin-top:18px;color:#6b7280;font-size:12px">This is an automated message.</p>
    </div>
  `.trim();
}

async function sendBrevoEmail(
  apiKey: string,
  senderEmail: string,
  senderName: string,
  toEmail: string,
  subject: string,
  htmlContent: string,
) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      ...jsonHeaders,
      accept: "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: toEmail }],
      subject,
      htmlContent,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Brevo send failed (${res.status}): ${text}`);
  }
  return JSON.parse(text);
}

function dedupeEmails(row: BirthdayRow): string[] {
  const emails = [row.parent_email, row.parent_email_alt]
    .map((e) => (e ?? "").trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(emails));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...jsonHeaders,
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const supabaseUrl = env("SUPABASE_URL");
    const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const portalApiUrl = env("PORTAL_BIRTHDAYS_API_URL");
    const portalToken = env("PORTAL_BIRTHDAYS_API_TOKEN");
    const brevoKey = env("BREVO_API_KEY");
    const senderEmail = env("BREVO_SENDER_EMAIL");
    const senderName = env("BREVO_SENDER_NAME", "SFGS");

    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase env vars.");
    if (!portalApiUrl || !portalToken) throw new Error("Missing portal API env vars.");
    if (!brevoKey || !senderEmail) throw new Error("Missing Brevo env vars.");

    // Load settings (single row id=1)
    const settingsRows = await supabaseSelect(
      supabaseUrl,
      serviceRoleKey,
      "birthday_settings?select=*&id=eq.1&limit=1",
    ) as Array<Record<string, unknown>>;
    const settings = settingsRows?.[0] ?? {};
    const enabled = Boolean(settings["enabled"] ?? true);
    const intervalMinutes = Number(settings["interval_minutes"] ?? 60);
    const lastRunAt = typeof settings["last_run_at"] === "string" ? settings["last_run_at"] as string : "";

    if (!enabled) {
      return new Response(JSON.stringify({ success: true, skipped: "disabled" }), { headers: jsonHeaders });
    }

    if (lastRunAt) {
      const delta = minutesBetween(new Date(), new Date(lastRunAt));
      if (!Number.isNaN(delta) && delta >= 0 && delta < Math.max(1, intervalMinutes)) {
        return new Response(JSON.stringify({ success: true, skipped: "interval", delta_minutes: delta }), {
          headers: jsonHeaders,
        });
      }
    }

    const portalData = await fetchPortalBirthdays(portalApiUrl, portalToken);

    // Log run start
    const run = (await supabaseInsert(supabaseUrl, serviceRoleKey, "birthday_runs", {
      ran_at: nowIso(),
      date: portalData.date,
      birthday_count: portalData.count,
      status: "running",
    }))[0] as Record<string, unknown> | undefined;
    const runId = Number(run?.id ?? 0);

    let sent = 0;
    let failed = 0;
    for (const birthday of portalData.birthdays || []) {
      const recipients = dedupeEmails(birthday);
      if (recipients.length === 0) continue;

      for (const email of recipients) {
        const subject = `Happy Birthday ${birthday.name}!`;
        try {
          // Reserve first (prevents double-send across concurrent runs).
          // Dedupe by unique constraint: (date, reg_number, recipient_email)
          const pendingRows = await supabaseUpsertIgnoreDuplicates(
            supabaseUrl,
            serviceRoleKey,
            "birthday_email_logs",
            {
              run_id: runId || null,
              date: portalData.date,
              reg_number: birthday.reg_number,
              student_name: birthday.name,
              recipient_email: email,
              status: "pending",
              provider_message_id: null,
              error: null,
              created_at: nowIso(),
            },
            "date,reg_number,recipient_email",
          );

          const pending = pendingRows?.[0];
          const logId = Number(pending?.id ?? 0);
          if (!logId) {
            // Already reserved/sent earlier today.
            continue;
          }

          const brevo = await sendBrevoEmail(
            brevoKey,
            senderEmail,
            senderName,
            email,
            subject,
            buildEmailHtml(birthday.name),
          );

          await supabaseUpdate(
            supabaseUrl,
            serviceRoleKey,
            "birthday_email_logs",
            { id: `eq.${logId}` },
            {
              run_id: runId || null,
              status: "sent",
              provider_message_id: brevo?.messageId ?? null,
              error: null,
            },
          );
          sent++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          try {
            // If the reservation insert failed due to duplicates we would have skipped,
            // but for other failures, try to write a standalone failed record.
            await supabaseUpsertIgnoreDuplicates(
              supabaseUrl,
              serviceRoleKey,
              "birthday_email_logs",
              {
                run_id: runId || null,
                date: portalData.date,
                reg_number: birthday.reg_number,
                student_name: birthday.name,
                recipient_email: email,
                status: "failed",
                provider_message_id: null,
                error: message,
                created_at: nowIso(),
              },
              "date,reg_number,recipient_email",
            );
          } catch {
            // ignore logging failures
          }
          failed++;
        }
      }
    }

    if (runId) {
      await supabaseUpdate(supabaseUrl, serviceRoleKey, "birthday_runs", { id: `eq.${runId}` }, {
        status: "completed",
        sent_count: sent,
        failed_count: failed,
        completed_at: nowIso(),
      });
    }

    await supabaseUpdate(supabaseUrl, serviceRoleKey, "birthday_settings", { id: "eq.1" }, {
      last_run_at: nowIso(),
      last_run_sent: sent,
      last_run_failed: failed,
    });

    return new Response(JSON.stringify({ success: true, date: portalData.date, sent, failed }), {
      headers: jsonHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: jsonHeaders,
      status: 500,
    });
  }
});
