// Netlify Function: save-subscription
// Recibe { subscription, user_code } y guarda en la tabla `push_subscriptions` de Supabase.
// REQUIERE configurar variables de entorno en Netlify:
// SUPABASE_URL (p.e. https://...supabase.co)
// SUPABASE_ANON_KEY (clave anon)

const fetch = require('node-fetch');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const body = JSON.parse(event.body || '{}');
    const subscription = body.subscription;
    const user_code = body.user_code || null;
    if (!subscription) return { statusCode: 400, body: 'Missing subscription' };

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return { statusCode: 500, body: 'Supabase env vars not set' };

    const res = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify({
        id: subscription.endpoint,
        user_code: user_code,
        subscription: subscription
      })
    });

    if (!res.ok) {
      const text = await res.text();
      return { statusCode: res.status, body: text };
    }
    const json = await res.json();
    return { statusCode: 200, body: JSON.stringify(json) };
  } catch (err) {
    return { statusCode: 500, body: String(err) };
  }
};