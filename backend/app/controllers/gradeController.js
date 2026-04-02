const Grade = require('../models/Grade');

// 获取所有年级
async function getGrades(req, res) {
  try {
    const grades = await Grade.findAll({ order: [['level', 'ASC']] });
    res.json(grades);
  } catch (error) {
    res.status(500).json({ error: '获取年级失败' });
  }
}

// 获取指定年级
async function getGradeById(req, res) {
  try {
    const grade = await Grade.findByPk(req.params.id);
    if (!grade) {
      return res.status(404).json({ error: '年级不存在' });
    }
    res.json(grade);
  } catch (error) {
    res.status(500).json({ error: '获取年级失败' });
  }
}

module.exports = {
  getGrades,
  getGradeById
};
