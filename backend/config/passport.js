const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const pool = require("./db");

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

        let result = await pool.query(
          "SELECT id, email, name FROM users WHERE google_id = $1",
          [googleId]
        );
        if (result.rows.length > 0) return done(null, result.rows[0]);

        if (email) {
          result = await pool.query(
            "SELECT id, email, name FROM users WHERE email = $1",
            [email]
          );
          if (result.rows.length > 0) {
            const updated = await pool.query(
              "UPDATE users SET google_id = $1 WHERE id = $2 RETURNING id, email, name",
              [googleId, result.rows[0].id]
            );
            return done(null, updated.rows[0]);
          }
        }

        const newUser = await pool.query(
          "INSERT INTO users (email, google_id, name) VALUES ($1, $2, $3) RETURNING id, email, name",
          [email, googleId, name]
        );
        return done(null, newUser.rows[0]);
      } catch (err) {
        return done(err);
      }
    }
  )
);

module.exports = passport;
