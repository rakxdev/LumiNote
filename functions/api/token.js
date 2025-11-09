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
    // Try multiple ways to access environment variables
    const ASSEMBLYAI_API_KEY = context.env?.ASSEMBLYAI_API_KEY ||
                                context.env?.assemblyai_api_key;
    
    console.log('🔍 Debugging environment access:');
    console.log('  context.env exists:', !!context.env);
    console.log('  API key found:', !!ASSEMBLYAI_API_KEY);
    console.log('  API key length:', ASSEMBLYAI_API_KEY?.length || 0);
    
    if (!ASSEMBLYAI_API_KEY) {
      console.error('❌ ASSEMBLYAI_API_KEY not found in environment');
      console.error('  Available env keys:', Object.keys(context.env || {}));
      return new Response(JSON.stringify({ 
        error: 'API key not configured',
        debug: {
          hasEnv: !!context.env,
          envKeys: Object.keys(context.env || {})
        }
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    console.log('✅ API key loaded, calling AssemblyAI...');

    // Use AssemblyAI's official token endpoint
    const tokenResponse = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_in: 600 // 10 minutes
      })
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
    console.error('  Error stack:', error.stack);
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