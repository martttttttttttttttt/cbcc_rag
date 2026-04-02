/**
 * ClawText PDF 智能标签标注模块
 * 
 * 功能：
 * 1. 从文件名提取元数据（案件编号、年份）
 * 2. 文档类型识别（Ruling/Interlocutory/Costs）
 * 3. 法条编号提取（正则匹配 section X, regulation Y）
 * 4. 当事人/机构识别（基于规则 + 词典的 NER）
 * 5. 日期提取和标准化
 */

const fs = require('fs');
const path = require('path');

// ============================================
// 配置
// ============================================
const TAGGER_CONFIG = {
  // 启用调试日志
  debug: false,
  // 最小实体长度
  minEntityLength: 2,
  // 最大实体长度
  maxEntityLength: 100,
  // 置信度阈值
  confidenceThreshold: 0.6
};

// ============================================
// 文档类型关键词映射
// ============================================
const DOC_TYPE_KEYWORDS = {
  'Ruling': {
    keywords: ['ruling', 'decision', 'determination', '裁决', '裁定', '决定'],
    weight: 1.0
  },
  'Interlocutory': {
    keywords: ['interlocutory', 'application', 'motion', '申请', '动议'],
    weight: 1.0
  },
  'Costs': {
    keywords: ['costs', 'taxation', '费用', '讼费', '成本'],
    weight: 1.0
  },
  'Judgment': {
    keywords: ['judgment', '判决', '宣判'],
    weight: 1.0
  },
  'Order': {
    keywords: ['order', '命令', '指令'],
    weight: 1.0
  },
  'Reasons': {
    keywords: ['reasons', 'reasons for decision', '理由'],
    weight: 0.8
  }
};

// ============================================
// 常见机构/组织词典
// ============================================
const ORGANIZATION_DICTIONARY = [
  // 香港监管机构
  'Securities and Futures Commission',
  'SFC',
  'Hong Kong Monetary Authority',
  'HKMA',
  'Stock Exchange of Hong Kong',
  'SEHK',
  'Hong Kong Exchanges and Clearing',
  'HKEX',
  'Insurance Authority',
  'Mandatory Provident Fund Schemes Authority',
  'MPFA',
  'Securities and Futures Appeal Tribunal',
  'SFAT',
  
  // 国际机构
  'Financial Conduct Authority',
  'FCA',
  'Securities and Exchange Commission',
  'SEC',
  'Commodity Futures Trading Commission',
  'CFTC',
  
  // 法院/仲裁
  'Court of Appeal',
  'High Court',
  'District Court',
  'Magistrates Court',
  'Supreme Court',
  'Tribunal',
  'Arbitration Centre',
  
  // 律师事务所（常见前缀）
  'Solicitors',
  'Barristers',
  'Counsel',
  'Law Firm',
  'LLP',
  'Limited Liability Partnership'
];

// ============================================
// 职位/头衔词典（用于识别人名）
// ============================================
const TITLE_PATTERNS = [
  /Mr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
  /Ms\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
  /Mrs\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
  /Dr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
  /Prof\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
  /Hon\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
  /Justice\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
  /Judge\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
  /Chairman\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
  /President\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g
];

// ============================================
// 正则表达式模式
// ============================================
const PATTERNS = {
  // 案件编号（SFAT_2021-5, SFAT_2022-10 等）
  caseNumber: /SFAT[_\s]*(\d{4})[-_]?(\d+)/i,
  
  // 年份（4位数字，合理范围1900-2099）
  year: /\b(19|20)\d{2}\b/g,
  
  // 完整日期（多种格式）
  fullDate: /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b|\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/g,
  
  // 法条编号 - Section
  sectionNumber: /section\s+(\d+)(?:\s*\((\d+)\))?/gi,
  
  // 法条编号 - Regulation
  regulationNumber: /regulation\s+(\d+)(?:\s*\((\d+)\))?/gi,
  
  // 法条编号 - Rule
  ruleNumber: /rule\s+(\d+)(?:\s*\((\d+)\))?/gi,
  
  // 法条编号 - Paragraph
  paragraphNumber: /paragraph\s+(\d+)/gi,
  
  // 法条引用（如 SFO s.114）
  legalCitation: /(?:SFO|Ordinance|Cap\.?\s*\d+)\s+(?:s\.?|section)\s*(\d+)/gi,
  
  // 人名（大写字母开头，多个单词）
  personName: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g,
  
  // 全大写人名（如 CHAN TAI MAN）
  upperCaseName: /\b([A-Z]{2,}(?:\s+[A-Z]{2,}){1,3})\b/g,
  
  // 公司名称（含 Limited, Ltd, Corporation 等）
  companyName: /([A-Z][a-zA-Z\s&]+(?:Limited|Ltd\.?|Corporation|Corp\.?|Inc\.?|PLC|LLP|Company|Co\.?))/gi
};

