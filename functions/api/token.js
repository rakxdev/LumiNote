// Cloudflare Workers function to generate AssemblyAI token
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
    const ASSEMBLYAI_API_KEY = context.env.ASSEMBLYAI_API_KEY;
    
    if (!ASSEMBLYAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // Create token using AssemblyAI API key
    const token = await generateToken(ASSEMBLYAI_API_KEY);

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });

  } catch (error) {
    console.error('Token generation error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate token' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}

// Generate JWT token for AssemblyAI
async function generateToken(apiKey) {
  // JWT header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  // JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    api_key: apiKey,
    iat: now,
    exp: now + 600 // 10 minutes expiry
  };

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Create signature
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = await createSignature(data, apiKey);

  // Return complete JWT
  return `${data}.${signature}`;
}

// Base64 URL encode
function base64UrlEncode(str) {
  const base64 = btoa(str);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Create HMAC-SHA256 signature
async function createSignature(data, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    messageData
  );

  // Convert signature to base64url
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureStr = String.fromCharCode.apply(null, signatureArray);
  return base64UrlEncode(signatureStr);
}