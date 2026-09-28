const axios = require('axios');

async function testMarkdownImage() {
  const token = 'pk_107576099_NRB4CYAMWXU7VLP8Y9KH5WKQYUXE2I88';
  
  try {
    const res = await axios.post(
      'https://api.clickup.com/api/v2/view/4-90186542711-8/comment',
      {
        comment_text: 'Text with one newline:\n![Capybara](https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Hydrochoeris_hydrochaeris_in_Brazil_in_Parque_Tingui%2C_Curitiba.jpg/800px-Hydrochoeris_hydrochaeris_in_Brazil_in_Parque_Tingui%2C_Curitiba.jpg)\n\nText with two newlines:\n\n![Capybara](https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Hydrochoeris_hydrochaeris_in_Brazil_in_Parque_Tingui%2C_Curitiba.jpg/800px-Hydrochoeris_hydrochaeris_in_Brazil_in_Parque_Tingui%2C_Curitiba.jpg)'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: token,
        }
      }
    );
    console.log("Success!");
  } catch (err) {
    console.error("View Markdown Error:", err.response ? err.response.data : err.message);
  }
}

testMarkdownImage();
