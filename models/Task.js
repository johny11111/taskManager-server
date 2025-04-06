const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  dueDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },

  type: { type: String, enum: ['task', 'meeting'], default: 'task' },
  duration: { type: Number }, // בדקות
  recurrence: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
  recurrenceEndDate: { type: Date },

  googleEventId: { type: String }
});


module.exports = mongoose.model('Task', TaskSchema);