// ============================================
// 停用词（排除常见非人名词汇）
// ============================================
const STOPWORDS = new Set([
  // 常用词
  'The', 'This', 'That', 'These', 'Those', 'There', 'Their', 'They',
  'And', 'Or', 'But', 'For', 'With', 'From', 'About', 'Into', 'Through',
  'During', 'Before', 'After', 'Above', 'Below', 'Between', 'Among',
  'Within', 'Without', 'Against', 'Under', 'Over', 'Upon',
  
  // 法律术语（非实体）
  'Section', 'Regulation', 'Paragraph', 'Article', 'Schedule',
  'Part', 'Chapter', 'Appendix', 'Annex', 'Schedule',
  'Appellant', 'Respondent', 'Applicant', 'Defendant', 'Plaintiff',
  'Claimant', 'Petitioner', 'Tribunal', 'Court', 'Judge', 'Panel',
  'Hearing', 'Proceeding', 'Application', 'Appeal', 'Reference',
  
  // 月份
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
  'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]);

// ============================================
// 主要功能：标注 PDF 文档
// ============================================

/**
 * 标注 PDF 文档
 * @param {string} content - PDF 文本内容
 * @param {object} fileInfo - 文件信息 { originalName, fileName, id, ... }
 * @returns {object} 标注结果
 */
function tagPDF(content, fileInfo) {
  const startTime = Date.now();
  
  // 确保 fileInfo 是对象
  if (typeof fileInfo === 'string') {
    fileInfo = { originalName: fileInfo };
  }
  
  const fileName = fileInfo?.originalName || fileInfo?.fileName || 'unknown.pdf';
  
  if (TAGGER_CONFIG.debug) {
    console.log(`🔍 开始标注: ${fileName}`);
  }
  
  // 执行各项提取
  const tags = {
    // 基础元数据
    metadata: extractMetadata(fileName, content),
    
    // 文档类型
    documentType: detectDocumentType(content, fileName),
    
    // 法条引用
    legalReferences: extractLegalReferences(content),
    
    // 当事人/实体
    parties: extractParties(content),
    
    // 日期信息
    dates: extractDates(content),
    
    // 关键短语/主题
    keyPhrases: extractKeyPhrases(content),
    
    // 统计信息
    stats: {
      totalChars: content.length,
      totalWords: content.split(/\s+/).length,
      processingTime: Date.now() - startTime
    }
  };
  
  if (TAGGER_CONFIG.debug) {
    console.log(`✅ 标注完成 (${tags.stats.processingTime}ms)`);
  }
  
  return tags;
}

/**
 * 提取基础元数据
 * @param {string} fileName - 文件名
 * @param {string} content - 文本内容
 * @returns {object} 元数据
 */
function extractMetadata(fileName, content) {
  const metadata = {
    fileName: fileName,
    extractedAt: new Date().toISOString()
  };
  
  // 从文件名提取案件编号
  const caseMatch = fileName.match(PATTERNS.caseNumber);
  if (caseMatch) {
    metadata.caseNumber = `SFAT ${caseMatch[1]}-${caseMatch[2]}`;
    metadata.year = parseInt(caseMatch[1]);
  }
  
  // 如果没找到，尝试从内容中提取年份
  if (!metadata.year) {
    const years = content.match(PATTERNS.year) || [];
    if (years.length > 0) {
      // 取最常见的年份
      const yearCounts = {};
      years.forEach(y => {
        yearCounts[y] = (yearCounts[y] || 0) + 1;
      });
      metadata.year = parseInt(Object.entries(yearCounts)
        .sort((a, b) => b[1] - a[1])[0][0]);
    }
  }
  
  // 提取文档标题（通常是前几行）
  const lines = content.split('\n').slice(0, 20);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 10 && trimmed.length < 200) {
      // 可能是标题
      if (/^(IN THE|BEFORE|SECURITIES|DETERMINATION|RULING)/i.test(trimmed)) {
        metadata.title = trimmed;
        break;
      }
    }
  }
  
  return metadata;
}

