const jwt = require("jsonwebtoken");
const passport = require("passport");
const {Strategy: JwtStrategy, ExtractJwt} = require("passport-jwt");
const mongoose = require("mongoose");
const {logger} = require("../config/logging");
const router = require("express").Router();
const Moderator = mongoose.model('Moderator');

const jwtOpts = {
    jwtFromRequest: ExtractJwt.fromHeader('authorization'),
    secretOrKey: process.env.JWTSECRET,
    issuer: '',
    audience: ''
}

passport.use(new JwtStrategy(jwtOpts, function(jwt_payload, done) {
    Moderator.findOne({_id: jwt_payload.id}, function(err, user) {
        if (err) {
            return done(err, false);
        }
        if (user) {
            return done(null, user);
        } else {
            return done(null, false);
        }
    });
}));

router.post('/sign-up', async  (req, res) => {
    const {username, password} = req.body
    try {
        const moderator = new Moderator({username, password, role: 'unverified'});
        await moderator.save()
        res.send({})
    } catch (err) {
        logger.error(err)
        res.status(409).send('Something went wrong')
    }
})

router.post('/sign-in', async  (req, res) => {
        const {username, password} = req.body
        const moderator = await Moderator.findOne({username}).select('+password')

        try {
            await moderator.comparePassword(password)
            /*
                        if (moderator.role === 'unverified') {
                            throw new Error('not verified, ask admin')
                        }
            */
            const token = jwt.sign({
                username,
                role: moderator.role,
                id: moderator._id
            }, process.env.JWTSECRET);

            res.send({ token })
        } catch (error) {
            logger.error(error)
            res.status(401).send(error.message)
        }
    }
)

module.exports = router