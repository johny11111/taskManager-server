const { google } = require('googleapis');

const getAuthorizedClient = (user) => {
  if (!user || !user.googleCalendar) {
    throw new Error('User or googleCalendar data missing');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: user.googleCalendar.access_token,
    refresh_token: user.googleCalendar.refresh_token,
    expiry_date: user.googleCalendar.expiry_date
  });

  return oauth2Client;
};

module.exports = getAuthorizedClient;