/**
 * 检测文档类型
 * @param {string} content - 文本内容
 * @param {string} fileName - 文件名
 * @returns {object} 文档类型信息
 */
function detectDocumentType(content, fileName) {
  const scores = {};
  const contentLower = content.toLowerCase();
  const fileNameLower = fileName.toLowerCase();
  
  // 计算每种类型的得分
  for (const [type, config] of Object.entries(DOC_TYPE_KEYWORDS)) {
    let score = 0;
    
    // 检查文件名
    for (const keyword of config.keywords) {
      if (fileNameLower.includes(keyword.toLowerCase())) {
        score += 2 * config.weight; // 文件名匹配权重更高
      }
    }
    
    // 检查内容（前5000字符）
    const sampleContent = contentLower.slice(0, 5000);
    for (const keyword of config.keywords) {
      const matches = sampleContent.match(new RegExp(keyword.toLowerCase(), 'g'));
      if (matches) {
        score += matches.length * config.weight;
      }
    }
    
    scores[type] = score;
  }
  
  // 找出最高分的类型
  const sortedTypes = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .filter(([_, score]) => score > 0);
  
  if (sortedTypes.length === 0) {
    return {
      primary: 'Unknown',
      confidence: 0,
      allScores: scores
    };
  }
  
  const [primaryType, primaryScore] = sortedTypes[0];
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? primaryScore / totalScore : 0;
  
  return {
    primary: primaryType,
    confidence: Math.round(confidence * 100) / 100,
    allScores: scores,
    alternatives: sortedTypes.slice(1, 3).map(([type, score]) => ({
      type,
      score: Math.round((score / totalScore) * 100) / 100
    }))
  };
}

/**
 * 提取法条引用
 * @param {string} content - 文本内容
 * @returns {object} 法条引用列表
 */
function extractLegalReferences(content) {
  const references = {
    sections: [],
    regulations: [],
    rules: [],
    paragraphs: [],
    citations: []
  };
  
  // 提取 Section
  let match;
  while ((match = PATTERNS.sectionNumber.exec(content)) !== null) {
    const ref = match[2] 
      ? `section ${match[1]}(${match[2]})`
      : `section ${match[1]}`;
    if (!references.sections.includes(ref)) {
      references.sections.push(ref);
    }
  }
  PATTERNS.sectionNumber.lastIndex = 0;
  
  // 提取 Regulation
  while ((match = PATTERNS.regulationNumber.exec(content)) !== null) {
    const ref = match[2]
      ? `regulation ${match[1]}(${match[2]})`
      : `regulation ${match[1]}`;
    if (!references.regulations.includes(ref)) {
      references.regulations.push(ref);
    }
  }
  PATTERNS.regulationNumber.lastIndex = 0;
  
  // 提取 Rule
  while ((match = PATTERNS.ruleNumber.exec(content)) !== null) {
    const ref = match[2]
      ? `rule ${match[1]}(${match[2]})`
      : `rule ${match[1]}`;
    if (!references.rules.includes(ref)) {
      references.rules.push(ref);
    }
  }
  PATTERNS.ruleNumber.lastIndex = 0;
  
  // 提取 Paragraph
  while ((match = PATTERNS.paragraphNumber.exec(content)) !== null) {
    const ref = `paragraph ${match[1]}`;
    if (!references.paragraphs.includes(ref)) {
      references.paragraphs.push(ref);
    }
  }
  PATTERNS.paragraphNumber.lastIndex = 0;
  
  // 提取综合引用
  while ((match = PATTERNS.legalCitation.exec(content)) !== null) {
    references.citations.push(match[0]);
  }
  PATTERNS.legalCitation.lastIndex = 0;
  
  // 限制数量
  references.sections = references.sections.slice(0, 50);
  references.regulations = references.regulations.slice(0, 30);
  references.rules = references.rules.slice(0, 30);
  references.paragraphs = references.paragraphs.slice(0, 30);
  references.citations = [...new Set(references.citations)].slice(0, 20);
  
  return references;
}

