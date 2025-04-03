const mongoose = require('mongoose');
require('dotenv').config(); // אם אתה משתמש בקובץ .env

const User = require('./models/User');
const Team = require('./models/Team');
const Task = require('./models/Task');

// 🛠 שנה את זה ל־URL של מסד הנתונים שלך
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/taskmanager';

const clearDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ מחובר ל־MongoDB');

    await User.deleteMany({});
    console.log('🧹 כל המשתמשים נמחקו');

    await Team.deleteMany({});
    console.log('🧹 כל הצוותים נמחקו');

    await Task.deleteMany({});
    console.log('🧹 כל המשימות נמחקו');

    console.log('✅ הניקוי הסתיים בהצלחה!');
    process.exit(0);
  } catch (err) {
    console.error('❌ שגיאה במחיקת הדאטה:', err);
    process.exit(1);
  }
};

clearDatabase();
