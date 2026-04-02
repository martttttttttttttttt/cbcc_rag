/**
 * ClawText PDF 结构化标注模块
 * 
 * 功能：给提取的文本打 "标签"，让检索引擎能按维度筛选
 * 
 * 核心标注维度：
 * 1. 文件名 / 案件编号 - 从PDF文件名提取
 * 2. 发布年份 - 从文件名/文本中提取
 * 3. 文档类型 - 关键词匹配（Ruling/Interlocutory/Costs等）
 * 4. 法条编号 - 正则提取（section \d+(\(\d+\))?）
 * 5. 当事人/机构 - 实体识别（人名、机构名）
 */

const fs = require('fs');
const path = require('path');

// ============================================
// 配置
// ============================================
const ANNOTATOR_CONFIG = {
  // 启用哪些标注维度
  enableCaseNumber: true,
  enableYear: true,
  enableDocType: true,
  enableLegalProvisions: true,
  enableEntities: true,
  
  // 实体识别模式（简化版NER，无需外部依赖）
  entityPatterns: {
    // 人名模式（大写开头的连续单词）
    person: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g,
    // 机构名模式
    organization: /\b(?:Securities and Futures Commission|SFC|SFAT|MMT|Hong Kong Stock Exchange|HKEX)\b/gi,
    // 日期模式
    date: /\b\d{4}[-/]\d{2}[-/]\d{2}\b/g
  }
};

// ============================================
// 文档类型关键词映射
// ============================================
const DOC_TYPE_KEYWORDS = {
  'Determination': ['determination', '裁决'],
  'Ruling': ['ruling', '裁定'],
  'Interlocutory': ['interlocutory', '中间申请', 'interim'],
  'Costs': ['costs', '费用', 'fee', 'expense'],
  'Reasons': ['reasons for determination', '判决理由', 'reasons'],
  'Notice': ['notice', '通知', '公告'],
  'Decision': ['decision', '决定'],
  'Judgment': ['judgment', '判决']
};

// ============================================
// 主要导出函数
// ============================================

/**
 * 主标注函数：对PDF内容进行全面标注
 * @param {string} fileName - PDF文件名
 * @param {string} content - PDF文本内容
 * @param {object} options - 配置选项
 * @returns {object} 标注结果
 */
function annotateDocument(fileName, content, options = {}) {
  const config = { ...ANNOTATOR_CONFIG, ...options };
  
  console.log(`🏷️ [结构化标注] 开始标注: ${fileName}`);
  const startTime = Date.now();
  
  const annotations = {
    // 基础信息
    fileName: fileName,
    originalName: fileName,
    
    // 案件编号
    caseNumber: config.enableCaseNumber ? extractCaseNumber(fileName) : null,
    
    // 发布年份
    year: config.enableYear ? extractYear(fileName, content) : null,
    
    // 文档类型
    docType: config.enableDocType ? extractDocType(fileName, content) : null,
    
    // 法条编号
    legalProvisions: config.enableLegalProvisions ? extractLegalProvisions(content) : [],
    
    // 当事人/机构
    entities: config.enableEntities ? extractEntities(content) : {
      persons: [],
      organizations: [],
      dates: []
    },
    
    // 统计信息
    stats: {
      processingTimeMs: 0,
      totalAnnotations: 0
    }
  };
  
  // 计算统计
  annotations.stats.processingTimeMs = Date.now() - startTime;
  annotations.stats.totalAnnotations = 
    (annotations.caseNumber ? 1 : 0) +
    (annotations.year ? 1 : 0) +
    (annotations.docType ? 1 : 0) +
    annotations.legalProvisions.length +
    annotations.entities.persons.length +
    annotations.entities.organizations.length;
  
  console.log(`✅ [结构化标注] 完成！耗时 ${annotations.stats.processingTimeMs}ms`);
  console.log(`   📋 案件编号: ${annotations.caseNumber || 'N/A'}`);
  console.log(`   📅 年份: ${annotations.year || 'N/A'}`);
  console.log(`   📄 文档类型: ${annotations.docType || 'N/A'}`);
  console.log(`   ⚖️ 法条数: ${annotations.legalProvisions.length}`);
  console.log(`   👤 当事人: ${annotations.entities.persons.length} 个`);
  console.log(`   🏢 机构: ${annotations.entities.organizations.length} 个`);
  
  return annotations;
}

// ============================================
// 各维度提取函数
// ============================================

/**
 * 提取案件编号
 * 从文件名提取，如 SFAT_2021-5.pdf → 2021-5
 * @param {string} fileName - PDF文件名
 * @returns {string|null} 案件编号
 */
