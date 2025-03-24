const express = require('express');
const { registerUser, loginUser, getAllUsers, getTeam, addToTeam, getTeams, createTeam, getTeamById, getTeamMembers, sendInvite , deleteTeam, getCurrentUser } = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');


const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', authMiddleware, getCurrentUser);
router.get('/all', authMiddleware, getAllUsers);
router.post('/add-to-team', authMiddleware, addToTeam);
router.get('/team', authMiddleware, getTeam);
router.get('/teams', authMiddleware, getTeams);
router.get('/teams/:teamId', authMiddleware, getTeamById);
router.post('/create', authMiddleware, createTeam);
router.post('/invite', authMiddleware, sendInvite);
router.get('/team-members', authMiddleware, getTeamMembers);
router.delete('/teams/:teamId', authMiddleware, deleteTeam);



module.exports = router;
