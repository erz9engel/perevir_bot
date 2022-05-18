const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local');

const Admin = mongoose.model('Admin');

passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
}, (req, username, password, done) => {

    Admin.findOne({ username })
        .then((user) => {
            if (!user || !user.validatePassword(password)) {
                return done(null, false, { errors: { 'email or password': 'is invalid' } });
            }

            return done(null, user);
        }).catch(done);
}));
