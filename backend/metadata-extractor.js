/**
 * PDF 元数据提取器
 * 从文档内容中提取结构化标签信息
 */

/**
 * 从文件名解析元数据
 * @param {string} fileName - 原始文件名
 * @returns {Object} 解析出的元数据
 */
function parseFileName(fileName) {
  const metadata = {
    tribunal: null,
    year: null,
    caseNumber: null,
    docType: null,
    category: null,
    language: 'EN'
  };

  // 移除扩展名
  const nameWithoutExt = fileName.replace(/\.pdf$/i, '');

  // 识别仲裁机构/法庭
  const tribunalPatterns = [
    { pattern: /\bSFAT\b/i, name: 'SFAT', fullName: 'Securities and Futures Appeals Tribunal' },
    { pattern: /\bSFC\b/i, name: 'SFC', fullName: 'Securities and Futures Commission' },
    { pattern: /\bHKIAC\b/i, name: 'HKIAC', fullName: 'Hong Kong International Arbitration Centre' },
    { pattern: /\bCIETAC\b/i, name: 'CIETAC', fullName: 'China International Economic and Trade Arbitration Commission' },
    { pattern: /\bICC\b/i, name: 'ICC', fullName: 'International Chamber of Commerce' },
    { pattern: /\bLCIA\b/i, name: 'LCIA', fullName: 'London Court of International Arbitration' },
    { pattern: /\bSIAC\b/i, name: 'SIAC', fullName: 'Singapore International Arbitration Centre' },
    { pattern: /\bSCMA\b/i, name: 'SCMA', fullName: 'Shanghai Commercial Mediation and Arbitration Center' }
  ];

  for (const { pattern, name, fullName } of tribunalPatterns) {
    if (pattern.test(nameWithoutExt)) {
      metadata.tribunal = name;
      metadata.tribunalFullName = fullName;
      break;
    }
  }

  // 提取年份和案件编号 (支持多种格式)
  // 格式1: SFAT_2023-2, SFAT 2023-2, SFAT_2023_2
  const yearCasePatterns = [
    /(\d{4})[-_]\s*(\d+)/i,  // 2023-2, 2023_2
    /(\d{4})\s+(\d+)\s*of/i,  // 2023 2 of
    /(?:No\.?\s*)?(\d+)\s+of\s+(\d{4})/i  // 4 of 2022, No. 4 of 2022
  ];

  for (const pattern of yearCasePatterns) {
    const match = nameWithoutExt.match(pattern);
    if (match) {
      // 判断哪个是年份（通常是4位数）
      if (match[1].length === 4) {
        metadata.year = parseInt(match[1]);
        metadata.caseNumber = match[2];
      } else if (match[2].length === 4) {
        metadata.year = parseInt(match[2]);
        metadata.caseNumber = match[1];
      }
      break;
    }
  }

  // 识别文档类型
  const docTypePatterns = [
    { pattern: /\bRuling\b/i, type: 'Ruling', category: 'Interlocutory' },
    { pattern: /\bDetermination\b/i, type: 'Determination', category: 'Final' },
    { pattern: /\bDecision\b/i, type: 'Decision', category: 'Interlocutory' },
    { pattern: /\bCosts\b/i, type: 'Costs', category: 'Procedural' },
    { pattern: /\bApplication\b/i, type: 'Application', category: 'Procedural' },
    { pattern: /\bOrder\b/i, type: 'Order', category: 'Interlocutory' },
    { pattern: /\bJudgment\b/i, type: 'Judgment', category: 'Final' },
    { pattern: /\bAward\b/i, type: 'Award', category: 'Final' },
    { pattern: /\bReasons\b/i, type: 'Reasons', category: 'Final' }
  ];

  for (const { pattern, type, category } of docTypePatterns) {
    if (pattern.test(nameWithoutExt)) {
      metadata.docType = type;
      metadata.category = category;
      break;
    }
  }

  // 识别语言
  if (/[_-]CN[_-]?|[_-]ZH[_-]?|Chinese/i.test(nameWithoutExt)) {
    metadata.language = 'CN';
  } else if (/[_-]EN[_-]?|[_-]ENG[_-]?|English/i.test(nameWithoutExt)) {
    metadata.language = 'EN';
  }

  return metadata;
}

