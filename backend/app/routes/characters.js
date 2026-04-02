const express = require('express');
const router = express.Router();
const characterController = require('../controllers/characterController');

// 获取所有汉字（支持分页和筛选）
router.get('/', characterController.getCharacters);

// 获取指定汉字
router.get('/:id', characterController.getCharacterById);

module.exports = router;
