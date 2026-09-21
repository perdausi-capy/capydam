module.exports = {
  apps: [
    {
      name: 'capydam-mcp',
      script: 'npm',
      args: 'start',
      cwd: './', // path to your app
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