function extractCaseNumber(fileName) {
  // 移除扩展名
  const nameWithoutExt = fileName.replace(/\.pdf$/i, '');
  
  // 尝试多种模式匹配
  const patterns = [
    // SFAT_2021-5, SFAT 2021-5, SFAT-2021-5
    /SFAT[_\s-]?(\d{4}-\d+)/i,
    // SFAT4, SFAT 4
    /SFAT[_\s-]?(\d+)/i,
    // MMT_xxx, AN-xxx
    /(?:MMT|AN)[-_]?(\d+-\d+)/i,
    // 通用数字-数字格式
    /(\d{4}-\d+)/,
    // 括号内的编号
    /\((\d{4}[^)]*)\)/
  ];
  
  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * 提取发布年份
 * 从文件名或文本中提取
 * @param {string} fileName - PDF文件名
 * @param {string} content - PDF文本内容
 * @returns {number|null} 年份
 */
function extractYear(fileName, content) {
  // 优先从文件名提取
  const fileNamePatterns = [
    /(\d{4})[-_]\d+/,
    /(\d{4})(?=.*\.pdf$)/i
  ];
  
  for (const pattern of fileNamePatterns) {
    const match = fileName.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      if (year >= 2000 && year <= 2030) {
        return year;
      }
    }
  }
  
  // 从文本内容提取日期
  if (content) {
    // 查找常见日期格式
    const datePatterns = [
      /(\d{4})[-/]\d{2}[-/]\d{2}/g,  // 2021-06-02, 2021/06/02
      /(\d{4})年\d{1,2}月\d{1,2}日/g,  // 2021年6月2日
      /dated?\s+(\d{1,2})\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi
    ];
    
    const years = [];
    
    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const year = parseInt(match[1]);
        if (year >= 2000 && year <= 2030) {
          years.push(year);
        }
      }
    }
    
    // 返回最常见的年份
    if (years.length > 0) {
      const yearCounts = {};
      years.forEach(y => {
        yearCounts[y] = (yearCounts[y] || 0) + 1;
      });
      
      return Object.entries(yearCounts)
        .sort((a, b) => b[1] - a[1])[0][0];
    }
  }
  
  return null;
}

/**
 * 提取文档类型
 * 通过关键词匹配
 * @param {string} fileName - PDF文件名
 * @param {string} content - PDF文本内容
 * @returns {string|null} 文档类型
 */
function extractDocType(fileName, content) {
  const textToCheck = (fileName + ' ' + (content || '').substring(0, 5000)).toLowerCase();
  
  const typeScores = {};
  
  for (const [type, keywords] of Object.entries(DOC_TYPE_KEYWORDS)) {
    typeScores[type] = 0;
    
    for (const keyword of keywords) {
      const regex = new RegExp(keyword.toLowerCase(), 'g');
      const matches = textToCheck.match(regex);
      if (matches) {
        typeScores[type] += matches.length;
      }
    }
  }
  
  // 找出得分最高的类型
  let bestType = null;
  let maxScore = 0;
  
  for (const [type, score] of Object.entries(typeScores)) {
    if (score > maxScore) {
      maxScore = score;
      bestType = type;
    }
  }
  
  // 需要至少匹配一次才算有效
  return maxScore > 0 ? bestType : null;
}

/**
 * 提取法条编号
 * 使用正则表达式提取 section \d+(\(\d+\))?
 * @param {string} content - PDF文本内容
 * @returns {Array} 法条编号列表
 */
function extractLegalProvisions(content) {
  if (!content) return [];
  
  const provisions = new Set();
  
  // 法条编号正则模式
  const patterns = [
    // section 194(1)(b), section 204, s. 194(1)
    /\b(?:section|s\.?)\s*(\d+(?:\s*\([^)]+\))*)/gi,
    // Article 12, Art. 12
    /\b(?:article|art\.?)\s*(\d+(?:\s*\([^)]+\))*)/gi,
    // Regulation 5(2)
    /\b(?:regulation|reg\.?)\s*(\d+(?:\s*\([^)]+\))*)/gi,
    // Rule 7(a)
    /\b(?:rule|r\.?)\s*(\d+(?:\s*\([^)]+\))*)/gi,
    // Ordinance Cap. 571
    /\b(?:ordinance|cap\.?)\s*(\d+[A-Z]*)/gi,
    // SFO Section XXX
    /SFO\s+(?:section|s\.?)\s*(\d+)/gi
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      // 标准化格式
      let provision = match[0]
        .replace(/\s+/g, ' ')  // 规范化空格
        .trim()
        .toLowerCase();
      
      // 清理并标准化
      provision = provision
        .replace(/\s+/g, ' ')  // 规范化空格
        .trim()
        .toLowerCase();
      
      // 统一为 "section X" 格式
      provision = provision
        .replace(/^s\.\s*/i, 'section ')
        .replace(/^s\s+/i, 'section ')
        .replace(/^art\.\s*/i, 'article ')
        .replace(/^reg\.\s*/i, 'regulation ')
        .replace(/^r\.\s*/i, 'rule ')
        .replace(/^cap\.\s*/i, 'cap ');
      
      provisions.add(provision);
    }
  }
  
  // 去重并排序
  return Array.from(provisions).slice(0, 50);  // 最多50个
}

