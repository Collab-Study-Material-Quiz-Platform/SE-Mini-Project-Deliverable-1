const express = require('express');
const { requireAuth } = require('../utils/authToken');
const { requireRoles } = require('../middleware/authorization');

const router = express.Router();
const authorized = (...roles) => [requireAuth, requireRoles(...roles)];

// These endpoints establish the server-side authorization boundary for the feature modules.
// Feature-specific persistence and business logic will be added by their respective issues.
router.get('/questions', ...authorized('student', 'contributor', 'admin'), (req, res) => res.json({ message: 'Authorized', role: req.auth.role }));
router.post('/questions', ...authorized('contributor'), (req, res) => res.json({ message: 'Authorized', role: req.auth.role }));
router.get('/quizzes', ...authorized('student', 'contributor', 'admin'), (req, res) => res.json({ message: 'Authorized', role: req.auth.role }));
router.post('/quizzes', ...authorized('contributor'), (req, res) => res.json({ message: 'Authorized', role: req.auth.role }));
router.get('/performance', ...authorized('student', 'contributor'), (req, res) => res.json({ message: 'Authorized', role: req.auth.role }));
router.get('/admin', ...authorized('admin'), (req, res) => res.json({ message: 'Authorized', role: req.auth.role }));

module.exports = router;
