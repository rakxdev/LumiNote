// Cloudflare Pages Function to mint temporary Deepgram grant tokens
export async function onRequest(context) {
  // Method guard
  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const DEEPGRAM_API_KEY = context.env.DEEPGRAM_API_KEY;

  if (!DEEPGRAM_API_KEY) {
    return new Response(JSON.stringify({ error: 'Deepgram API key not configured in environment' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }
    });
  }

  try {
    // Mint short-lived grant token via Deepgram Auth API (POST /v1/auth/grant)
    const response = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram grant token request failed:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to mint Deepgram session token' }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        }
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify({ token: data.access_token || data.token }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  } catch (error) {
    console.error('Deepgram token minting error:', error.message);
    return new Response(JSON.stringify({ error: 'Deepgram token service unavailable' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }
    });
  }
}
