const jwt = require('jsonwebtoken');
const { generateAccessToken, verifyRefreshToken } = require('../utils/jwt');

exports.authMiddleware = async (req, res, next) => {
  const token = req.cookies.token;
  const refreshToken = req.cookies.refreshToken;

  if (!token && !refreshToken) {
    return res.status(401).json({ message: 'אין הרשאה (אין טוקן)' });
  }

  try {
    // ✅ אם הטוקן תקין – ממשיכים כרגיל
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    console.warn('⚠️ טוקן פג תוקף – מנסה לרענן...');

    // ⚠️ טוקן לא תקף, נבדוק אם יש refreshToken
    if (!refreshToken) {
      return res.status(401).json({ message: 'פג תוקף ואין רענון' });
    }

    try {
      const decodedRefresh = verifyRefreshToken(refreshToken);
      const newAccessToken = generateAccessToken(decodedRefresh.id);

      // 🧁 מגדירים מחדש את העוגייה עם הטוקן החדש
      res.cookie('token', newAccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: 15 * 60 * 1000 
      });

      req.user = decodedRefresh;
      next();
    } catch (refreshError) {
      console.error('❌ רענון נכשל:', refreshError.message);
      return res.status(403).json({ message: 'רענון לא חוקי' });
    }
  }
};
