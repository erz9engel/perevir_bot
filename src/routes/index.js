'use strict';
var express = require('express');
var router = express.Router();
var fs = require('fs');
const mongoose = require('mongoose');
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

require('./bot/bot');
//router.use(require('./api'));

module.exports = router;
