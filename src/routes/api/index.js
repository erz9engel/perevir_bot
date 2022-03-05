const mongoose = require("mongoose");
const router = require("express").Router();
const NewsRequest = mongoose.model('Request');
const Moderator = mongoose.model('Moderator');
const {Strategy: JwtStrategy, ExtractJwt} = require('passport-jwt');
const jwt = require('jsonwebtoken');
const passport = require('passport');

const jwtOpts = {
    jwtFromRequest: ExtractJwt.fromHeader('authorization'),
    secretOrKey: process.env.JWTSECRET,
    issuer: '',
    audience: ''
}

const statusMapping = {
    'pending': '0',
    'fake': '-1',
    'true': '1'
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
//passport.authenticate('jwt', { session: false })

router.get('/api/news', passport.authenticate('jwt', { session: false }), async (req, res) => {
    const {status} = req.query;
    const bdQuery = status ? { fakeStatus: statusMapping[status] } : {}
    try {
        const requests = await NewsRequest.find(bdQuery);
        res.send(requests);
    } catch (e) {
        res.send(e)
    }
})

router.post('/api/sign-up', async  (req, res) => {
    const {username, password} = req.body
    try {
        const moderator = new Moderator({username, password, role: 'unverified'});
        await moderator.save()
        res.send({})
    } catch (err) {
        console.error(err)
        res.status(409).send('Something went wrong')
    }
})

router.post('/api/sign-in', async  (req, res) => {
        const {username, password} = req.body
        const moderator = await Moderator.findOne({username})

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
            console.error(error)
            res.status(401).send(error.message)
        }
    }
)

module.exports = router