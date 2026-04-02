/**
 * ClawText 检索结果一致性校验模块
 * 功能：对用户问题做同义词替换，对比检索结果是否一致
 */

const { LEGAL_SYNONYMS } = require('./text-preprocessor');
const fs = require('fs');
const path = require('path');

// 数据库路径
const DB_PATH = path.join(__dirname, 'pdf_database.json');

// ============================================
// 同义词替换配置
// ============================================

// 可配置的替换对（用户可指定要测试的替换）
const REPLACEABLE_PAIRS = {
  // 监管机构
  'court': 'Tribunal',
  'Tribunal': 'court',
  'SFC': 'Securities and Futures Commission',
  'Securities and Futures Commission': 'SFC',
  '证监会': 'SFC',
  '审裁处': 'Tribunal',
  
  // 法律条款
  'section': 's.',
  'Section': 's.',
  '§': 's.',
  
  // 文档类型
  'ruling': 'Ruling',
  'decision': 'Decision',
  'determination': 'Determination',
  
  // 常见法律术语
  'appellant': 'Appellant',
  'respondent': 'Respondent',
  'hearing': 'Hearing',
  'appeal': 'Appeal',
};

// ============================================
// 一致性校验器类
// ============================================

class ConsistencyChecker {
  constructor(options = {}) {
    this.options = {
      maxResults: 10,        // 最多对比的文档数
      minScore: 0,           // 最低分数阈值
      includeChunks: false,  // 是否包含分块详情
      ...options
    };
  }

  /**
   * 读取数据库
   */
  readDB() {
    try {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('读取数据库失败:', error.message);
      return { files: [] };
    }
  }

  /**
   * 对用户问题进行同义词替换
   * @param {string} question - 原始问题
   * @param {Array} replacements - 指定的替换对 [{from, to}]
   * @returns {string} - 替换后的问题
   */
  replaceQuestion(question, replacements = []) {
    let result = question;
    
    if (replacements && replacements.length > 0) {
      // 使用用户指定的替换
      replacements.forEach(({ from, to }) => {
        const pattern = new RegExp(`\\b${this.escapeRegex(from)}\\b`, 'gi');
        result = result.replace(pattern, to);
      });
    } else {
      // 使用内置的替换对
      const sortedTerms = Object.keys(REPLACEABLE_PAIRS).sort((a, b) => b.length - a.length);
      sortedTerms.forEach(term => {
        const replacement = REPLACEABLE_PAIRS[term];
        const pattern = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi');
        result = result.replace(pattern, replacement);
      });
    }
    
    return result;
  }

  /**
   * 提取问题关键词
   */
  extractKeywords(question) {
    const stopWords = [
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'what', 'how', 'when', 'where', 'who', 'why', 'which',
      'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
      'and', 'or', 'but', 'if', 'then', 'else', 'that', 'this',
      '什么', '如何', '何时', '哪里', '谁', '为什么', '哪个'
    ];
    
    const legalKeywords = [
      'SFC', 'SFAT', 'SFO', 'Tribunal', 'court', 'ruling', 'decision',
      'section', 'subsection', 'paragraph', 'appeal', 'hearing',
      'disciplinary', 'sanction', 'penalty', 'fine', 'suspension',
      'license', 'representative', 'officer', 'misconduct', 'breach',
      'compliance', 'regulation', 'provision', 'fit and proper',
      'route', 'powers', 'transparency', 'clarity'
    ];
    
    const keywords = [];
    const lowerQuestion = question.toLowerCase();
    
    // 1. 提取法律关键词
    for (const keyword of legalKeywords) {
      if (lowerQuestion.includes(keyword.toLowerCase())) {
        keywords.push({ word: keyword, weight: 3, type: 'legal' });
      }
    }
    
    // 2. 提取问题中的实词
    const words = question.split(/\s+/).filter(w => w.length > 3);
    for (const word of words) {
      const cleanWord = word.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '');
      if (cleanWord.length > 3 && 
          !keywords.some(k => k.word.toLowerCase() === cleanWord.toLowerCase()) &&
          !stopWords.includes(cleanWord.toLowerCase())) {
        keywords.push({ word: cleanWord, weight: 1, type: 'general' });
      }
    }
    
