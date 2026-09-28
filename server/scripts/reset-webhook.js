const axios = require('axios');
require('dotenv').config();

const teamId = '90181119211';
const token = process.env.CLICKUP_API_TOKEN;
const endpoint = 'https://marvelous-recovery-enlisted.ngrok-free.dev/api/clickup/webhook';

async function resetWebhook() {
  if (!token) {
    console.error('Missing CLICKUP_API_TOKEN in .env');
    return;
  }
  
  try {
    // 1. Get all webhooks
    console.log("Fetching existing webhooks...");
    const getRes = await axios.get(`https://api.clickup.com/api/v2/team/${teamId}/webhook`, {
      headers: { 'Authorization': token }
    });
    
    const webhooks = getRes.data.webhooks || [];
    console.log(`Found ${webhooks.length} webhooks.`);
    
    // 2. Delete any existing webhook matching our endpoint
    for (const hook of webhooks) {
      if (hook.endpoint === endpoint) {
         console.log(`Deleting broken webhook ID: ${hook.id}`);
         await axios.delete(`https://api.clickup.com/api/v2/webhook/${hook.id}`, {
           headers: { 'Authorization': token }
         });
      }
    }
    
    // 3. Register fresh webhook
    console.log("Registering fresh webhook...");
    const res = await axios.post(
      `https://api.clickup.com/api/v2/team/${teamId}/webhook`,
      {
        endpoint: endpoint,
        events: ['taskCommentPosted']
      },
      {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Webhook registered successfully!');
    console.log("Webhook ID:", res.data.webhook.id);
    console.log("Status:", res.data.webhook.health?.status || 'active');
  } catch (error) {
    console.error('Error resetting webhook:', error?.response?.data || error.message);
  }
}

resetWebhook();
