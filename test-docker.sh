#!/bin/bash
# Script test Docker locally before deploying to server

echo "=== Testing Docker build locally ==="

# Stop any running containers
echo "1. Stopping existing containers..."
docker-compose down

# Build with no cache
echo "2. Building Docker image (this may take a few minutes)..."
docker-compose build --no-cache

# Start container
echo "3. Starting container..."
docker-compose up -d

# Wait for container to start
echo "4. Waiting 10 seconds for app to start..."
sleep 10

# Check logs
echo "5. Checking logs for errors..."
docker-compose logs app | grep -i "error\|failed\|crash" || echo "No errors found in logs"

# Check if app is responding
echo "6. Testing if app responds on port 5099..."
curl -I http://localhost:5099 2>/dev/null | head -n 1

echo ""
echo "=== Test complete ==="
echo "Check logs with: docker-compose logs -f app"
echo "Stop container with: docker-compose down"
