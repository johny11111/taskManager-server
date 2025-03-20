// ✅ פונקציה להמרת תאריך לפורמט קריא יותר
exports.formatDate = (date) => {
    return new Date(date).toLocaleDateString('he-IL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// ✅ פונקציה לבדיקה אם משימה היא באיחור (פג תוקף)
exports.isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(); // מחזיר true אם המשימה באיחור
};

// ✅ פונקציה שמסננת משימות לפי סטטוס
exports.filterTasksByStatus = (tasks, status) => {
    return tasks.filter(task => task.status === status);
};

// ✅ פונקציה ליצירת מזהה ייחודי למשימות (למקרה שנרצה לזהות משימות מקומית)
exports.generateUniqueId = () => {
    return `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
};

// ✅ פונקציה שמחשבת כמה ימים נותרו עד הדדליין
exports.daysUntilDue = (dueDate) => {
    if (!dueDate) return 'ללא דדליין';
    const diff = new Date(dueDate) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days >= 0 ? `${days} ימים נותרו` : 'פג תוקף';
};