/**
 * 提取当事人/实体
 * @param {string} content - 文本内容
 * @returns {object} 当事人和实体列表
 */
function extractParties(content) {
  const parties = {
    persons: [],
    organizations: [],
    roles: {}
  };
  
  const foundNames = new Set();
  
  // 1. 使用头衔模式提取人名
  for (const pattern of TITLE_PATTERNS) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1].trim();
      if (isValidName(name) && !foundNames.has(name)) {
        parties.persons.push({
          name,
          type: 'person',
          source: 'title_pattern'
        });
        foundNames.add(name);
      }
    }
    pattern.lastIndex = 0;
  }
  
  // 2. 查找角色关联的人名
  const rolePatterns = [
    { pattern: /appellant[s]?\s+(?:is|are|was|were)?\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi, role: 'appellant' },
    { pattern: /respondent[s]?\s+(?:is|are|was|were)?\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi, role: 'respondent' },
    { pattern: /applicant[s]?\s+(?:is|are|was|were)?\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi, role: 'applicant' },
    { pattern: /defendant[s]?\s+(?:is|are|was|were)?\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi, role: 'defendant' },
    { pattern: /between\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+and\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi, role: 'both' }
  ];
  
  for (const { pattern, role } of rolePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (role === 'both' && match[1] && match[2]) {
        const name1 = match[1].trim();
        const name2 = match[2].trim();
        if (isValidName(name1)) {
          parties.roles[name1] = 'party_a';
          if (!foundNames.has(name1)) {
            parties.persons.push({ name: name1, type: 'person', source: 'role_pattern' });
            foundNames.add(name1);
          }
        }
        if (isValidName(name2)) {
          parties.roles[name2] = 'party_b';
          if (!foundNames.has(name2)) {
            parties.persons.push({ name: name2, type: 'person', source: 'role_pattern' });
            foundNames.add(name2);
          }
        }
      } else if (match[1]) {
        const name = match[1].trim();
        if (isValidName(name)) {
          parties.roles[name] = role;
          if (!foundNames.has(name)) {
            parties.persons.push({ name, type: 'person', source: 'role_pattern' });
            foundNames.add(name);
          }
        }
      }
    }
    pattern.lastIndex = 0;
  }
  
  // 3. 提取公司/组织名称
  let orgMatch;
  while ((orgMatch = PATTERNS.companyName.exec(content)) !== null) {
    const orgName = orgMatch[1].trim();
    if (orgName.length > 5 && !foundNames.has(orgName)) {
      parties.organizations.push({
        name: orgName,
        type: 'organization',
        source: 'company_pattern'
      });
      foundNames.add(orgName);
    }
  }
  PATTERNS.companyName.lastIndex = 0;
  
  // 4. 从词典匹配已知机构
  for (const org of ORGANIZATION_DICTIONARY) {
    const regex = new RegExp(`\\b${escapeRegex(org)}\\b`, 'gi');
    if (regex.test(content)) {
      if (!parties.organizations.some(o => o.name.toLowerCase() === org.toLowerCase())) {
        parties.organizations.push({
          name: org,
          type: 'organization',
          source: 'dictionary'
        });
      }
    }
  }
  
  // 去重并限制数量
  parties.persons = parties.persons.slice(0, 20);
  parties.organizations = parties.organizations.slice(0, 15);
  
  return parties;
}

/**
 * 验证是否为有效人名
 * @param {string} name - 候选名称
 * @returns {boolean} 是否有效
 */
function isValidName(name) {
  if (!name || name.length < TAGGER_CONFIG.minEntityLength) return false;
  if (name.length > TAGGER_CONFIG.maxEntityLength) return false;
  
  // 检查停用词
  if (STOPWORDS.has(name)) return false;
  
  // 检查是否包含数字或特殊字符
  if (/\d/.test(name)) return false;
  
  // 检查是否全小写（可能不是专有名词）
  if (name === name.toLowerCase()) return false;
  
  // 检查单词数（人名通常2-4个单词）
  const words = name.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  
  return true;
}

/**
 * 提取日期信息
 * @param {string} content - 文本内容
 * @returns {object} 日期列表
 */
