const User = require('../models/User');
const Team = require("../models/Team")
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { decodeInviteToken, createInviteToken } = require('../utils/inviteToken');
const sendEmail = require('../utils/sendEmail');
const {
    generateAccessToken,
    generateRefreshToken,
} = require('../utils/jwt');

exports.sendInvite = async (req, res) => {
    const { email, teamId } = req.body;

    try {
        const inviter = await User.findById(req.user.id);
        if (!inviter) return res.status(404).json({ message: "user not found" });

        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ message: "team not found" });

        const isMember = team.members.find(
            m => m.userId && m.userId.toString() === inviter._id.toString()
        );
        if (!isMember) return res.status(403).json({ message: "אינך חבר בצוות זה" });

        const inviteToken = createInviteToken(teamId);

        const invitedUser = await User.findOne({ email });

        if (!invitedUser) {
            const alreadyInvited = (team.members || []).find(m => m && m.email === email);
            if (!alreadyInvited) {
                team.members.push({ userId: null, email, role: 'member' });
                await team.save();
            }

            const link = `https://managertask.com/#/register?token=${inviteToken}`;
            await sendEmail(
                email,
                '📩 הוזמנת להצטרף לצוות',
                `היי 👋 הוזמנת להצטרף לצוות ב־ManagerTask. הירשם כאן: ${link}`
            );

            return res.status(200).json({ message: 'ההזמנה נשלחה למשתמש חדש' });
        }



        // 🟢 משתמש קיים – הוסף אותו לצוות אם לא כבר חבר
        const alreadyMember = team.members.find(m => m.userId && m.userId.toString() === invitedUser._id.toString());

        if (!alreadyMember) {
            team.members.push({ userId: invitedUser._id, role: 'member' });
            await team.save();
        }

        await User.findByIdAndUpdate(invitedUser._id, {
            $addToSet: { teams: teamId }
        });


        const link = `https://managertask.com/#/login?token=${inviteToken}`;
        await sendEmail(
            email,
            '📩 הוזמנת להצטרף לצוות',
            `היי 👋 הוזמנת להצטרף לצוות. התחבר כאן: ${link}`
        );

        res.status(200).json({ message: 'ההזמנה נשלחה למשתמש קיים' });

    } catch (error) {
        console.error('❌ שגיאה בשליחת הזמנה:', error);
        res.status(500).json({ message: 'שגיאה בשליחת ההזמנה', error });
    }
};


exports.registerUser = async (req, res) => {
    try {
        const { name, email, password, token } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        let teams = [];
        if (token) {
            const decoded = decodeInviteToken(token);
            const teamId = decoded.teamId;
            teams.push(teamId);
        }

        const newUser = new User({ name, email, password, teams });
        await newUser.save();

        // 🧩 שיוך לצוותים
        for (const teamId of teams) {
            const team = await Team.findById(teamId);
            if (!team) continue;

            let updated = false;

            for (let member of team.members) {
                if (member.email === email && !member.userId) {
                    console.log(`🧠 מעדכן placeholder של ${email} עם userId ${newUser._id}`);
                    member.userId = newUser._id;
                    updated = true;
                    break;
                }
            }

        
            if (!updated) {
                const alreadyInTeam = team.members.some(
                    m => m.userId?.toString() === newUser._id.toString()
                );
                if (!alreadyInTeam) {
                    console.log(`➕ מוסיף את ${email} לצוות כ־member`);
                    team.members.push({ userId: newUser._id, role: "member" });
                }
            }

            await team.save();
            console.log(`🧩 ${newUser.email} שויך לצוות ${team.name}`);
        }

        res.status(201).json({ message: 'User registered successfully', teams });
    } catch (error) {
        console.error('❌ Error in registerUser:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};




exports.getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });

        res.json(user);
    } catch (err) {
        console.error('שגיאה בשליפת המשתמש:', err);
        res.status(500).json({ message: 'שגיאה בשרת' });
    }
};

exports.getTeamMembers = async (req, res) => {
    try {
        const { teamId } = req.query;

        if (!teamId) {
            return res.status(400).json({ message: 'חסר teamId בבקשה' });
        }

        const team = await Team.findById(teamId).populate('members.userId', 'name email');
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        const validMembers = (team.members || []).filter(m => m && m.userId);


        res.status(200).json(validMembers);
    } catch (error) {
        console.error('❌ Error fetching team members:', error);
        res.status(500).json({ message: 'שגיאה בקבלת חברי הצוות', error });
    }
};


exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        res.cookie('token', accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 15 * 60 * 1000 // 15m
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7D
        });

        res.json({ user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) {
        console.error('❌ Error in loginUser:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.logoutUser = (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        path: '/',
    });
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        path: '/',
    });

    res.json({ message: 'Logged out successfully' });
};


