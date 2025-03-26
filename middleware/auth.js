const jwt = require('jsonwebtoken');

exports.authMiddleware = (req, res, next) => {
    const token = req.cookies.token; // 🟢 מה-cookie במקום headers

    if (!token) {
        return res.status(401).json({ message: 'Access Denied: No Token Provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('❌ Invalid Token:', error);
        res.status(400).json({ message: 'Invalid Token' });
    }
};

