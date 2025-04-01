const express = require('express');
const {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  getTeamMembers,
  getTeams,
  getTeamById,
  createTeam,
  sendInvite,
  deleteTeam,
  refreshToken,
} = require('../controllers/userController');

const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// רוטות פתוחות - לא דורשות התחברות
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/refresh', refreshToken);

// רוטות מוגנות - דורשות התחברות
router.get('/me', authMiddleware, getCurrentUser);
router.get('/team-members', authMiddleware, getTeamMembers);
router.get('/teams', authMiddleware, getTeams);
router.get('/teams/:teamId', authMiddleware, getTeamById);
router.post('/teams/create', authMiddleware, createTeam);
router.delete('/teams/:teamId', authMiddleware, deleteTeam);
router.post('/invite', authMiddleware, sendInvite);


module.exports = router;
