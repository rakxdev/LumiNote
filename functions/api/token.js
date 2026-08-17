// Cloudflare Pages Function to generate AssemblyAI token
export async function onRequest(context) {
  // Method guard
  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const ASSEMBLYAI_API_KEY = context.env.ASSEMBLYAI_API_KEY;
  
  if (!ASSEMBLYAI_API_KEY) {
    return new Response(JSON.stringify({ 
      error: 'AssemblyAI API key not configured in environment'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }
    });
  }

  try {
    const expiresInSeconds = 600; // 10 minutes
    const url = `https://streaming.assemblyai.com/v3/token?expires_in_seconds=${expiresInSeconds}`;
    
    const tokenResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY,
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('AssemblyAI token generation failed:', tokenResponse.status, errorText);
      return new Response(JSON.stringify({ 
        error: 'Failed to generate token from AssemblyAI'
      }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        }
      });
    }

    const data = await tokenResponse.json();
    
    return new Response(JSON.stringify({ token: data.token }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });

  } catch (error) {
    console.error('AssemblyAI token generation error:', error.message);
    return new Response(JSON.stringify({ 
      error: 'AssemblyAI token service unavailable'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }
    });
  }
}
