const cron = require('node-cron');
const Task = require('../models/Task');
const io = require('../server');

const checkDueTasks = async () => {
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1); // מחשב מחר

    const dueTasks = await Task.find({
        dueDate: { $lte: tomorrow },
        status: 'pending'
    });

    if (dueTasks.length > 0) {
        io.emit('dueTasksReminder', dueTasks);
    }
};

// מריץ את הבדיקה כל יום ב-8 בבוקר
cron.schedule('0 8 * * *', checkDueTasks);
