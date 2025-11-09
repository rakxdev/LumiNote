// Cloudflare Pages Function to generate AssemblyAI token
export async function onRequest(context) {
  // Handle CORS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  try {
    // TEMPORARY: Hardcoded API key for testing
    const ASSEMBLYAI_API_KEY = '2100584f7fff46e5bcacdb49232dd5b3';
    
    if (!ASSEMBLYAI_API_KEY) {
      console.error('❌ ASSEMBLYAI_API_KEY not found');
      return new Response(JSON.stringify({ 
        error: 'API key not configured'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    console.log('✅ API key loaded, calling AssemblyAI...');

    // Use the CORRECT AssemblyAI endpoint (matching tokenGenerator.js)
    const expiresInSeconds = 600; // 10 minutes
    const url = `https://streaming.assemblyai.com/v3/token?expires_in_seconds=${expiresInSeconds}`;
    
    const tokenResponse = await fetch(url, {
      method: 'GET',  // Changed to GET
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY,
      }
    });

    console.log('📡 AssemblyAI response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ AssemblyAI token generation failed:', tokenResponse.status, errorText);
      return new Response(JSON.stringify({ 
        error: 'Failed to generate token from AssemblyAI',
        status: tokenResponse.status,
        details: errorText 
      }), {
        status: tokenResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    const data = await tokenResponse.json();
    
    console.log('✅ Token generated successfully from AssemblyAI');
    
    return new Response(JSON.stringify({ token: data.token }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });

  } catch (error) {
    console.error('❌ Token generation error:', error);
    console.error('  Error message:', error.message);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate token',
      message: error.message,
      type: error.name 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}