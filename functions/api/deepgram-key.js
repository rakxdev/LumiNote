// Cloudflare Pages Function to provide Deepgram API key securely
export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  const DEEPGRAM_API_KEY = context.env.DEEPGRAM_API_KEY || "2b2fe3bc8ae482b82b218201b9c15c40a9fcba4e";

  return new Response(JSON.stringify({ key: DEEPGRAM_API_KEY }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    }
  });
}
