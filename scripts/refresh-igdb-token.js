#!/usr/bin/env node

/**
 * Script to refresh IGDB access token using Twitch OAuth
 * 
 * IGDB uses Twitch's authentication system. Access tokens expire after ~60 days.
 * This script will get a new access token using your client credentials.
 * 
 * Usage:
 *   node scripts/refresh-igdb-token.js
 * 
 * Requirements:
 *   - IGDB_CLIENT_ID in your .env file
 *   - IGDB_CLIENT_SECRET in your .env file (you need to add this)
 * 
 * The script will:
 *   1. Use your client credentials to get a new access token
 *   2. Update your .env file with the new token
 *   3. Validate the token works with IGDB API
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const CLIENT_ID = process.env.IGDB_CLIENT_ID;
const CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET;

if (!CLIENT_ID) {
  console.error('❌ IGDB_CLIENT_ID not found in environment variables');
  console.error('Please add your IGDB Client ID to your .env file');
  process.exit(1);
}

if (!CLIENT_SECRET) {
  console.error('❌ IGDB_CLIENT_SECRET not found in environment variables');
  console.error('Please add your IGDB Client Secret to your .env file');
  console.error('You can find this in your Twitch application settings at: https://dev.twitch.tv/console/apps');
  process.exit(1);
}

/**
 * Make an HTTPS request
 */
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (error) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

/**
 * Get a new access token from Twitch
 */
async function getNewAccessToken() {
  console.log('🔄 Requesting new access token from Twitch...');
  
  const postData = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'client_credentials'
  }).toString();
  
  const options = {
    hostname: 'id.twitch.tv',
    port: 443,
    path: '/oauth2/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  try {
    const response = await makeRequest(options, postData);
    
    if (response.statusCode !== 200) {
      throw new Error(`Token request failed with status ${response.statusCode}: ${JSON.stringify(response.data)}`);
    }
    
    return response.data.access_token;
  } catch (error) {
    throw new Error(`Failed to get access token: ${error.message}`);
  }
}

/**
 * Validate the token works with IGDB
 */
async function validateToken(accessToken) {
  console.log('🔍 Validating token with IGDB API...');
  
  const postData = 'fields id, name; limit 1;';
  
  const options = {
    hostname: 'api.igdb.com',
    port: 443,
    path: '/v4/games',
    method: 'POST',
    headers: {
      'Client-ID': CLIENT_ID,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  try {
    const response = await makeRequest(options, postData);
    
    if (response.statusCode !== 200) {
      throw new Error(`IGDB validation failed with status ${response.statusCode}: ${JSON.stringify(response.data)}`);
    }
    
    return true;
  } catch (error) {
    throw new Error(`Token validation failed: ${error.message}`);
  }
}

/**
 * Update the .env file with the new token
 */
function updateEnvFile(newToken) {
  console.log('📝 Updating .env file...');
  
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found');
  }
  
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Replace the existing IGDB_ACCESS_TOKEN line
  const tokenRegex = /^IGDB_ACCESS_TOKEN=.*$/m;
  const newTokenLine = `IGDB_ACCESS_TOKEN=${newToken}`;
  
  if (tokenRegex.test(envContent)) {
    envContent = envContent.replace(tokenRegex, newTokenLine);
  } else {
    // Add the token if it doesn't exist
    envContent += `\n${newTokenLine}\n`;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file updated successfully');
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Starting IGDB token refresh...');
    console.log(`📋 Client ID: ${CLIENT_ID}`);
    
    // Get new access token
    const newToken = await getNewAccessToken();
    console.log('✅ New access token obtained');
    
    // Validate token
    await validateToken(newToken);
    console.log('✅ Token validated with IGDB API');
    
    // Update .env file
    updateEnvFile(newToken);
    
    console.log('🎉 IGDB token refresh completed successfully!');
    console.log('💡 You may need to restart your application to use the new token');
    
  } catch (error) {
    console.error('❌ Token refresh failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
