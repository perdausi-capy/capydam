const axios = require('axios');
const token = 'pk_107576099_NRB4CYAMWXU7VLP8Y9KH5WKQYUXE2I88';
const teamId = '90181119211';
axios.get(`https://api.clickup.com/api/v2/team/${teamId}/webhook`, {
  headers: { Authorization: token }
}).then(res => console.log(JSON.stringify(res.data, null, 2)))
  .catch(err => console.error(err.response ? err.response.data : err.message));
