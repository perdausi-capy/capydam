const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testUpload() {
  const token = 'pk_107576099_NRB4CYAMWXU7VLP8Y9KH5WKQYUXE2I88';
  
  // Create a dummy text file to upload
  fs.writeFileSync('test-upload.txt', 'Hello ClickUp!');
  
  const form = new FormData();
  form.append('attachment', fs.createReadStream('test-upload.txt'));
  
  // Try uploading to a view comment
  try {
    const res = await axios.post(
      'https://api.clickup.com/api/v2/view/4-90186542711-8/comment',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: token,
        }
      }
    );
    console.log("Success:", res.data);
  } catch (err) {
    console.error("View Upload Error:", err.response ? err.response.data : err.message);
  }
}

testUpload();
