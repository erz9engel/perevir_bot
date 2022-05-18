const { expressjwt: jwt } = require('express-jwt');

const getTokenFromHeaders = (req) => {

    const { headers: { authorization } } = req;

    if (authorization && authorization.split(' ')[0] === 'Token') {
        return authorization.split(' ')[1];
    } else if (req.cookies.token) {
        return req.cookies.token
    }
    return null;
};

const auth = {
    required: jwt({
        secret: 'secret',
        userProperty: 'payload',
        getToken: getTokenFromHeaders,
        algorithms: ["HS256"]
    }),
    optional: jwt({
        secret: 'secret',
        userProperty: 'payload',
        getToken: getTokenFromHeaders,
        credentialsRequired: false,
        algorithms: ["HS256"]
    }),
};

module.exports = auth;