function extractDates(content) {
  const dates = {
    fullDates: [],
    years: [],
    hearingDate: null,
    decisionDate: null
  };
  
  // 提取完整日期
  let match;
  while ((match = PATTERNS.fullDate.exec(content)) !== null) {
    dates.fullDates.push(match[0]);
  }
  PATTERNS.fullDate.lastIndex = 0;
  
  // 提取年份
  const yearMatches = content.match(PATTERNS.year) || [];
  const yearCounts = {};
  yearMatches.forEach(y => {
    yearCounts[y] = (yearCounts[y] || 0) + 1;
  });
  dates.years = Object.entries(yearCounts)
    .map(([year, count]) => ({ year: parseInt(year), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  // 尝试提取特定日期（听证日期、裁决日期）
  const datePatterns = [
    { pattern: /date of hearing\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i, type: 'hearing' },
    { pattern: /date of determination\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i, type: 'decision' },
    { pattern: /dated\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i, type: 'document' }
  ];
  
  for (const { pattern, type } of datePatterns) {
    const match = content.match(pattern);
    if (match) {
      if (type === 'hearing') dates.hearingDate = match[1];
      if (type === 'decision') dates.decisionDate = match[1];
    }
  }
  
  return dates;
}

/**
 * 提取关键短语/主题
 * @param {string} content - 文本内容
 * @returns {Array} 关键短语列表
 */
function extractKeyPhrases(content) {
  const phrases = [];
  const contentLower = content.toLowerCase();
  
  // 主题关键词映射
  const topicKeywords = {
    'disciplinary': ['disciplinary', 'sanction', 'penalty', 'fine', 'suspension', 'revocation'],
    'licensing': ['license', 'licence', 'registration', 'regulated activity', 'RO', 'responsible officer'],
    'compliance': ['compliance', 'breach', 'contravention', 'violation', 'code of conduct'],
    'market_misconduct': ['market misconduct', 'insider dealing', 'market manipulation', 'false trading'],
    'appeal_procedure': ['appeal', 'leave to appeal', 'review', 'reconsideration'],
    'costs': ['costs', 'taxation', 'indemnity', 'standard basis']
  };
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    let score = 0;
    for (const keyword of keywords) {
      const matches = contentLower.match(new RegExp(keyword, 'g'));
      if (matches) {
        score += matches.length;
      }
    }
    
    if (score > 0) {
      phrases.push({
        topic,
        score,
        relevance: Math.min(score / 10, 1) // 归一化到 0-1
      });
    }
  }
  
  // 按相关性排序
  phrases.sort((a, b) => b.score - a.score);
  
  return phrases.slice(0, 10);
}

/**
 * 转义正则表达式特殊字符
 * @param {string} string - 字符串
 * @returns {string} 转义后的字符串
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// 批量处理功能
// ============================================

/**
 * 批量标注多个文档
 * @param {Array} documents - 文档数组 [{ id, fileName, content }]
 * @returns {Array} 标注结果数组
 */
function batchTag(documents) {
  console.log(`🚀 开始批量标注 ${documents.length} 个文档...`);
  
  const results = [];
  const startTime = Date.now();
  
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    console.log(`  [${i + 1}/${documents.length}] 标注: ${doc.fileName || doc.originalName}`);
    
    try {
      const tags = tagPDF(doc.content, doc);
      results.push({
        docId: doc.id,
        fileName: doc.fileName || doc.originalName,
        success: true,
        tags
      });
    } catch (error) {
      console.error(`  ❌ 标注失败: ${error.message}`);
      results.push({
        docId: doc.id,
        fileName: doc.fileName || doc.originalName,
        success: false,
        error: error.message
      });
    }
  }
  
  const duration = Date.now() - startTime;
  console.log(`✅ 批量标注完成: ${results.filter(r => r.success).length}/${documents.length} 成功 (${duration}ms)`);
  
  return results;
}

// ============================================
// 导出
// ============================================

module.exports = {
  tagPDF,
  batchTag,
  extractMetadata,
  detectDocumentType,
  extractLegalReferences,
  extractParties,
  extractDates,
  extractKeyPhrases,
  TAGGER_CONFIG,
  PATTERNS,
  DOC_TYPE_KEYWORDS
};