const express = require('express');
const { getTasks, updateTask, deleteTask, getFilteredTasks , getTasksByTeam , createTaskForTeam, syncOpenTasksToCalendar } = require('../controllers/taskController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, getTasks);
// router.post('/', authMiddleware, createTask);
router.put('/:id', authMiddleware, updateTask);
router.delete('/:id', authMiddleware, deleteTask);
router.get('/filter', authMiddleware, getFilteredTasks);
router.get('/team/:teamId', authMiddleware, getTasksByTeam);
router.post('/team/:teamId', authMiddleware, createTaskForTeam);
router.post('/sync-google-calendar', authMiddleware, syncOpenTasksToCalendar);



module.exports = router;
