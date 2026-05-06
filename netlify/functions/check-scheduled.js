// Netlify Scheduled Function: check-scheduled
// Runs every 15 minutes (configured in netlify.toml).
// Queries notification_schedules for due notifications and sends them via Web Push.
// Env vars required: SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_MAILTO

const fetch = require('node-fetch');
const webpush = require('web-push');

exports.handler = async function() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC;
  const vapidPrivate = process.env.VAPID_PRIVATE;
  const vapidMail = process.env.VAPID_MAILTO || 'no-reply@example.com';

  if (!supabaseUrl || !supabaseKey || !vapidPublic || !vapidPrivate) {
    return { statusCode: 500, body: 'Missing env vars' };
  }

  webpush.setVapidDetails(`mailto:${vapidMail}`, vapidPublic, vapidPrivate);

  const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

  // Find unsent notifications due in the past 2 hours (catch-up window for missed runs)
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const notifsRes = await fetch(
    `${supabaseUrl}/rest/v1/notification_schedules` +
    `?notify_at=lte.${now.toISOString()}` +
    `&notify_at=gte.${twoHoursAgo.toISOString()}` +
    `&sent=eq.false` +
    `&select=*`,
    { headers }
  );

  if (!notifsRes.ok) {
    return { statusCode: notifsRes.status, body: await notifsRes.text() };
  }

  const notifications = await notifsRes.ok ? await notifsRes.json() : [];
  if (notifications.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ processed: 0 }) };
  }

  const results = [];

  for (const notif of notifications) {
    // Get push subscriptions for this user
    const subRes = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?user_code=eq.${encodeURIComponent(notif.user_code)}&select=*`,
      { headers }
    );

    if (!subRes.ok) {
      results.push({ id: notif.id, status: 'error', reason: 'subscriptions fetch failed' });
      continue;
    }

    const subs = await subRes.json();
    let sentCount = 0;

    for (const s of subs) {
      try {
        await webpush.sendNotification(
          s.subscription,
          JSON.stringify({ title: notif.message_title, body: notif.message_body })
        );
        sentCount++;
      } catch (e) {
        // Subscription expired or invalid — remove it
        if (e.statusCode === 410 || e.statusCode === 404) {
          await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${encodeURIComponent(s.id)}`, {
            method: 'DELETE',
            headers
          });
        }
        results.push({ id: notif.id, sub: s.id, status: 'push_error', error: String(e.message) });
      }
    }

    // Mark as sent regardless (avoids retrying broken subscriptions endlessly)
    await fetch(`${supabaseUrl}/rest/v1/notification_schedules?id=eq.${notif.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sent: true })
    });

    results.push({ id: notif.id, status: sentCount > 0 ? 'ok' : 'no_active_subs', sent: sentCount });
  }

  return { statusCode: 200, body: JSON.stringify({ processed: notifications.length, results }) };
};
