const Task = require('../models/Task');
const Team = require('../models/Team')
const User = require("../models/User")
const { google } = require('googleapis');
const getAuthorizedClient = require('../utils/googleClient');
const { formatDate, isOverdue, daysUntilDue } = require('../utils/helpers');


// 📌 קבלת כל המשימות שהמשתמש יצר או שהוקצו אליו
exports.getTasks = async (req, res) => {
  try {
    console.log('📌 User from Token:', req.user);

    if (!req.user) {
      return res.status(400).json({ message: 'User authentication failed' });
    }

    // 📌 שליפת משימות שהמשתמש יצר או משימות שהוקצו לו
    const tasks = await Task.find({
      $or: [
        { createdBy: req.user.id }, // משימות שהמשתמש יצר
        { assignedTo: req.user.id } // משימות שהוקצו אליו
      ]
    });

    res.status(200).json(tasks);
  } catch (error) {
    console.error('❌ Error fetching tasks:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};


const updateGoogleCalendarEvent = async (userId, task) => {
  try {
    const user = await User.findById(userId);
    if (!user?.googleCalendar?.access_token || !task.googleEventId) return;

    const oauth2Client = getAuthorizedClient(user);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const startTime = new Date(task.dueDate);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    await calendar.events.update({
      calendarId: 'primary',
      eventId: task.googleEventId,
      requestBody: {
        summary: task.title,
        description: task.description,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'Asia/Jerusalem',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'Asia/Jerusalem',
        },
      },
    });

    console.log("📝 אירוע עודכן ביומן Google");
  } catch (err) {
    console.error("❌ שגיאה בעדכון אירוע ביומן:", err.message);
  }
};

// 📌 עדכון משימה קיימת
exports.updateTask = async (req, res) => {
  try {
    const { title, description, status, assignedTo, dueDate } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    task.title = title || task.title;
    task.description = description || task.description;
    task.status = status || task.status;
    task.assignedTo = assignedTo || task.assignedTo;
    task.dueDate = dueDate || task.dueDate;

    const updatedTask = await task.save();

    if (task.googleEventId) {
      await updateGoogleCalendarEvent(req.user.id, updatedTask);
    }

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error('❌ Error updating task:', error);
    res.status(500).json({ message: 'Error updating task', error });
  }
};


const deleteGoogleCalendarEvent = async (userId, eventId) => {
  try {
    console.log("📌 מנסה למחוק אירוע מהיומן:", eventId);
    const user = await User.findById(userId);
    if (!user?.googleCalendar?.access_token || !eventId) return;

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: user.googleCalendar.access_token,
      refresh_token: user.googleCalendar.refresh_token
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId
    });

    console.log('🗑️ אירוע נמחק מהיומן');
  } catch (err) {
    console.error('❌ שגיאה במחיקת אירוע מהיומן:', err.message);
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // 🧠 נסה למחוק גם את האירוע מהיומן אם יש googleEventId
    if (task.googleEventId) {
      await deleteGoogleCalendarEvent(req.user.id, task.googleEventId);
    }

    await task.deleteOne();
    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting task:', error);
    res.status(500).json({ message: 'Error deleting task', error });
  }
};



// 📌 סינון ומיון משימות לפי סטטוס ותאריך יעד
exports.getFilteredTasks = async (req, res) => {
  try {
    const { status, sortBy } = req.query;
    let filter = {};

    if (status) {
      filter.status = status; // סינון לפי סטטוס (completed / pending)
    }

    let sortOption = {};
    if (sortBy === 'dueDate') {
      sortOption.dueDate = 1; // מיון לפי תאריך יעד (מהקודם לחדש)
    } else if (sortBy === 'createdAt') {
      sortOption.createdAt = -1; // מיון לפי תאריך יצירה (מהחדש לישן)
    }

    const tasks = await Task.find(filter).sort(sortOption);
    res.json(tasks);
  } catch (error) {
    console.error('❌ Error filtering tasks:', error);
    res.status(500).json({ message: 'Error filtering tasks', error });
  }
};


