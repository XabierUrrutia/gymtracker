// Netlify Function: send-push
// Env vars required:
// SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_MAILTO

const fetch = require('node-fetch');
const webpush = require('web-push');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const body = JSON.parse(event.body || '{}');
    const message = body.message || { title: 'GymTracker', body: 'Tienes un recordatorio' };
    const user_code = body.user_code || null;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return { statusCode: 500, body: 'Supabase env vars not set' };

    const query = user_code ? `?user_code=eq.${encodeURIComponent(user_code)}` : '';
    const res = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions${query}`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    if (!res.ok) return { statusCode: res.status, body: await res.text() };
    const subs = await res.json();

    const vapidPublic = process.env.VAPID_PUBLIC;
    const vapidPrivate = process.env.VAPID_PRIVATE;
    const vapidMail = process.env.VAPID_MAILTO || 'no-reply@example.com';
    if (!vapidPublic || !vapidPrivate) return { statusCode: 500, body: 'VAPID keys not configured' };

    webpush.setVapidDetails(`mailto:${vapidMail}`, vapidPublic, vapidPrivate);

    const results = [];
    for (const r of subs) {
      try {
        await webpush.sendNotification(r.subscription, JSON.stringify(message));
        results.push({ id: r.id, status: 'ok' });
      } catch (e) {
        results.push({ id: r.id, status: 'error', error: String(e) });
      }
    }

    return { statusCode: 200, body: JSON.stringify(results) };
  } catch (err) {
    return { statusCode: 500, body: String(err) };
  }
};