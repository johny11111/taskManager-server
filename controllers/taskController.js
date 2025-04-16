const Task = require('../models/Task');
const Team = require('../models/Team')
const User = require("../models/User")
const { google } = require('googleapis');
const getAuthorizedClient = require('../utils/googleClient');
const { formatDate, isOverdue, daysUntilDue } = require('../utils/helpers');


// 📌 קבלת כל המשימות שהמשתמש יצר או שהוקצו אליו
exports.getTasks = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(400).json({ message: 'User authentication failed' });
    }

    
    const tasks = await Task.find({
      $or: [
        { createdBy: req.user.id }, 
        { assignedTo: req.user.id } 
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
    if (!task?.googleEventId) {
      console.warn("⚠️ אין googleEventId לעדכון.");
      return;
    }

    const user = await User.findById(userId);
    if (!user?.googleCalendar?.access_token) {
      console.warn("⚠️ אין גישה ליומן Google עבור המשתמש:", userId);
      return;
    }

    const oauth2Client = getAuthorizedClient(user);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const startTime = new Date(task.dueDate);
    const endTime = new Date(startTime.getTime() + (task.duration || 60) * 60 * 1000);

    const formatRecurrenceDate = (date) => {
      return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const recurrenceRule =
      task.recurrence !== 'none' && task.recurrenceEndDate
        ? [`RRULE:FREQ=${task.recurrence.toUpperCase()};UNTIL=${formatRecurrenceDate(task.recurrenceEndDate)}`]
        : undefined;

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
        ...(recurrenceRule ? { recurrence: recurrenceRule } : { recurrence: [] }) // הסרה אם אין יותר חזרתיות
      },
    });

    console.log("📝 אירוע עודכן ביומן Google");
  } catch (err) {
    console.error("❌ שגיאה בעדכון אירוע ביומן:", err.response?.data || err.message);
  }
};



// 📌 עדכון משימה קיימת
exports.updateTask = async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      assignedTo,
      dueDate,
      type,
      duration,
      recurrence,
      recurrenceEndDate,
      priority
    } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    task.title = title ?? task.title;
    task.description = description ?? task.description;
    task.status = status ?? task.status;
    task.assignedTo = assignedTo ?? task.assignedTo;
    task.dueDate = dueDate ?? task.dueDate;
    task.type = type ?? task.type;
    task.duration = duration ?? task.duration;
    task.recurrence = recurrence ?? task.recurrence;
    task.recurrenceEndDate = recurrenceEndDate ?? task.recurrenceEndDate;
    task.priority = priority ?? task.priority;



    const updatedTask = await task.save();

    if (task.googleEventId) {
      await updateGoogleCalendarEvent(task.assignedTo, updatedTask); // ✅ סנכרון עם בעל האירוע
    }

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error('❌ Error updating task:', error);
    res.status(500).json({ message: 'Error updating task', error });
  }
};




const deleteGoogleCalendarEvent = async (calendarOwnerId, eventId) => {
  try {
    if (!eventId) {
      console.warn("🚫 לא נשלח eventId למחיקה.");
      return;
    }

    console.log("📌 מנסה למחוק אירוע מהיומן:", eventId);

    const user = await User.findById(calendarOwnerId);
    if (!user?.googleCalendar?.access_token) {
      console.warn("🚫 אין גישה ליומן Google עבור המשתמש:", calendarOwnerId);
      return;
    }

    const oauth2Client = getAuthorizedClient(user); // שימוש תקני
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId
    });

    console.log('🗑️ האירוע נמחק מהיומן בהצלחה');
  } catch (err) {
    if (err.code === 404) {
      console.warn('⚠️ האירוע לא נמצא ביומן – ייתכן שכבר נמחק');
    } else {
      console.error('❌ שגיאה במחיקת האירוע מהיומן:', err.response?.data || err.message);
    }
  }
};


exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // 🗓️ אם זו פגישה חוזרת והמשתמש ביקש למחוק את כל הסדרה
    if (task.recurrence !== 'none' && req.query.deleteSeries === 'true') {
      if (task.googleEventId) {
        await deleteGoogleCalendarEvent(task.assignedTo, task.googleEventId);
      }

      await task.deleteOne();
      return res.status(200).json({ message: 'פגישה חוזרת נמחקה' });
    }

    // 🧹 מחיקת משימה רגילה או מופע בודד
    if (task.googleEventId) {
      await deleteGoogleCalendarEvent(task.assignedTo, task.googleEventId);
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
    const { status, sortBy, priority } = req.query;
    let filter = {};

    if (priority) {
      filter.priority = priority;
    }


    if (status) {
      filter.status = status; 
    }

    let sortOption = {};
    if (sortBy === 'dueDate') {
      sortOption.dueDate = 1;
    } else if (sortBy === 'createdAt') {
      sortOption.createdAt = -1; 
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

   
    const member = (team.members || []).find(member =>
      member?.userId && member.userId.toString() === req.user.id
    );

    if (!member) {
      return res.status(403).json({ message: 'You are not a member of this team' });
    }

    let tasks;
    if (member.role === 'admin') {
      tasks = await Task.find({ teamId });
    } else {
     
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
    const endTime = new Date(startTime.getTime() + (task.duration || 60) * 60 * 1000);

    // פונקציית עזר לפורמט נכון של UNTIL
    const formatRecurrenceDate = (date) => {
      return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const recurrenceRule = (task.recurrence !== 'none' && task.recurrenceEndDate)
      ? [`RRULE:FREQ=${task.recurrence.toUpperCase()};UNTIL=${formatRecurrenceDate(task.recurrenceEndDate)}`]
      : undefined;

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
        ...(recurrenceRule && { recurrence: recurrenceRule })
      },
    });

    task.googleEventId = eventResponse.data.id;
    await task.save();

  } catch (err) {
    console.error('❌ שגיאה בהוספת אירוע ליומן:', err.response?.data || err.message);
  }
};



exports.createTaskForTeam = async (req, res) => {
  try {
    const {
      title,
      description,
      assignedTo,
      dueDate,
      type = 'task',
      duration,
      recurrence = 'none',
      recurrenceEndDate,
      priority = 'medium'
    } = req.body;

    const { teamId } = req.params;

    if (!title || !assignedTo || !teamId || !dueDate) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const baseTaskData = {
      title,
      description,
      createdBy: req.user.id,
      teamId,
      type,
      duration,
      recurrence,
      recurrenceEndDate
    };

    const createAndSaveTask = async (userId) => {
      const newTask = new Task({
        ...baseTaskData,
        dueDate,
        assignedTo: userId
      });

      await newTask.save();
      await createGoogleCalendarEvent(userId, newTask);
      return newTask;
    };


    if (assignedTo === 'all') {
      const team = await Team.findById(teamId).populate('members.userId');
      const createdTasks = [];
      const createdUserIds = new Set();

      for (const member of team.members) {
        const userId = member.userId?._id?.toString();
        if (!userId || createdUserIds.has(userId)) continue;

        createdUserIds.add(userId);
        const task = await createAndSaveTask(userId);
        createdTasks.push(task);
      }

      return res.status(201).json({ message: 'המשימה הוקצתה לכולם', tasks: createdTasks });
    }

    const newTask = await createAndSaveTask(assignedTo);
    return res.status(201).json(newTask);

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

    const oauth2Client = getAuthorizedClient(user); 
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // סינון רק משימות שלא סונכרנו
    const tasks = await Task.find({
      assignedTo: user._id,
      status: 'pending',
      googleEventId: { $exists: false }
    });

    const formatRecurrenceDate = (date) => {
      return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    let addedCount = 0;

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const start = new Date(task.dueDate);
      const end = new Date(start.getTime() + (task.duration || 60) * 60 * 1000);

      const recurrenceRule =
        task.recurrence !== 'none' && task.recurrenceEndDate
          ? [`RRULE:FREQ=${task.recurrence.toUpperCase()};UNTIL=${formatRecurrenceDate(task.recurrenceEndDate)}`]
          : undefined;

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
            ...(recurrenceRule && { recurrence: recurrenceRule }),
          },
        });

        task.googleEventId = response.data.id;
        await task.save();
        addedCount++;
      } catch (err) {
        console.error('❌ שגיאה בהוספת אירוע:', err.response?.data || err.message);
      }
    }

    res.json({ addedCount });
  } catch (err) {
    console.error('❌ שגיאה כללית בסנכרון:', err.message);
    res.status(500).json({ message: 'שגיאה בסנכרון ליומן', error: err.message });
  }
};




