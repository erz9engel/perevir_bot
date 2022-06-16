﻿'use strict';
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
        logger.error('Unable to connect to the server. Please start the server\n'+ err);
    } 
});

//Model connection
fs.readdirSync(__dirname + '/model').forEach(function (filename) {
    if (~filename.indexOf('.js')) require(__dirname + '/model/' + filename)
});

var Admin = mongoose.model('Admin');
var DailyStats = mongoose.model('DailyStats');
var Requests = mongoose.model('Request');
var TelegramUser = mongoose.model('TelegramUser');

require('./bot/bot');
const {logger} = require("./config/logging");
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
            DailyStats.find({}).sort('-_id').limit(14).exec(async function(err, stats){
                stats = stats.reverse();
                var data = {
                    days: [],
                    rTotal: [],
                    rTrue: [],
                    rFake: [],
                    rSemiTrue: [],
                    rNoProofs: [],
                    rReject: [],
                    rPending: [],
                    rToday: [],
                    rTodayTrue: [],
                    rTodayFake: [],
                    rTodaySemiTrue: [],
                    rTodayNoProofs: [],
                    rTodayReject: [],
                    rTodayPending: [],
                    subs: [],
                    nSubs: [],
                    nRecived: [],
                    requestPerUserLabel: [],
                    requestPerUserData: []
                };
                for (var i in stats) {
                    const dateParts = stats[i].stringDate.split('-');
                    const date = dateParts[0] + '.' + dateParts[1];
                    data.days.push(date);
                    data.rTotal.push(stats[i].rTotal);
                    data.rTrue.push(stats[i].rTrue);
                    data.rFake.push(stats[i].rFake);
                    data.rSemiTrue.push(stats[i].rSemiTrue);
                    data.rNoProofs.push(stats[i].rNoProofs);
                    data.rReject.push(stats[i].rReject);
                    data.rPending.push(stats[i].rPending);

                    data.rToday.push(stats[i].rToday);
                    data.rTodayTrue.push(stats[i].rTodayTrue);
                    data.rTodayFake.push(stats[i].rTodayFake);
                    data.rTodaySemiTrue.push(stats[i].rTodaySemiTrue);
                    data.rTodayNoProofs.push(stats[i].rTodayNoProofs);
                    data.rTodayReject.push(stats[i].rTodayReject);
                    data.rTodayPending.push(stats[i].rTodayPending);

                    data.subs.push(stats[i].subs);
                    data.nSubs.push(stats[i].nSubs);
                    data.nRecived.push(stats[i].nRecived);
                }

                const usersData = await getUsersData();
                for (var i in usersData) {
                    data.requestPerUserLabel.push(usersData[i][0]);
                    data.requestPerUserData.push(usersData[i][1]);
                }
                return res.render('dashboard', {data: data}); 
            });
        } 
    } else {
        return res.render('sign-in');
    }
});

let countValuesByKey = (arr, key) => arr.reduce((r, c) => {
    r[c[key]] = (r[c[key]] || 0) + 1
    return r
  }, {})

let countValuesByKeyGroup = (arr, key) => arr.reduce((r, c) => {
    if (c[key] > 50) c[key] = 50;
    else if (c[key] >= 20) c[key] = 20;
    else if (c[key] >= 15) c[key] = 15;
    else if (c[key] >= 10) c[key] = 10;
    r[c[key]] = (r[c[key]] || 0) + 1
    return r
  }, {})

async function getUsersData() {
    
    const requests = await Requests.find({}, 'createdAt requesterTG');
    const groupedReqs = countValuesByKey(requests, 'requesterTG');
    const groupedReqsArr = Object.entries(groupedReqs);
    groupedReqsArr.sort(function(a, b) {
        var x = a[1], y = b[1];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
    const devidedReqs = countValuesByKeyGroup(groupedReqsArr, 1);
    const allUsers = await TelegramUser.countDocuments({});
    devidedReqs[0] = Number(allUsers-groupedReqsArr.length);
    return Object.entries(devidedReqs);
}

router.get('/leaderboard', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in'); 
        else {
            return res.render('leaderboard'); 
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
