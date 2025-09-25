#!/usr/bin/env node

/**
 * Simple Triton F5 CORS Proxy Server
 * Using Node.js built-in fetch (Node 18+)
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;
const TRITON_URL = 'http://34.16.237.235/v2/models/f5_190000/versions/1/infer';

// Enable CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization']
}));

// Parse JSON
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'TTS Cloning proxy server is running',
    nodeVersion: process.version,
    fetchAvailable: typeof fetch !== 'undefined'
  });
});

// TTS Cloning proxy endpoint
app.post('/voice-cloning', async (req, res) => {
  console.log('🎭 Proxying to TTS Cloning service...');
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(TRITON_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    
    const duration = Date.now() - startTime;
    console.log(`⏱️ Response in ${duration}ms, status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Triton error:', errorText);
      return res.status(response.status).json({
        error: `Triton error: ${response.status} - ${errorText}`
      });
    }
    
    const result = await response.json();
    console.log('✅ Success, keys:', Object.keys(result));
    
    if (result.outputs && result.outputs[0]?.data) {
      console.log('🎵 Audio data length:', result.outputs[0].data.length);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TTS Cloning proxy running on http://localhost:${PORT}`);
  console.log(`🎯 Target: ${TRITON_URL}`);
  console.log(`🌐 CORS enabled for localhost:3000`);
  console.log(`📦 Node.js: ${process.version}`);
  console.log(`🔧 Built-in fetch: ${typeof fetch !== 'undefined' ? 'Available' : 'Not available'}`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  process.exit(0);
});
