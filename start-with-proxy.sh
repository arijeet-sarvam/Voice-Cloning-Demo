#!/bin/bash

# Startup script for Voice Translation Demo with Triton F5 proxy
echo "🚀 Starting Voice Translation Demo with Triton F5 Proxy"
echo "======================================================="

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    if [ ! -z "$PROXY_PID" ]; then
        kill $PROXY_PID 2>/dev/null
        echo "✅ Proxy server stopped"
    fi
    if [ ! -z "$REACT_PID" ]; then
        kill $REACT_PID 2>/dev/null
        echo "✅ React app stopped"
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start Triton CORS proxy server
echo "🎭 Starting Triton CORS proxy server on port 3001..."
node triton-proxy-server.js &
PROXY_PID=$!

# Wait a moment for proxy to start
sleep 2

# Check if proxy is running
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Proxy server is running"
else
    echo "❌ Failed to start proxy server"
    exit 1
fi

# Start React development server
echo "⚛️  Starting React development server on port 3000..."
npm start &
REACT_PID=$!

echo ""
echo "🌐 Servers are starting up..."
echo "📍 React App: http://localhost:3000"
echo "🎭 Triton Proxy: http://localhost:3001"
echo "🧪 Test Page: http://localhost:3000/test_triton_integration.html"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait
