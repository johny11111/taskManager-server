const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// 📌 שלב 1 – התחלת ההרשאה
router.get('/auth', (req, res) => {
    const scopes = ['https://www.googleapis.com/auth/calendar'];

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent',
        state: req.query.userId || '' // נוסיף תמיכה בפרמטר userId
    });

    res.redirect(url);
});

// 📌 שלב 2 – קבלת ה-token לאחר אישור המשתמש
router.get('/calendar/callback', async (req, res) => {
    const code = req.query.code;
    const userId = req.query.state;

    if (!code || !userId) {
        console.log('➡️ חסר code או userId:', { code, userId });
        return res.status(400).send("Missing code or userId");
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // שמירה של הטוקן למסד
        const updated = await User.findByIdAndUpdate(userId, {
            googleCalendar: {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expiry_date: tokens.expiry_date,
            }
        }, { new: true });

        console.log('✅ משתמש עודכן עם טוקן:', updated.email);

        // החזרה ללקוח
        res.redirect('https://taskmanager-client-2pyw.onrender.com/#/teams?calendar_connected=true');

    } catch (error) {
        console.error("❌ Google Auth Error:", error.response?.data || error.message);
        res.status(500).send("Authentication failed");
    }
});

module.exports = router;
