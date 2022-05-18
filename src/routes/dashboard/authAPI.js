var express = require("express");
var router = express.Router();
const mongoose = require('mongoose');
const passport = require('passport');
const auth = require('./auth');
require('dotenv').config();

var Admin = mongoose.model('Admin');

//POST new user route (optional, everyone has access)
router.post('/register', auth.optional, (req, res, next) => {
    const admin = req.body;
    if (String(admin.code) != process.env.ADMINCODE) return res.status(422).json({ errors: { username: 'incorrect code', } });

    Admin.findOne({ username: admin.username }, function (err, dbAdmin) {
        if (dbAdmin == null) {

            const finalAdmin = new Admin({
                _id: new mongoose.Types.ObjectId(),
                username: admin.username
            });

            finalAdmin.setPassword(admin.password);

            return finalAdmin.save()
                .then(function () {
                    res.cookie('token', finalAdmin.toAuthJSON().token, { maxAge: 60 * 24 * 60 * 60 * 1000, session: false }); 
                    return res.redirect('../');
                });


        } else {
            return res.status(422).json({
                errors: {
                    username: 'already registered',
                }
            });
        }
    });
});

//POST login route (optional, everyone has access)
router.post('/login', auth.optional, (req, res, next) => {

    return passport.authenticate('local', { session: false }, (err, passportClient, info) => {
        if (err) {
            return next(err);
        }

        if (passportClient) {
            const jwt = passportClient.generateJWT();

            res.cookie('token', jwt, { maxAge: 60 * 24 * 60 * 60 * 1000, session: false });
            return res.redirect(req.get('referer'));
        }

        return res.status(422).json({
            errors: {
                'username or password': 'is invalid',
            }
        });
    })(req, res, next);
});

module.exports = router