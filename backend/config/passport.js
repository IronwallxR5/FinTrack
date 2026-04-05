const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const prisma = require("./prisma");

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      proxy: true,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase() || null;
        const googleId = profile.id;
        const name = profile.displayName || null;

        let user = await prisma.users.findFirst({
          where: { google_id: googleId },
          select: { id: true, email: true, name: true },
        });
        if (user) return done(null, user);

        if (email) {
          const existingByEmail = await prisma.users.findUnique({
            where: { email },
            select: { id: true, email: true, name: true },
          });
          if (existingByEmail) {
            const updated = await prisma.users.update({
              where: { id: existingByEmail.id },
              data: { google_id: googleId },
              select: { id: true, email: true, name: true },
            });
            return done(null, updated);
          }
        }

        const newUser = await prisma.users.create({
          data: { email, google_id: googleId, name },
          select: { id: true, email: true, name: true },
        });
        return done(null, newUser);
      } catch (err) {
        return done(err);
      }
    }
  )
);

module.exports = passport;
