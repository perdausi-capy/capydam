import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../lib/prisma';

// ⚙️ CONFIG
const COMPANY_DOMAIN = 'capytech.com'; 

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// 🛡️ SAFETY CHECK: Only initialize Google Strategy if keys exist
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: 'https://dam.capy-dev.com/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0].value;

          // 1. Enforce Company Domain
          if (!email || !email.endsWith(`@${COMPANY_DOMAIN}`)) {
            return done(null, false, { message: `Only ${COMPANY_DOMAIN} emails allowed.` });
          }

          // 2. Find or Create User
          const user = await prisma.user.upsert({
            where: { email },
            update: { 
              name: profile.displayName 
            },
            create: {
              email,
              name: profile.displayName,
              password: '', 
              role: 'viewer', 
            },
          });

          return done(null, user);
        } catch (error) {
          return done(error as any, false);
        }
      }
    )
  );
} else {
  console.warn("⚠️  Google SSO credentials missing in .env. SSO disabled.");
}

export default passport;