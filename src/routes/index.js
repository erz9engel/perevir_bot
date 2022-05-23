'use strict';
var express = require('express');
var router = express.Router();
var fs = require('fs');
const mongoose = require('mongoose');
const passport = require('passport');
const auth = require('./dashboard/auth');
require('dotenv').config();

//DataBase connection 
mongoose.connect(process.env.DB_URL, { useNewUrlParser: true, useUnifiedTopology: true }, function (err, db) {
    if (err) {
        console.log('Unable to connect to the server. Please start the server\n'+ err);
    } 
});

//Model connection
fs.readdirSync(__dirname + '/model').forEach(function (filename) {
    if (~filename.indexOf('.js')) require(__dirname + '/model/' + filename)
});

var Admin = mongoose.model('Admin');
var DailyStats = mongoose.model('DailyStats');

require('./bot/bot');
//router.use(require('./api'));

router.get('/sign-up', auth.optional, async (req, res) => {
    return res.render('sign-up');
});

router.get('/', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in'); 
        else {
            DailyStats.find({}).sort('-_id').limit(14).exec(function(err, stats){
                stats = stats.reverse();
                var data = {
                    days: [],
                    rTotal: [],
                    rTrue: [],
                    rFake: [],
                    rToday: [],
                    rTodayTrue: [],
                    rTodayFake: [],
                    subs: [],
                    nSubs: [],
                    nRecived: []
                };
                for (var i in stats) {
                    const dateParts = stats[i].stringDate.split('-');
                    const date = dateParts[0] + '.' + dateParts[1];
                    data.days.push(date);
                    data.rTotal.push(stats[i].rTotal);
                    data.rTrue.push(stats[i].rTrue);
                    data.rFake.push(stats[i].rFake);
                    data.rToday.push(stats[i].rToday);
                    data.rTodayTrue.push(stats[i].rTodayTrue);
                    data.rTodayFake.push(stats[i].rTodayFake);
                    data.subs.push(stats[i].subs);
                    data.nSubs.push(stats[i].nSubs);
                    data.nRecived.push(stats[i].nRecived);
                }
                return res.render('dashboard', {data: data}); 
            });
        } 
    } else {
        return res.render('sign-in');
    }
});

router.get('/texts', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in'); 
        else {
            fs.readFile('texts.json',
            await function(err, data) {       
                if (err) throw err;
                return res.render('texts', {data: JSON.parse(data)}); 
            });
        } 
    } else {
        return res.render('sign-in');
    }
});


module.exports = router;
