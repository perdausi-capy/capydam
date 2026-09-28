const axios = require('axios');
require('dotenv').config();

const viewId = '4-90186542711-8';
const token = process.env.CLICKUP_API_TOKEN;

async function fetchChat() {
  try {
    const res = await axios.get(`https://api.clickup.com/api/v2/view/${viewId}/comment`, {
      headers: { 'Authorization': token }
    });
    console.log("Success! Comments fetched.");
    const comments = res.data.comments;
    if (comments && comments.length > 0) {
       console.log(`Latest comment text:`, JSON.stringify(comments[0], null, 2));
    } else {
       console.log("No comments found.");
    }
  } catch (error) {
    console.error('Error fetching chat:', error?.response?.data || error.message);
  }
}

fetchChat();