/**
 * 从文档内容提取元数据
 * @param {string} content - 文档文本内容
 * @returns {Object} 提取的元数据
 */
function extractFromContent(content) {
  const metadata = {
    title: null,
    caseName: null,
    parties: {
      applicants: [],
      respondents: [],
      appellants: [],
      defendants: []
    },
    tribunal: null,
    tribunalMembers: [],
    date: null,
    caseNumber: null,
    subjectMatter: [],
    keyIssues: [],
    legalReferences: [],
    documentType: null
  };

  if (!content || content.length < 100) {
    return metadata;
  }

  // 提取标题（通常在文档开头）
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 查找案件名称（BETWEEN ... AND ... 格式）
  const betweenMatch = content.match(/BETWEEN\s+([\s\S]{0,500}?)\s+AND\s+([\s\S]{0,500}?)(?:\n|Tribunal|Date)/i);
  if (betweenMatch) {
    metadata.parties.applicants.push(cleanPartyName(betweenMatch[1]));
    metadata.parties.respondents.push(cleanPartyName(betweenMatch[2]));
    metadata.caseName = `${cleanPartyName(betweenMatch[1])} v ${cleanPartyName(betweenMatch[2])}`;
  }

  // 查找申请人/被告（Applicant/Respondent/Appellant/Defendant）
  const partyPatterns = [
    { pattern: /([A-Z][A-Z\s,.'&]+?)\s+(?:Applicant|Appellant|Petitioner)/gi, type: 'applicants' },
    { pattern: /([A-Z][A-Z\s,.'&]+?)\s+(?:Respondent|Defendant|Respondents)/gi, type: 'respondents' }
  ];

  for (const { pattern, type } of partyPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = cleanPartyName(match[1]);
      if (name && !metadata.parties[type].includes(name)) {
        metadata.parties[type].push(name);
      }
    }
  }

  // 提取仲裁庭成员
  const tribunalMatch = content.match(/Tribunal:\s*([^\n]+)/i);
  if (tribunalMatch) {
    const members = tribunalMatch[1].split(/,|and/i).map(m => m.trim()).filter(m => m.length > 3);
    metadata.tribunalMembers = members;
  }

  // 提取日期
  const datePatterns = [
    /Date of (?:Ruling|Decision|Determination|Judgment|Order):\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    /dated\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i
  ];

  for (const pattern of datePatterns) {
    const match = content.match(pattern);
    if (match) {
      metadata.date = match[1];
      break;
    }
  }

  // 提取案件编号
  const caseNumberPatterns = [
    /Application No\.?\s*(\d+)\s+of\s+(\d{4})/i,
    /Case No\.?\s*:?\s*([A-Z]*\s*\d+[\/\-]?\d*)/i,
    /SFAT\s+(\d{4})[\/-](\d+)/i
  ];

  for (const pattern of caseNumberPatterns) {
    const match = content.match(pattern);
    if (match) {
      if (match[2] && match[2].length === 4) {
        metadata.caseNumber = `${match[1]} of ${match[2]}`;
      } else {
        metadata.caseNumber = match[1];
      }
      break;
    }
  }

  // 提取法律引用
  const legalRefPatterns = [
    /section\s+(\d+)\s+of\s+the\s+([^,]+?)(?:,|\(|\n|$)/gi,
    /sections\s+(\d+)\s+and\s+(\d+)\s+of\s+the\s+([^,]+?)(?:,|\(|\n|$)/gi,
    /Cap\.?\s*(\d+)/gi
  ];

  const legalRefs = new Set();
  let match;
  
  while ((match = legalRefPatterns[0].exec(content)) !== null) {
    legalRefs.add(`Section ${match[1]} of the ${match[2].trim()}`);
  }
  
  while ((match = legalRefPatterns[1].exec(content)) !== null) {
    legalRefs.add(`Sections ${match[1]} and ${match[2]} of the ${match[3].trim()}`);
  }
  
  while ((match = legalRefPatterns[2].exec(content)) !== null) {
    legalRefs.add(`Cap. ${match[1]}`);
  }

  metadata.legalReferences = [...legalRefs].slice(0, 20); // 限制数量

  // 识别关键议题
  const issueKeywords = [
    { keyword: /confidentiality|confidential/i, issue: 'Confidentiality' },
    { keyword: /costs?|assessment of costs/i, issue: 'Costs' },
    { keyword: /evidence|witness|testimony/i, issue: 'Evidence' },
    { keyword: /jurisdiction|power to|remit/i, issue: 'Jurisdiction' },
    { keyword: /prejudice|fairness|natural justice/i, issue: 'Fairness' },
    { keyword: /relevance|relevant|material/i, issue: 'Relevance' },
    { keyword: /disclosure|production|notice/i, issue: 'Disclosure' },
    { keyword: /disciplinary|sanction|penalty/i, issue: 'Disciplinary' },
    { keyword: /review|appeal|determination/i, issue: 'Review' },
    { keyword: /hearing|oral|submissions/i, issue: 'Hearing Procedure' }
  ];

  for (const { keyword, issue } of issueKeywords) {
    if (keyword.test(content)) {
      if (!metadata.keyIssues.includes(issue)) {
        metadata.keyIssues.push(issue);
      }
    }
  }

  // 识别文档类型（从内容）
  const contentTypePatterns = [
    { pattern: /RULING/i, type: 'Ruling' },
    { pattern: /DETERMINATION/i, type: 'Determination' },
    { pattern: /DECISION/i, type: 'Decision' },
    { pattern: /ORDER/i, type: 'Order' },
    { pattern: /JUDGMENT/i, type: 'Judgment' },
    { pattern: /AWARD/i, type: 'Award' }
  ];

  for (const { pattern, type } of contentTypePatterns) {
    if (pattern.test(content.substring(0, 2000))) { // 只检查前2000字符
      metadata.documentType = type;
      break;
    }
  }

  return metadata;
}

/**
 * 清理当事人名称
 * @param {string} name - 原始名称
 * @returns {string} 清理后的名称
 */
function cleanPartyName(name) {
  return name
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s*,\s*$/, '')
    .replace(/^\s+|\s+$/g, '')
    .substring(0, 100); // 限制长度
}

/**
 * 生成完整的标签对象
 * @param {Object} fileInfo - 文件信息
 * @param {string} content - 文档内容
 * @returns {Object} 完整的标签对象
 */
function generateTags(fileInfo, content) {
  // 从文件名解析
  const fileMetadata = parseFileName(fileInfo.originalName || fileInfo.fileName);
  
  // 从内容提取
  const contentMetadata = extractFromContent(content);

  // 合并元数据（内容提取的优先级更高）
  const merged = {
    // 基础标识信息
    identify: {
      caseNumber: contentMetadata.caseNumber || fileMetadata.caseNumber || null,
      year: fileMetadata.year || (contentMetadata.date ? parseInt(contentMetadata.date.match(/\d{4}/)?.[0]) : null),
      tribunal: fileMetadata.tribunal || contentMetadata.tribunal || fileInfo.category || null,
      tribunalFullName: fileMetadata.tribunalFullName || null,
      caseName: contentMetadata.caseName || null,
      language: fileMetadata.language || 'EN'
    },

    // 文档分类
    classification: {
      docType: contentMetadata.documentType || fileMetadata.docType || 'Unknown',
      category: fileMetadata.category || 'General',
      isInterlocutory: fileMetadata.category === 'Interlocutory' || /interlocutory/i.test(content),
      isFinal: fileMetadata.category === 'Final' || /final determination/i.test(content),
      isProcedural: fileMetadata.category === 'Procedural'
    },

    // 当事人信息
    parties: {
      applicants: contentMetadata.parties.applicants,
      respondents: contentMetadata.parties.respondents,
      allParties: [
        ...contentMetadata.parties.applicants,
        ...contentMetadata.parties.respondents
      ]
    },

    // 程序信息
    procedure: {
      date: contentMetadata.date,
      tribunalMembers: contentMetadata.tribunalMembers,
      legalReferences: contentMetadata.legalReferences
    },

    // 主题内容
    subject: {
      keyIssues: contentMetadata.keyIssues,
      summary: generateSummary(content)
    },

    // 来源信息
    source: {
      fileName: fileInfo.originalName,
      extractedAt: new Date().toISOString(),
      confidence: calculateConfidence(fileMetadata, contentMetadata)
    }
  };

  return merged;
}

/**
 * 生成文档摘要
 * @param {string} content - 文档内容
 * @returns {string} 摘要
 */
function generateSummary(content) {
  if (!content || content.length < 200) return null;
  
  // 取前500字符作为摘要
  const firstPara = content.substring(0, 500).replace(/\s+/g, ' ').trim();
  return firstPara + (content.length > 500 ? '...' : '');
}

/**
 * 计算置信度分数
 * @param {Object} fileMetadata - 文件元数据
 * @param {Object} contentMetadata - 内容元数据
 * @returns {number} 置信度 (0-1)
 */
function calculateConfidence(fileMetadata, contentMetadata) {
  let score = 0;
  let total = 0;

  // 文件名提供了多少信息
  if (fileMetadata.tribunal) { score += 1; total += 1; }
  if (fileMetadata.year) { score += 1; total += 1; }
  if (fileMetadata.docType) { score += 1; total += 1; }

  // 内容提供了多少信息
  if (contentMetadata.caseNumber) { score += 1; total += 1; }
  if (contentMetadata.parties.applicants.length > 0) { score += 1; total += 1; }
  if (contentMetadata.date) { score += 1; total += 1; }
  if (contentMetadata.keyIssues.length > 0) { score += 1; total += 1; }

  return total > 0 ? Math.round((score / total) * 100) / 100 : 0;
}

/**
 * 批量处理所有文档并添加标签
 * @param {Array} files - 文件列表
 * @returns {Array} 带标签的文件列表
 */
function batchTagDocuments(files) {
  return files.map(file => {
    if (file.status === 'deleted') return file;
    
    try {
      const tags = generateTags(file, file.content || '');
      return {
        ...file,
        tags,
        taggedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`标注失败 ${file.originalName}:`, error.message);
      return file;
    }
  });
}

/**
 * 构建过滤查询
 * @param {Object} filters - 过滤条件
 * @returns {Function} 过滤函数
 */
function buildFilterQuery(filters) {
  return (file) => {
    if (!file.tags) return false;

    const { identify, classification } = file.tags;

    // 按案件编号过滤
    if (filters.caseNumber && identify?.caseNumber) {
      if (!identify.caseNumber.toLowerCase().includes(filters.caseNumber.toLowerCase())) {
        return false;
      }
    }

    // 按年份过滤
    if (filters.year && identify?.year) {
      if (identify.year !== parseInt(filters.year)) {
        return false;
      }
    }

    // 按仲裁机构过滤
    if (filters.tribunal && identify?.tribunal) {
      if (identify.tribunal.toLowerCase() !== filters.tribunal.toLowerCase()) {
        return false;
      }
    }

    // 按文档类型过滤
    if (filters.docType && classification?.docType) {
      if (classification.docType.toLowerCase() !== filters.docType.toLowerCase()) {
        return false;
      }
    }

    // 按类别过滤 (Interlocutory/Final/Procedural)
    if (filters.category && classification?.category) {
      if (classification.category.toLowerCase() !== filters.category.toLowerCase()) {
        return false;
      }
    }

    // 按当事人过滤
    if (filters.party && file.tags.parties?.allParties) {
      const hasParty = file.tags.parties.allParties.some(p => 
        p.toLowerCase().includes(filters.party.toLowerCase())
      );
      if (!hasParty) return false;
    }

    // 按议题过滤
    if (filters.issue && file.tags.subject?.keyIssues) {
      const hasIssue = file.tags.subject.keyIssues.some(i =>
        i.toLowerCase().includes(filters.issue.toLowerCase())
      );
      if (!hasIssue) return false;
    }

    return true;
  };
}

module.exports = {
  parseFileName,
  extractFromContent,
  generateTags,
  batchTagDocuments,
  buildFilterQuery
};
