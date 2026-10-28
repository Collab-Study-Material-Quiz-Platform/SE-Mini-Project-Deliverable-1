const ROLE_PERMISSIONS = Object.freeze({
  student: Object.freeze(['register', 'login', 'logout', 'search_material', 'download_material', 'attempt_quiz', 'view_personal_performance']),
  contributor: Object.freeze(['register', 'login', 'logout', 'search_material', 'download_material', 'upload_material', 'manage_questions', 'manage_quizzes', 'view_quiz_performance']),
  admin: Object.freeze(['login', 'logout', 'search_material', 'download_material', 'moderate_content', 'manage_users']),
});

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    return next();
  };
}

module.exports = { requireRoles };
module.exports.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
