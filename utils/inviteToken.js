const jwt = require('jsonwebtoken');

function createInviteToken(teamId) {
    return jwt.sign({ teamId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function decodeInviteToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { createInviteToken, decodeInviteToken };
