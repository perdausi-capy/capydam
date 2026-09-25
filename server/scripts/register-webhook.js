const axios = require('axios');
require('dotenv').config();

const teamId = '90181119211';
const token = process.env.CLICKUP_API_TOKEN;
const endpoint = 'https://marvelous-recovery-enlisted.ngrok-free.dev/api/clickup/webhook';

async function registerWebhook() {
  if (!token) {
    console.error('Missing CLICKUP_API_TOKEN in .env');
    return;
  }
  
  try {
    const res = await axios.post(
      `https://api.clickup.com/api/v2/team/${teamId}/webhook`,
      {
        endpoint: endpoint,
        events: [
          'taskCommentPosted',
          'viewCommentPosted'
        ]
      },
      {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Webhook registered successfully!');
    console.log(res.data);
  } catch (error) {
    console.error('Error registering webhook:', error?.response?.data || error.message);
  }
}

registerWebhook();
