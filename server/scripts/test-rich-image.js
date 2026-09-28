const axios = require('axios');
require('dotenv').config();

const viewId = '4-90186542711-8';
const token = process.env.CLICKUP_API_TOKEN;

async function testRichImage() {
  const payload = {
    notify_all: true,
    comment: [
      { text: "Test Rich Image:\n" },
      {
        type: "image",
        image: {
          url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Hydrochoeris_hydrochaeris_in_Brazil_in_Parque_Tingui%2C_Curitiba.jpg/800px-Hydrochoeris_hydrochaeris_in_Brazil_in_Parque_Tingui%2C_Curitiba.jpg"
        }
      }
    ]
  };

  try {
    const res = await axios.post(`https://api.clickup.com/api/v2/view/${viewId}/comment`, payload, {
      headers: { 'Authorization': token }
    });
    console.log("Success! Rich Image posted.");
  } catch (error) {
    console.error('Error posting rich image:', error?.response?.data || error.message);
  }
}

testRichImage();
