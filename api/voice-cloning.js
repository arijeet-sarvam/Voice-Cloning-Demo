// Vercel serverless function to proxy TTS Cloning requests
export default async function handler(req, res) {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    console.log('🎭 Proxying TTS Cloning request to Triton server...');
    
    const tritonUrl = 'http://34.16.237.235/v2/models/f5_190000/versions/1/infer';
    
    const response = await fetch(tritonUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Triton API error:', response.status, errorText);
      res.status(response.status).json({ 
        error: `Triton API error: ${response.status} - ${errorText}` 
      });
      return;
    }

    const result = await response.json();
    console.log('✅ TTS Cloning proxy successful');
    
    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({ 
      error: `Proxy error: ${error.message}` 
    });
  }
}