exports.refreshToken = async (req, res) => {
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
        return res.status(401).json({ message: 'Missing refresh token' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const accessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });

        res.cookie('token', accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 60 * 60 * 1000, // 1h
        });

        
        const user = await User.findById(decoded.id);
        res.json(user);
    } catch (err) {
        console.error('❌ שגיאה באימות Refresh Token:', err);
        res.status(403).json({ message: 'Invalid refresh token' });
    }
};
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}, '_id name email'); // מביא רק את ה-ID, השם והמייל
        res.status(200).json(users);
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.addToTeam = async (req, res) => {
    try {
        const { id: userId } = req.user;
        const { teammateId } = req.body;

        const user = await User.findById(userId);
        const team = await Team.findById(teammateId);

        if (!user) return res.status(404).json({ message: "משתמש לא נמצא" });
        if (!team) return res.status(404).json({ message: "צוות לא נמצא" });

        // הוספה לצוות במודל המשתמש
        if (!user.teams.includes(teammateId)) {
            user.teams.push(teammateId);
            await user.save();
        }

        // הוספה לצוות במודל הצוות
        const alreadyMember = team.members.some(
            member => member.userId?.toString() === user._id.toString()
        );

        if (!alreadyMember) {
            team.members.push({ userId: user._id, role: 'member' });
            await team.save();
        }

        res.status(200).json({ message: "משתמש נוסף לצוות בהצלחה" });
    } catch (error) {
        console.error("❌ שגיאה בהוספת משתמש לצוות:", error);
        res.status(500).json({ message: "שגיאה בהוספת משתמש לצוות", error });
    }
};

exports.updateTeamName = async (req, res) => {
    try {
      const { teamId } = req.params;
      const { name } = req.body;
      const userId = req.user.id;
  
      if (!name) return res.status(400).json({ message: 'Team name is required' });
  
      // ודא שהמשתמש חבר בצוות
      const team = await Team.findOne({ _id: teamId, 'members.userId': userId });
      if (!team) return res.status(404).json({ message: 'Team not found or access denied' });
  
      team.name = name;
      await team.save();
  
      res.status(200).json({ team });
    } catch (error) {
      console.error('❌ Error updating team name:', error);
      res.status(500).json({ message: 'Error updating team name', error });
    }
  };
  
// ✅ קבלת רשימת חברי הצוות
exports.getTeam = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate('team', 'name email');
        if (!user) return res.status(404).json({ message: "משתמש לא נמצא" });

        res.status(200).json(user.teams);
    } catch (error) {
        res.status(500).json({ message: "שגיאה בקבלת הצוות", error });
    }
};

exports.getTeams = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('teams');
        res.status(200).json(user.teams);
    } catch (error) {
        console.error('❌ Error fetching teams:', error);
        res.status(500).json({ message: 'Error fetching teams' });
    }
};

exports.createTeam = async (req, res) => {
    try {
        const { name } = req.body;
        const userId = req.user.id;

        if (!name) return res.status(400).json({ message: 'Team name is required' });

        const newTeam = new Team({
            name,
            createdBy: userId,
            members: [{ userId, role: 'admin' }]
        });

        await newTeam.save();

        // הוסף את הצוות לרשימת הצוותים של המשתמש
        await User.findByIdAndUpdate(userId, {
            $addToSet: { teams: newTeam._id }
        });

        res.status(201).json({ team: newTeam }); // חשוב!
    } catch (error) {
        console.error('❌ Error creating team:', error);
        res.status(500).json({ message: 'Error creating team', error });
    }
};

exports.deleteTeam = async (req, res) => {
    try {
        const { teamId } = req.params;
        const userId = req.user.id;

        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ message: 'Team not found' });

        const isAdmin = team.members.find(
            member => member.userId && member.userId.toString() === userId && member.role === 'admin'
        );


        if (!isAdmin) {
            return res.status(403).json({ message: 'Only team admins can delete the team' });
        }

        await team.deleteOne();
        res.status(200).json({ message: 'Team deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting team:', error);
        res.status(500).json({ message: 'Error deleting team', error });
    }
};


exports.getTeamById = async (req, res) => {
    try {
        const { teamId } = req.params;
        const team = await Team.findById(teamId).populate('members', 'name email'); // ✅ מוסיף שמות

        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        res.status(200).json(team);
    } catch (error) {
        console.error('❌ Error fetching team:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};


exports.promoteToAdmin = async (req, res) => {
  const { teamId } = req.params;
  const { email, role } = req.body;

  try {
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const currentUser = team.members.find(m =>
      m.userId?.toString() === req.user.id && m.role === 'admin'
    );
    if (!currentUser) return res.status(403).json({ message: 'Unauthorized' });

    const userToUpdate = await User.findOne({ email });
    if (!userToUpdate) return res.status(404).json({ message: 'User not found' });

    const memberEntry = team.members.find(m =>
      m.userId?.toString() === userToUpdate._id.toString()
    );

    if (!memberEntry) return res.status(400).json({ message: 'User is not in the team' });

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    if (role === 'member') {
      const adminCount = team.members.filter(m => m.role === 'admin').length;
      if (adminCount === 1 && memberEntry.role === 'admin') {
        return res.status(400).json({ message: 'חייב להיות לפחות מנהל אחד בצוות' });
      }
    }

    memberEntry.role = role;
    await team.save();

    res.status(200).json({ message: `User role updated to ${role}` });
  } catch (err) {
    console.error('❌ Error updating user role:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
};

  



