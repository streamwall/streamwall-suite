#!/usr/bin/env bash
# Seed demo data for development

set -e

echo "🌱 Seeding demo data..."

# Create demo streams via API
create_stream() {
    local url=$1
    local title=$2
    local streamer=$3
    local city=$4
    local state=$5
    local platform=$6
    local is_live=$7
    
    curl -s -X POST http://localhost:3000/api/v1/streams \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer demo_token" \
        -d "{
            \"stream\": {
                \"url\": \"$url\",
                \"title\": \"$title\",
                \"streamer_name\": \"$streamer\",
                \"location\": {
                    \"city\": \"$city\",
                    \"state\": \"$state\"
                },
                \"platform\": \"$platform\",
                \"is_live\": $is_live,
                \"posted_by\": \"DemoBot#0001\",
                \"viewer_count\": $((RANDOM % 10000 + 100))
            }
        }" > /dev/null 2>&1 || true
}

# Popular streamers with realistic data
create_stream "https://twitch.tv/pokimane" "Just Chatting - Morning Stream!" "Pokimane" "Los Angeles" "CA" "twitch" "true"
create_stream "https://twitch.tv/shroud" "VALORANT Ranked Grind" "Shroud" "Toronto" "ON" "twitch" "true"
create_stream "https://twitch.tv/ninja" "Fortnite Zero Build" "Ninja" "Chicago" "IL" "twitch" "false"
create_stream "https://youtube.com/watch?v=jfKfPfyJRdk" "lofi hip hop radio 24/7" "Lofi Girl" "Paris" "FR" "youtube" "true"
create_stream "https://kick.com/xqc" "VARIETY GAMING + REACT" "xQc" "Quebec City" "QC" "kick" "true"
create_stream "https://twitch.tv/hasanabi" "NEWS + REACT CONTENT" "HasanAbi" "Los Angeles" "CA" "twitch" "true"
create_stream "https://twitch.tv/asmongold" "World of Warcraft" "Asmongold" "Austin" "TX" "twitch" "false"
create_stream "https://youtube.com/watch?v=5qap5aO4i9A" "ChilledCow Radio" "ChilledCow" "Tokyo" "JP" "youtube" "true"
create_stream "https://twitch.tv/summit1g" "GTA RP - NoPixel" "summit1g" "Colorado Springs" "CO" "twitch" "true"
create_stream "https://kick.com/adin" "NBA 2K24 with viewers" "Adin Ross" "Miami" "FL" "kick" "false"
create_stream "https://twitch.tv/lirik" "Variety Day!" "LIRIK" "Boston" "MA" "twitch" "true"
create_stream "https://facebook.com/gaming/disguisedtoast" "TFT Ranked" "Disguised Toast" "Los Angeles" "CA" "facebook" "false"
create_stream "https://twitch.tv/sodapoppin" "World of Warcraft Classic" "Sodapoppin" "Austin" "TX" "twitch" "true"
create_stream "https://youtube.com/watch?v=DWcJFNfaw9c" "Lofi Sleep Mix" "The Jazz Hop Café" "Amsterdam" "NL" "youtube" "true"
create_stream "https://twitch.tv/tfue" "Call of Duty Warzone" "Tfue" "Florida" "FL" "twitch" "false"

echo "✅ Demo data seeded successfully!"