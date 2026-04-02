const express = require('express');
const router = express.Router();
const gradeController = require('../controllers/gradeController');
const characterController = require('../controllers/characterController');

// 获取所有年级
router.get('/', gradeController.getGrades);

// 获取指定年级
router.get('/:id', gradeController.getGradeById);

// 获取指定年级的汉字
router.get('/:gradeId/characters', characterController.getCharactersByGradeId);

module.exports = router;
