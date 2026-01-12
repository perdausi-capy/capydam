"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const prisma_1 = require("../lib/prisma");
// ⚙️ CONFIG
const COMPANY_DOMAIN = 'capytech.com';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// 🛡️ SAFETY CHECK: Only initialize Google Strategy if keys exist
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    passport_1.default.use(new passport_google_oauth20_1.Strategy({
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: 'https://dam.capy-dev.com/api/auth/google/callback',
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0].value;
            // 1. Enforce Company Domain
            if (!email || !email.endsWith(`@${COMPANY_DOMAIN}`)) {
                return done(null, false, { message: `Only ${COMPANY_DOMAIN} emails allowed.` });
            }
            // 2. Find or Create User
            const user = await prisma_1.prisma.user.upsert({
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
        }
        catch (error) {
            return done(error, false);
        }
    }));
}
else {
    console.warn("⚠️  Google SSO credentials missing in .env. SSO disabled.");
}
exports.default = passport_1.default;
