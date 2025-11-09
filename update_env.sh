#!/bin/bash
# Script to update .env with Discord webhooks on server

ENV_FILE=".env"

# Check if Discord webhooks already exist
if grep -q "DISCORD_ALERT_WEBHOOK" "$ENV_FILE"; then
    echo "Discord webhooks already configured in .env"
else
    echo "" >> "$ENV_FILE"
    echo "# Discord Webhooks" >> "$ENV_FILE"
    echo "DISCORD_ALERT_WEBHOOK=https://discord.com/api/webhooks/1437108780557926512/bUfh1s3AkswY2UoWtTPxxSDr-raFH9XfGmUS65dsXr6pNacUwypfxtRqMpeo9E-m6HUJ" >> "$ENV_FILE"
    echo "DISCORD_LOG_WEBHOOK=https://discord.com/api/webhooks/1437109393543139449/6Xp0ao9i0vLKEEMAwG04FBk9ncEI7QLJ7-7EvxsSj_AjGv8GzUIF9HQiVgZDsA3ivJ2v" >> "$ENV_FILE"
    echo "✅ Discord webhooks added to .env"
fi

echo "📋 Current .env contents:"
cat "$ENV_FILE"