    return keywords;
  }

  /**
   * 计算文档相关性分数
   */
  calculateRelevanceScore(docContent, docName, keywords) {
    if (!docContent || typeof docContent !== 'string') {
      return 0;
    }
    
    let score = 0;
    const lowerContent = docContent.toLowerCase();
    const lowerName = (docName || '').toLowerCase();
    
    // 文档名称匹配
    for (const keyword of keywords) {
      const lowerKeyword = keyword.word.toLowerCase();
      const weight = keyword.weight;
      
      if (lowerName.includes(lowerKeyword)) {
        score += weight * 10;
      }
      
      const regex = new RegExp(lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = lowerContent.match(regex);
      if (matches) {
        score += weight * matches.length;
      }
    }
    
    return score;
  }

  /**
   * 执行检索
   * @param {string} question - 问题
   * @param {Object} filters - 过滤条件 {category, docFilter}
   * @returns {Object} - 检索结果
   */
  performSearch(question, filters = {}) {
    const { category, docFilter } = filters;
    const db = this.readDB();
    
    if (!db || !db.files) {
      return {
        success: false,
        error: '数据库为空',
        results: [],
        question: question
      };
    }
    
    // 筛选文件
    let relevantFiles = db.files.filter(f => 
      f.status !== 'deleted' && 
      f.content && 
      f.content.length > 0 &&
      (!category || f.category === category)
    );
    
    if (docFilter && docFilter.length > 0) {
      relevantFiles = relevantFiles.filter(f => 
        docFilter.some(df => f.id === df || f.originalName.toLowerCase().includes(df.toLowerCase()))
      );
    }
    
    if (relevantFiles.length === 0) {
      return {
        success: true,
        results: [],
        question: question,
        message: '没有找到匹配的文件'
      };
    }
    
    // 提取关键词并评分
    const keywords = this.extractKeywords(question);
    const scoredFiles = relevantFiles.map(f => ({
      id: f.id,
      originalName: f.originalName,
      category: f.category,
      pageCount: f.pageCount,
      score: this.calculateRelevanceScore(f.content, f.originalName, keywords),
      keywords: keywords
    }));
    
    // 排序
    scoredFiles.sort((a, b) => b.score - a.score);
    
    // 截取前 N 个结果
    const topResults = scoredFiles.slice(0, this.options.maxResults);
    
    return {
      success: true,
      question: question,
      keywords: keywords,
      totalDocs: relevantFiles.length,
      results: topResults,
      topMatch: topResults[0] || null
    };
  }

  /**
   * 对比两个检索结果
   * @param {Object} result1 - 原始问题检索结果
   * @param {Object} result2 - 替换后问题检索结果
   * @returns {Object} - 对比结果
   */
  compareResults(result1, result2) {
    const comparison = {
      originalQuestion: result1.question,
      replacedQuestion: result2.question,
      consistency: {
        isConsistent: true,
        score: 100,
        details: []
      },
      documentComparison: {
        sameTopMatch: false,
        sameTop3: false,
        sameTop5: false,
        overlapRate: 0,
        rankChanges: []
      },
      scoreComparison: {
        originalTopScore: result1.topMatch?.score || 0,
        replacedTopScore: result2.topMatch?.score || 0,
        scoreDifference: 0,
        scoreDifferencePercent: 0
      },
      keywordComparison: {
        originalKeywords: result1.keywords?.map(k => k.word) || [],
        replacedKeywords: result2.keywords?.map(k => k.word) || [],
        commonKeywords: [],
        uniqueToOriginal: [],
        uniqueToReplaced: []
      }
    };
    
    // 1. 对比顶级匹配
    if (result1.topMatch && result2.topMatch) {
      comparison.documentComparison.sameTopMatch = result1.topMatch.id === result2.topMatch.id;
      if (!comparison.documentComparison.sameTopMatch) {
        comparison.consistency.isConsistent = false;
        comparison.consistency.details.push({
          type: 'top_match_changed',
          message: `顶级匹配文档发生变化`,
          original: result1.topMatch.originalName,
          replaced: result2.topMatch.originalName,
          severity: 'high'
        });
      }
    }
    
    // 2. 对比 Top 3
    const top3Original = result1.results.slice(0, 3).map(r => r.id);
    const top3Replaced = result2.results.slice(0, 3).map(r => r.id);
    comparison.documentComparison.sameTop3 = this.arraysEqual(top3Original, top3Replaced);
    
    // 3. 对比 Top 5
    const top5Original = result1.results.slice(0, 5).map(r => r.id);
    const top5Replaced = result2.results.slice(0, 5).map(r => r.id);
    comparison.documentComparison.sameTop5 = this.arraysEqual(top5Original, top5Replaced);
    
    // 4. 计算重叠率
    const allIds = new Set([...top5Original, ...top5Replaced]);
    const overlapIds = top5Original.filter(id => top5Replaced.includes(id));
    comparison.documentComparison.overlapRate = allIds.size > 0 
      ? Math.round((overlapIds.length / allIds.size) * 100) 
      : 0;
    
    // 5. 计算排名变化
    const rankMap1 = new Map(result1.results.map((r, i) => [r.id, i + 1]));
    const rankMap2 = new Map(result2.results.map((r, i) => [r.id, i + 1]));
    
    for (const [id, rank1] of rankMap1) {
      const rank2 = rankMap2.get(id);
      if (rank2 !== undefined && Math.abs(rank1 - rank2) > 2) {
        const doc = result1.results.find(r => r.id === id);
        comparison.documentComparison.rankChanges.push({
          documentId: id,
          documentName: doc?.originalName,
          originalRank: rank1,
          newRank: rank2,
          change: rank2 - rank1
        });
      }
    }
    
    if (comparison.documentComparison.rankChanges.length > 0) {
      comparison.consistency.details.push({
        type: 'rank_changes',
        message: `${comparison.documentComparison.rankChanges.length} 个文档排名变化超过 2 位`,
        changes: comparison.documentComparison.rankChanges,
        severity: 'medium'
      });
    }
    
    // 6. 分数对比
    comparison.scoreComparison.scoreDifference = 
      comparison.scoreComparison.replacedTopScore - comparison.scoreComparison.originalTopScore;
    
    if (comparison.scoreComparison.originalTopScore > 0) {
      comparison.scoreComparison.scoreDifferencePercent = Math.round(
        (comparison.scoreComparison.scoreDifference / comparison.scoreComparison.originalTopScore) * 100
      );
    }
    
    // 7. 关键词对比
    const originalWords = new Set(comparison.keywordComparison.originalKeywords);
    const replacedWords = new Set(comparison.keywordComparison.replacedKeywords);
    
    comparison.keywordComparison.commonKeywords = [...originalWords].filter(w => replacedWords.has(w));
    comparison.keywordComparison.uniqueToOriginal = [...originalWords].filter(w => !replacedWords.has(w));
    comparison.keywordComparison.uniqueToReplaced = [...replacedWords].filter(w => !originalWords.has(w));
    
    // 8. 计算一致性分数
    let consistencyScore = 100;
    
    if (!comparison.documentComparison.sameTopMatch) {
      consistencyScore -= 40;
    }
    if (!comparison.documentComparison.sameTop3) {
      consistencyScore -= 20;
    }
    if (!comparison.documentComparison.sameTop5) {
      consistencyScore -= 10;
    }
    if (comparison.documentComparison.overlapRate < 50) {
      consistencyScore -= 20;
    }
    if (comparison.documentComparison.rankChanges.length > 3) {
      consistencyScore -= 10;
    }
    if (Math.abs(comparison.scoreComparison.scoreDifferencePercent) > 50) {
      consistencyScore -= 10;
    }
    
    comparison.consistency.score = Math.max(0, consistencyScore);
    comparison.consistency.isConsistent = consistencyScore >= 70;
    
    // 9. 添加总体评价
    if (comparison.consistency.score >= 90) {
      comparison.consistency.evaluation = '优秀 - 检索结果高度一致';
    } else if (comparison.consistency.score >= 70) {
      comparison.consistency.evaluation = '良好 - 检索结果基本一致';
    } else if (comparison.consistency.score >= 50) {
      comparison.consistency.evaluation = '一般 - 检索结果有差异';
    } else {
      comparison.consistency.evaluation = '较差 - 检索结果不一致，需检查同义词替换策略';
    }
    
    return comparison;
  }

  /**
   * 执行一致性校验
   * @param {string} originalQuestion - 原始问题
   * @param {Array} replacements - 替换对 [{from, to}]
   * @param {Object} filters - 过滤条件
   * @returns {Object} - 完整校验结果
   */
  async checkConsistency(originalQuestion, replacements = [], filters = {}) {
    console.log(`🔍 开始一致性校验： "${originalQuestion}"`);
    
    // 1. 执行原始问题检索
    const originalResult = this.performSearch(originalQuestion, filters);
    console.log(`✅ 原始问题检索完成：${originalResult.results.length} 个结果`);
    
    // 2. 生成替换后的问题
    const replacedQuestion = this.replaceQuestion(originalQuestion, replacements);
    console.log(`🔄 替换后问题： "${replacedQuestion}"`);
    
    // 3. 执行替换后问题检索
    const replacedResult = this.performSearch(replacedQuestion, filters);
    console.log(`✅ 替换后问题检索完成：${replacedResult.results.length} 个结果`);
    
    // 4. 对比结果
    const comparison = this.compareResults(originalResult, replacedResult);
    
    // 5. 返回完整结果
    return {
      success: true,
      timestamp: new Date().toISOString(),
      originalQuestion,
      replacedQuestion,
      replacements,
      filters,
      originalResult,
      replacedResult,
      comparison
    };
  }

  /**
   * 批量一致性校验（测试多个替换对）
   * @param {string} originalQuestion - 原始问题
   * @param {Array} replacementSets - 多组替换对 [{name, replacements}]
   * @param {Object} filters - 过滤条件
   * @returns {Object} - 批量校验结果
   */
  async batchCheck(originalQuestion, replacementSets = [], filters = {}) {
    console.log(`🔍 开始批量一致性校验： "${originalQuestion}"`);
    
    const results = [];
    
    // 1. 原始问题检索（作为基准）
    const baselineResult = this.performSearch(originalQuestion, filters);
    
    // 2. 对每组替换进行测试
    for (const replacementSet of replacementSets) {
      const replacedQuestion = this.replaceQuestion(originalQuestion, replacementSet.replacements);
      const replacedResult = this.performSearch(replacedQuestion, filters);
      const comparison = this.compareResults(baselineResult, replacedResult);
      
      results.push({
        name: replacementSet.name || `替换测试 ${results.length + 1}`,
        replacements: replacementSet.replacements,
        replacedQuestion,
        comparison
      });
    }
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      originalQuestion,
      baselineResult,
      tests: results,
      summary: {
        totalTests: results.length,
        consistentCount: results.filter(r => r.comparison.consistency.isConsistent).length,
        inconsistentCount: results.filter(r => !r.comparison.consistency.isConsistent).length,
        averageScore: Math.round(results.reduce((sum, r) => sum + r.comparison.consistency.score, 0) / results.length)
      }
    };
  }

  /**
   * 辅助函数：判断两个数组是否相等
   */
  arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }

  /**
   * 辅助函数：转义正则表达式特殊字符
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 获取可用的替换对列表
   */
  getAvailableReplacements() {
    return Object.entries(REPLACEABLE_PAIRS).map(([from, to]) => ({
      from,
      to,
      category: this.getCategory(from)
    }));
  }

  /**
   * 获取术语分类
   */
  getCategory(term) {
    const categories = {
      'court': '机构', 'Tribunal': '机构', 'SFC': '机构', 
      'Securities and Futures Commission': '机构', '证监会': '机构', '审裁处': '机构',
      'section': '条款', 'Section': '条款', '§': '条款',
      'ruling': '文档类型', 'decision': '文档类型', 'determination': '文档类型',
      'appellant': '角色', 'respondent': '角色',
      'hearing': '程序', 'appeal': '程序'
    };
    return categories[term] || '其他';
  }
}

// 导出单例
const checker = new ConsistencyChecker();

module.exports = {
  ConsistencyChecker,
  checker,
  checkConsistency: (question, replacements, filters) => checker.checkConsistency(question, replacements, filters),
  batchCheck: (question, replacementSets, filters) => checker.batchCheck(question, replacementSets, filters),
  getAvailableReplacements: () => checker.getAvailableReplacements(),
  REPLACEABLE_PAIRS
};
