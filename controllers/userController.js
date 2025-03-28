const User = require('../models/User');
const Team = require("../models/Team")
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { decodeInviteToken } = require('../utils/inviteToken');
const sendEmail = require('../utils/sendEmail'); 

exports.sendInvite = async (req, res) => {
    const { email, teamId } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: "המשתמש שלך לא נמצא" });

    if (!user.teams || !user.teams.includes(teamId)) {
        return res.status(400).json({ message: "אינך חבר בצוות זה" });
    }
    const invitedUser = await User.findOne({ email });

    if (invitedUser) {
        await User.findByIdAndUpdate(invitedUser._id, {
            $addToSet: { teams: teamId }
        });
    
        await Team.findByIdAndUpdate(teamId, {
            $addToSet: { members: invitedUser._id }
        });
    
        const inviteLink = `https://taskmanager-client-2pyw.onrender.com/#/login`;
        await sendEmail(email, 'הצטרפות לצוות', `היי  הזמינו אותך לצוות. התחבר כאן: ${inviteLink}`);
    }
    

    res.status(200).json({ message: 'ההזמנה נשלחה בהצלחה' });
};

exports.registerUser = async (req, res) => {
    try {
        const { name, email, password, token } = req.body;

        let existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        let teams = [];
        if (token) {
            const decoded = decodeInviteToken(token);
            const teamId = decoded.teamId;
            teams.push(teamId);

            // הוסף את המשתמש לצוות קיים
            await Team.findByIdAndUpdate(teamId, {
                $addToSet: { members: existingUser ? existingUser._id : null }
            });
        }

        const newUser = new User({ name, email, password, teams });
        await newUser.save();

        // עדכן גם את הצוות במשתמש החדש
        if (teams.length > 0) {
            await Team.updateMany(
                { _id: { $in: teams } },
                { $addToSet: { members: newUser._id } }
            );
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

        const team = await Team.findById(teamId).populate('members', '_id name email');
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        res.status(200).json(team.members);
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

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: true,           
            sameSite: 'None',
            maxAge: 60 * 60 * 1000  
        });

        res.json({ user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) {
        console.error('❌ Error in loginUser:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};

exports.logoutUser = (req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/', // 🛠️ חובה – חייב להתאים ל־path של ההגדרה המקורית
    });
    res.json({ message: 'Logged out successfully' });
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
        const { userId } = req.user; 
        const { teammateId } = req.body; 

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "משתמש לא נמצא" });

        if (!user.team.includes(teammateId)) {
            user.team.push(teammateId);
            await user.save();
        }

        res.status(200).json({ message: "משתמש נוסף לצוות בהצלחה" });
    } catch (error) {
        res.status(500).json({ message: "שגיאה בהוספת משתמש לצוות", error });
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
        if (!name) return res.status(400).json({ message: 'שם הצוות נדרש' });

        const newTeam = new Team({
            name,
            members: [req.user.id],
            createdBy: req.user.id 
          });
          

        await newTeam.save();

        // עדכון המשתמש היוצר להוספת הצוות לרשימת הצוותים שלו
        await User.findByIdAndUpdate(req.user.id, {
            $push: { teams: newTeam._id }
        });

        res.status(201).json({ message: 'Team created successfully', team: newTeam });
    } catch (error) {
        console.error('❌ Error creating team:', error);
        res.status(500).json({ message: 'Error creating team', error: error.message });
    }
};

exports.deleteTeam = async (req, res) => {
    try {
      const { teamId } = req.params;
      const userId = req.user.id;
  
      const team = await Team.findById(teamId);
      if (!team) {
        return res.status(404).json({ message: 'Team not found' });
      }
  
      if (team.createdBy.toString() !== userId) {
        return res.status(403).json({ message: 'רק יוצר הצוות יכול למחוק אותו' });
      }
  
      // הסרת הצוות מכל המשתמשים
      await User.updateMany(
        { teams: teamId },
        { $pull: { teams: teamId } }
      );
  
      // מחיקת הצוות
      await Team.findByIdAndDelete(teamId);
  
      res.status(200).json({ message: 'הצוות נמחק בהצלחה' });
    } catch (error) {
      console.error('❌ Error deleting team:', error);
      res.status(500).json({ message: 'שגיאה במחיקת הצוות', error });
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



