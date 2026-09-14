# Capydam Remote Deployment Workflow
The Capydam application is hosted on a remote Ubuntu server using PM2. When applying changes (code updates or `.env` variable changes) to the live environment, follow these steps:

1. **Location**: The production app is located at `/var/www/capydam`.
2. **Build**: After uploading changes to the `server` directory, it must be rebuilt by running `npm run build` inside `/var/www/capydam/server`.
3. **Restart**: Changes to `.env` or backend code require restarting the PM2 process. Use `pm2 restart capydam-api` for the backend, or `pm2 restart capydam-ui` for the frontend.
4. **Logs**: If issues occur in production, instruct the user to check `pm2 logs capydam-api`.
