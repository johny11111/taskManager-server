const User = require('../models/User');
const Team = require("../models/Team")
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: 'User already exists' });

        user = new User({ name, email, password });
        await user.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('❌ Error in registerUser:', error);
        res.status(500).json({ message: 'Server error', error });
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

        res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) {
        console.error('❌ Error in loginUser:', error);
        res.status(500).json({ message: 'Server error', error });
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

        res.status(200).json(user.team);
    } catch (error) {
        res.status(500).json({ message: "שגיאה בקבלת הצוות", error });
    }
};

exports.getTeams = async (req, res) => {
    try {
        const teams = await Team.find({ members: req.user.id }).populate('members', 'name email');
        res.status(200).json(teams);
    } catch (error) {
        console.error('❌ Error fetching teams:', error);
        res.status(500).json({ message: 'Error fetching teams' });
    }
};


exports.createTeam = async (req, res) => {
    try {
        console.log("📌 יצירת צוות, נתונים שהתקבלו:", req.body);
        console.log("📌 מזהה משתמש יוצר:", req.user.id);

        const { name, members } = req.body;
        if (!name) return res.status(400).json({ message: 'שם הצוות נדרש' });

        let teamMembers = members && Array.isArray(members) ? members : [];

        if (!teamMembers.includes(req.user.id)) {
            teamMembers.push(req.user.id);
        }

        const newTeam = new Team({
            name,
            members: teamMembers
        });

        await newTeam.save();

        // ✅ ודא שהתשובה תמיד בפורמט JSON תקין
        res.status(201).json({ message: 'Team created successfully', team: newTeam });
    } catch (error) {
        console.error('❌ Error creating team:', error);
        res.status(500).json({ message: 'Error creating team', error: error.message });
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



