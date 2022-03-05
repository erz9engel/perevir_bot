const mongoose = require("mongoose");
const router = require("express").Router();
const NewsRequest = mongoose.model('Request');
const Moderator = mongoose.model('Moderator');

const statusMapping = {
    'pending': '0',
    'fake': '-1',
    'true': '1'
}

router.get('/api/news', async (req, res) => {
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
            if (moderator.role === 'unverified') {
                throw new Error('not verified, ask admin')
            }
            res.send({ok: true})
        } catch (error) {
            console.error(error)
            res.status(401).send(error.message)
        }
    }
)

module.exports = router