exports.getTasksByTeam = async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID is required' });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // חפש את המשתמש בצוות
    const member = (team.members || []).find(member =>
      member?.userId && member.userId.toString() === req.user.id
    );

    console.log('🧪 req.user.id:', req.user.id);
    console.log('🧪 team.members:', team.members);
    if (!member) {
      return res.status(403).json({ message: 'You are not a member of this team' });
    }

    let tasks;
    if (member.role === 'admin') {
      // 🧑‍💼 אם הוא מנהל – החזר את כל המשימות בצוות
      tasks = await Task.find({ teamId });
    } else {
      // 👤 אם הוא לא מנהל – החזר רק משימות שהוקצו לו
      tasks = await Task.find({ teamId, assignedTo: req.user.id });
    }

    res.status(200).json(tasks);
  } catch (error) {
    console.error('❌ שגיאה בשליפת משימות הצוות:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};



const createGoogleCalendarEvent = async (assignedTo, task) => {
  try {
    const user = await User.findById(assignedTo);
    if (!user?.googleCalendar?.access_token) {
      console.log("🚫 אין טוקן ליומן עבור המשתמש");
      return;
    }

    const oauth2Client = getAuthorizedClient(user);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const startTime = new Date(task.dueDate);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const eventResponse = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: task.title,
        description: task.description,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'Asia/Jerusalem',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'Asia/Jerusalem',
        },
      },
    });

    task.googleEventId = eventResponse.data.id;
    await task.save();

    console.log('🗓️ אירוע נוסף ליומן Google');
  } catch (err) {
    console.error('❌ שגיאה בהוספת אירוע ליומן:', err.response?.data || err.message);
  }
};


exports.createTaskForTeam = async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate } = req.body;
    const { teamId } = req.params;

    if (!title || !assignedTo || !teamId) {
      return res.status(400).json({ message: 'Title, assignedTo, and teamId are required' });
    }

    // הקצאה לכולם
    if (assignedTo === 'all') {
      const team = await Team.findById(teamId).populate('members.userId');
      const createdTasks = [];

      for (const member of team.members) {
        if (!member.userId) continue; // 🛡 דילוג על חברים לא תקפים

        const newTask = new Task({
          title,
          description,
          assignedTo: member.userId._id,
          createdBy: req.user.id,
          dueDate,
          teamId
        });

        await newTask.save();
        await createGoogleCalendarEvent(member.userId._id, newTask);
        createdTasks.push(newTask);
      }

      return res.status(201).json({ message: 'המשימה הוקצתה לכולם', tasks: createdTasks });
    }

    // הקצאה למשתמש בודד
    const newTask = new Task({
      title,
      description,
      assignedTo,
      createdBy: req.user.id,
      dueDate,
      teamId
    });

    await newTask.save();
    await createGoogleCalendarEvent(req.user.id, newTask);

    res.status(201).json(newTask);
  } catch (error) {
    console.error('❌ Error creating task:', error);
    res.status(500).json({ message: 'Error creating task', error });
  }
};



exports.syncOpenTasksToCalendar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user?.googleCalendar?.access_token) {
      return res.status(400).json({ message: 'יומן Google לא מחובר' });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: user.googleCalendar.access_token,
      refresh_token: user.googleCalendar.refresh_token,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // משימות פתוחות שטרם סונכרנו
    const tasks = await Task.find({
      assignedTo: user._id,
      status: 'pending',
      googleEventId: { $exists: false },
    });

    let addedCount = 0;

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const start = new Date(task.dueDate);
      const end = new Date(start.getTime() + 60 * 60 * 1000);

      try {
        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: task.title,
            description: task.description,
            start: {
              dateTime: start.toISOString(),
              timeZone: 'Asia/Jerusalem',
            },
            end: {
              dateTime: end.toISOString(),
              timeZone: 'Asia/Jerusalem',
            },
          },
        });

        task.googleEventId = response.data.id;
        await task.save();
        addedCount++;
      } catch (err) {
        console.error('❌ שגיאה בהוספת אירוע:', err.message);
      }
    }

    res.json({ addedCount });
  } catch (err) {
    console.error('❌ שגיאה כללית בסנכרון:', err.message);
    res.status(500).json({ message: 'שגיאה בסנכרון ליומן', error: err.message });
  }
};


