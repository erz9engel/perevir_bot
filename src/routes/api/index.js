const router = require("express").Router();
const newsRouter = require('./news');
const authRouter = require('./auth');

router.use('/api/news', newsRouter);
router.use('/api/auth', authRouter);

module.exports = router