/**
 * 提取实体（人名、机构、日期）
 * 简化版NER，无需外部依赖
 * @param {string} content - PDF文本内容
 * @returns {object} 实体列表
 */
function extractEntities(content) {
  if (!content) {
    return { persons: [], organizations: [], dates: [] };
  }
  
  const entities = {
    persons: new Set(),
    organizations: new Set(),
    dates: new Set()
  };
  
  // 提取人名（基于上下文启发式规则）
  // 模式：Mr./Ms./Mrs. + 名字，或在特定上下文中出现的大写名称
  const personPatterns = [
    // Mr. Calvin Choi, Ms. Jane Doe
    /\b(?:Mr|Ms|Mrs|Dr|Prof)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
    // Appellant: XXX, Respondent: XXX
    /(?:Appellant|Respondent|Applicant|Defendant)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    // Tribunal/Members: XXX
    /(?:Tribunal|Members?|Panel)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi
  ];
  
  for (const pattern of personPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1].trim();
      // 过滤掉常见的非人名词
      if (name.length > 2 && 
          !/^(The|This|That|These|Those|Securities|Futures|Commission|Tribunal|Court)$/i.test(name)) {
        entities.persons.add(name);
      }
    }
  }
  
  // 提取机构名
  const orgPatterns = [
    // Securities and Futures Commission
    /\b(Securities and Futures Commission)\b/gi,
    // SFAT
    /\b(Securities and Futures Appeal Tribunal)\b/gi,
    // SFC
    /\b(SFC)\b/g,
    // SFAT
    /\b(SFAT)\b/g,
    // MMT
    /\b(Market Misconduct Tribunal)\b/gi,
    // Hong Kong Stock Exchange
    /\b(Hong Kong Stock Exchange|HKEX)\b/gi,
    // Law firms
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:LLP|Law Firm|& Co))/g
  ];
  
  for (const pattern of orgPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      entities.organizations.add(match[1].trim());
    }
  }
  
  // 提取日期
  const datePatterns = [
    /\b(\d{4}[-/]\d{2}[-/]\d{2})\b/g,
    /\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi
  ];
  
  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      entities.dates.add(match[1].trim());
    }
  }
  
  return {
    persons: Array.from(entities.persons).slice(0, 20),
    organizations: Array.from(entities.organizations).slice(0, 10),
    dates: Array.from(entities.dates).slice(0, 20)
  };
}

// ============================================
// 辅助函数
// ============================================

/**
 * 生成搜索过滤器
 * 用于前端按维度筛选
 * @param {object} annotations - 标注结果
 * @returns {object} 搜索过滤器
 */
function generateSearchFilters(annotations) {
  return {
    caseNumber: annotations.caseNumber,
    year: annotations.year,
    docType: annotations.docType,
    legalProvisions: annotations.legalProvisions,
    parties: annotations.entities.persons,
    organizations: annotations.entities.organizations
  };
}

/**
 * 批量标注多个文档
 * @param {Array} documents - 文档数组 [{fileName, content}]
 * @returns {Array} 标注结果数组
 */
function batchAnnotate(documents) {
  console.log(`📚 [批量标注] 开始处理 ${documents.length} 个文档...`);
  
  const results = documents.map((doc, index) => {
    console.log(`  [${index + 1}/${documents.length}] ${doc.fileName}`);
    return annotateDocument(doc.fileName, doc.content);
  });
  
  // 生成统计
  const stats = {
    totalDocuments: documents.length,
    withCaseNumber: results.filter(r => r.caseNumber).length,
    withYear: results.filter(r => r.year).length,
    withDocType: results.filter(r => r.docType).length,
    totalProvisions: results.reduce((sum, r) => sum + r.legalProvisions.length, 0),
    totalPersons: results.reduce((sum, r) => sum + r.entities.persons.length, 0),
    docTypeDistribution: {}
  };
  
  // 文档类型分布
  results.forEach(r => {
    if (r.docType) {
      stats.docTypeDistribution[r.docType] = 
        (stats.docTypeDistribution[r.docType] || 0) + 1;
    }
  });
  
  console.log(`✅ [批量标注] 完成！`);
  console.log(`   📊 有案件编号: ${stats.withCaseNumber}/${stats.totalDocuments}`);
  console.log(`   📊 有年份: ${stats.withYear}/${stats.totalDocuments}`);
  console.log(`   📊 有文档类型: ${stats.withDocType}/${stats.totalDocuments}`);
  console.log(`   📊 总法条数: ${stats.totalProvisions}`);
  console.log(`   📊 总当事人: ${stats.totalPersons}`);
  
  return { results, stats };
}

// ============================================
// 导出
// ============================================
module.exports = {
  annotateDocument,
  batchAnnotate,
  generateSearchFilters,
  extractCaseNumber,
  extractYear,
  extractDocType,
  extractLegalProvisions,
  extractEntities
};
