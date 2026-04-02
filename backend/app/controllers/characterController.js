const Character = require('../models/Character');
const Grade = require('../models/Grade');

// 获取所有汉字（支持分页和筛选）
async function getCharacters(req, res) {
  try {
    const { page = 1, limit = 20, grade_id } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (grade_id) {
      where.grade_id = grade_id;
    }
    
    const { count, rows } = await Character.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    // 添加年级信息
    const charactersWithGrade = await Promise.all(rows.map(async (char) => {
      const grade = await Grade.findByPk(char.grade_id);
      return {
        ...char,
        grade
      };
    }));
    
    res.json({
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      characters: charactersWithGrade
    });
  } catch (error) {
    res.status(500).json({ error: '获取汉字失败' });
  }
}

// 获取指定汉字
async function getCharacterById(req, res) {
  try {
    const character = await Character.findByPk(req.params.id);
    if (!character) {
      return res.status(404).json({ error: '汉字不存在' });
    }
    
    // 添加年级信息
    const grade = await Grade.findByPk(character.grade_id);
    const characterWithGrade = {
      ...character,
      grade
    };
    
    res.json(characterWithGrade);
  } catch (error) {
    res.status(500).json({ error: '获取汉字失败' });
  }
}

// 获取指定年级的汉字
async function getCharactersByGradeId(req, res) {
  try {
    const characters = await Character.findAll({
      where: { grade_id: req.params.gradeId }
    });
    
    // 添加年级信息
    const charactersWithGrade = await Promise.all(characters.map(async (char) => {
      const grade = await Grade.findByPk(char.grade_id);
      return {
        ...char,
        grade
      };
    }));
    
    res.json(charactersWithGrade);
  } catch (error) {
    res.status(500).json({ error: '获取汉字失败' });
  }
}

module.exports = {
  getCharacters,
  getCharacterById,
  getCharactersByGradeId
};
