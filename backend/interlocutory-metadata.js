/**
 * Interlocutory Applications 专用元数据提取器
 * 针对香港证券及期货事务上诉审裁处(SFAT)的中期申请案例
 */

// Interlocutory Application 类型定义 - 按类别组织
const INTERLOCUTORY_TYPES = {
  // ========== 证据相关 (Evidence) ==========
  WITNESS_STATEMENT_ADMISSION: {
    keywords: [
      'admission of witness statements', 'witness statement admission', 'admit witness statement',
      '接纳证人陈述', '证人陈述接纳'
    ],
    category: 'Evidence',
    subCategory: 'Witness Statement Admission',
    description: 'Admission of Witness Statements'
  },
  
  EXPERT_TESTIMONY: {
    keywords: [
      'expert testimonies', 'expert testimony', 'expert witness', 'expert evidence',
      'rejection of expert', 'expert report',
      '专家证言', '专家证人', '专家报告', '专家证据'
    ],
    category: 'Evidence',
    subCategory: 'Expert Testimony',
    description: 'Expert Testimony and Evidence'
  },
  
  EXPUNGE_WITNESS_STATEMENT: {
    keywords: [
      'expunge witness statement', 'strike out witness statement', 'remove witness statement',
      '剔除证言', '删除证人陈述', '剔除证人证词'
    ],
    category: 'Evidence',
    subCategory: 'Expunge Witness Statement',
    description: 'Expunging/Removing Witness Statements'
  },
  
  CONFIDENTIALITY_AGREEMENT: {
    keywords: [
      'confidentiality agreement', 'confidentiality order', 'protective order',
      '保密协议', '保密令', '保护令'
    ],
    category: 'Evidence',
    subCategory: 'Confidentiality Agreement',
    description: 'Confidentiality Agreements and Orders'
  },
  
  EVIDENTIARY_ISSUE: {
    keywords: [
      'evidentiary issue', 'evidence issue', 'admissibility', 'admissible evidence',
      'inadmissible', 'evidence ruling',
      '证据争议', '证据问题', '可采性', '证据裁决'
    ],
    category: 'Evidence',
    subCategory: 'Evidentiary Issue',
    description: 'General Evidentiary Issues'
  },
  
  // ========== 程序相关 (Procedural) ==========
  IN_CAMERA: {
    keywords: [
      'in camera', 'closed hearing', 'private hearing', 'hearing in private',
      '非公开聆讯', '闭门聆讯', '不公开审理'
    ],
    category: 'Procedural',
    subCategory: 'In Camera',
    description: 'In Camera (Non-Public) Hearings'
  },
  
  ANONYMITY_APPLICATION: {
    keywords: [
      'anonymity application', 'anonymity order', 'pseudonym', 'name suppression',
      '匿名申请', '匿名令', '姓名保密'
    ],
    category: 'Procedural',
    subCategory: 'Anonymity Application',
    description: 'Anonymity Applications'
  },
  
  PROCEDURAL_MATTER: {
    keywords: [
      'procedural matter', 'case management', 'directions', 'timetable', 'extension',
      'adjournment', 'stay', 'procedural directions',
      '程序事项', '案件管理', '程序指示', '延期', '休庭'
    ],
    category: 'Procedural',
    subCategory: 'Procedural Matter',
    description: 'General Procedural Matters'
  },
  
  INTERIM_RULING: {
    keywords: [
      'interim ruling', 'interim order', 'interim decision', 'preliminary ruling',
      '临时裁定', '中期裁定', '初步裁定'
    ],
    category: 'Procedural',
    subCategory: 'Interim Ruling',
    description: 'Interim Rulings and Orders'
  },
  
  // ========== 资产冻结相关 (Asset Freeze) ==========
  ASSET_FREEZE_NOTICE: {
    keywords: [
      'asset-freeze notice', 'asset freeze notice', 'freezing notice',
      '资产冻结通知', '冻结通知'
    ],
    category: 'Asset Freeze',
    subCategory: 'Asset-Freeze Notice',
    description: 'Asset-Freezing Notices'
  },
  
  ACCOUNT_FREEZE: {
    keywords: [
      'account freeze', 'freeze account', 'bank account freeze', 'freezing order',
      '账户冻结', '银行户口冻结', '冻结令'
    ],
    category: 'Asset Freeze',
    subCategory: 'Account Freeze',
    description: 'Bank Account Freezing Orders'
  },
  
  SFC_POWERS_204_205: {
    keywords: [
      'section 204', 'section 205', 's.204', 's.205', 'sfo section 204', 'sfo section 205',
      'securities and futures ordinance section 204', 'securities and futures ordinance section 205',
      '证监会 204 条', '证监会 205 条', '证券及期货条例 204', '证券及期货条例 205'
    ],
    category: 'Asset Freeze',
    subCategory: 'SFC Powers Sections 204/205',
    description: 'SFC Powers under SFO Sections 204/205'
  },
  
  // ========== 讼费相关 (Costs) ==========
  COSTS_ASSESSMENT: {
    keywords: [
      'costs', 'assessment of costs', 'costs order', 'party and party costs',
      'indemnity costs', 'standard basis', '讼费', '费用评估', '讼费命令'
    ],
    category: 'Costs',
    subCategory: 'Costs Assessment',
    description: 'Costs Assessment and Orders'
  },
  
  WITHDRAWAL_INTERLOCUTORY: {
    keywords: [
      'withdrew interlocutory application', 'withdraw interlocutory', 'withdrawal of application',
      '撤回中间申请', '撤回申请', '撤销申请'
    ],
    category: 'Costs',
    subCategory: 'Withdrawal',
    description: 'Withdrawal of Interlocutory Applications'
  }
};

// 排除特征 - 用于识别非 Interlocutory 文档
const EXCLUSION_PATTERNS = {
  finalDetermination: {
    keywords: [
      'final determination', 'final decision', 'merits of the case', 'substantive hearing',
      '最终裁决', '实体审理', '实质判决'
    ],
    weight: -10
  },
  disciplinaryActions: {
    keywords: [
      'disciplinary actions', 'sanction', 'penalty', 'fine', 'reprimand', 'suspension',
      '纪律处分', '处罚', '罚款', '谴责', '停牌'
    ],
    weight: -8
  },
  appealDecision: {
    keywords: [
      'appeal allowed', 'appeal dismissed', 'uphold the decision', 'overturn',
      '上诉得直', '上诉驳回', '维持原判', '推翻'
    ],
    weight: -5
  }
};

// 月份映射
const MONTH_MAP = {
  'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
  'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
  'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12
};

// SFAT 特定模式识别
const SFAT_PATTERNS = {
  caseNumber: /SFAT[\s_-]*(\d{4})[\s_-]*(\d+)/i,
  yearPattern: /(20\d{2})/g,
  applicantName: /applicant[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
  respondent: /SFC|Securities and Futures Commission/i
};

/**
 * 从内容中提取日期
 * 支持多种格式：6 March 2025, March 6, 2025, 06/03/2025, 2025年3月6日
 */
function extractDateFromContent(content) {
  const dates = [];
  
  // 格式1: 6 March 2025 或 6th March 2025
  const datePattern1 = /(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi;
  let match;
  while ((match = datePattern1.exec(content)) !== null) {
    const day = parseInt(match[1]);
    const month = MONTH_MAP[match[2].toLowerCase()];
    const year = parseInt(match[3]);
    if (month && year >= 2000 && year <= 2100) {
      dates.push({ day, month, year, original: match[0], format: 'd MMMM yyyy' });
    }
  }
  
  // 格式2: March 6, 2025
  const datePattern2 = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(\d{4})/gi;
  while ((match = datePattern2.exec(content)) !== null) {
    const month = MONTH_MAP[match[1].toLowerCase()];
    const day = parseInt(match[2]);
    const year = parseInt(match[3]);
    if (month && year >= 2000 && year <= 2100) {
      dates.push({ day, month, year, original: match[0], format: 'MMMM d, yyyy' });
    }
  }
  
  // 格式3: DD/MM/YYYY 或 DD-MM-YYYY
  const datePattern3 = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/g;
  while ((match = datePattern3.exec(content)) !== null) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);
    if (day <= 31 && month <= 12 && year >= 2000 && year <= 2100) {
      dates.push({ day, month, year, original: match[0], format: 'dd/mm/yyyy' });
    }
  }
  
  // 格式4: YYYY年MM月DD日 (中文)
  const datePattern4 = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g;
  while ((match = datePattern4.exec(content)) !== null) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    if (day <= 31 && month <= 12 && year >= 2000 && year <= 2100) {
      dates.push({ day, month, year, original: match[0], format: 'yyyy年mm月dd日' });
    }
  }
  
  return dates;
}

/**
 * 判断文档是否为 SFAT 相关文档
 */
function isSFATDocument(filename, content) {
  const filenameLower = filename.toLowerCase();
  const contentSample = content.substring(0, 5000).toLowerCase();
  
  // 检查文件名中的 SFAT 标识
  const hasSFATInFilename = /sfat|securities and futures appeal tribunal/i.test(filename);
  
  // 检查内容中的 SFAT 标识
  const hasSFATInContent = /securities and futures appeal tribunal|sfat tribunal|上诉审裁处/i.test(contentSample);
  
  // 检查案号模式
  const hasCaseNumber = /SFAT[\s_-]*\d{4}[\s_-]*\d+/i.test(filename) || 
                        /SFAT[\s_-]*\d{4}[\s_-]*\d+/i.test(content);
  
  // 检查是否包含 Tribunal/Tribunal 相关内容
  const hasTribunalContent = /tribunal|审裁处/i.test(contentSample);
  
  return hasSFATInFilename || hasSFATInContent || hasCaseNumber || hasTribunalContent;
}

/**
 * 判断文档类型（Ruling/Determination/Costs Decision等）
 */
function detectDocumentType(filename, content) {
  const filenameLower = filename.toLowerCase();
  const contentSample = content.substring(0, 3000).toLowerCase();
  
  // Ruling 检测
  if (/ruling|裁定/i.test(filenameLower) || /ruling|裁定/i.test(contentSample)) {
    return { type: 'Ruling', isInterlocutory: true };
  }
  
  // Costs Decision/Order 检测
  if (/costs|decision on costs|讼费/i.test(filenameLower) || 
      /costs?\s+(order|decision|assessment)|讼费/i.test(contentSample)) {
    return { type: 'Costs Decision', isInterlocutory: true };
  }
  
  // Determination 检测（可能是最终裁决，需要进一步判断）
  if (/determination|裁决/i.test(filenameLower) || /determination|裁决/i.test(contentSample)) {
    // 检查是否为 interim/preliminary
    if (/interim|preliminary|interlocutory|中期|初步/i.test(contentSample)) {
      return { type: 'Interim Determination', isInterlocutory: true };
    }
    // 否则可能是最终裁决
    return { type: 'Determination', isInterlocutory: false };
  }
  
  // 默认情况下，如果是 SFAT 文档且有案号，视为可处理的文档
  if (isSFATDocument(filename, content)) {
    return { type: 'SFAT Document', isInterlocutory: true };
  }
  
  return { type: 'Unknown', isInterlocutory: false };
}

/**
 * 从文件名和内容中提取 Interlocutory Application 元数据
 */
function extractInterlocutoryMetadata(filename, content = '') {
  const metadata = {
    filename: filename,
    isInterlocutory: false,
    confidence: 0,
    types: [],
    categories: [],
    subCategories: [],
    tags: [],
    caseNumber: null,
    year: null,
    rulingDate: null,
    extractedDates: [],
    parties: {
      applicant: null,
      respondent: 'SFC'
    },
    documentType: null,
    keyIssues: [],
    summary: null,
    exclusionScore: 0
  };
  
  // 首先检查是否为 SFAT 文档
  if (!isSFATDocument(filename, content)) {
    return metadata;
  }
  
  // 检测文档类型
  const docTypeInfo = detectDocumentType(filename, content);
  metadata.documentType = docTypeInfo.type;
  
  // 如果不是 Interlocutory 相关文档，提前返回
  if (!docTypeInfo.isInterlocutory) {
    // 但如果是 SFAT 文档，仍然添加基本标签
    metadata.tags.push('sfat');
    if (metadata.documentType) {
      metadata.tags.push(metadata.documentType.toLowerCase().replace(/\s+/g, '-'));
    }
    return metadata;
  }
  
  // 添加基础标签
  metadata.tags.push('sfat', 'interlocutory');
  if (metadata.documentType) {
    metadata.tags.push(metadata.documentType.toLowerCase().replace(/\s+/g, '-'));
  }
  
  // 提取案号 - 支持更多格式
  // 格式1: SFAT_2021-1, SFAT-2021-1, SFAT 2021-1
  // 格式2: SFAT4 - 2020, SFAT 3 - 2019
  let caseMatch = filename.match(/SFAT[\s_-]*(\d{4})[\s_-]*(\d+)/i) || 
                  content.match(/SFAT[\s_-]*(\d{4})[\s_-]*(\d+)/i);
  
  // 尝试其他格式: SFAT4 - 2020, SFAT 3 - 2019
  if (!caseMatch) {
    caseMatch = filename.match(/SFAT\s*(\d)[\s_-]+(\d{4})/i) ||
                content.match(/SFAT\s*(\d)[\s_-]+(\d{4})/i);
    if (caseMatch) {
      // 交换顺序：第一个是编号，第二个是年份
      metadata.caseNumber = `SFAT ${caseMatch[2]}-${caseMatch[1]}`;
      metadata.year = parseInt(caseMatch[2]);
    }
  } else {
    metadata.caseNumber = `SFAT ${caseMatch[1]}-${caseMatch[2]}`;
    metadata.year = parseInt(caseMatch[1]);
  }
  
  if (metadata.caseNumber) {
    metadata.tags.push(`year-${metadata.year}`, `case-${metadata.caseNumber.split('-').pop()}`);
  }
  
  // 如果没有从案号获取年份，尝试其他方式
  if (!metadata.year) {
    const yearMatches = filename.match(/20\d{2}/g) || content.match(/20\d{2}/g);
    if (yearMatches) {
      metadata.year = parseInt(yearMatches[yearMatches.length - 1]);
      metadata.tags.push(`year-${metadata.year}`);
    }
  }
  
  // 提取日期
  metadata.extractedDates = extractDateFromContent(content);
  
  // 尝试确定裁定日期（通常是文档中较早出现的完整日期）
  if (metadata.extractedDates.length > 0) {
    // 优先使用与文档年份匹配的日期
    const matchingYearDate = metadata.extractedDates.find(d => d.year === metadata.year);
    if (matchingYearDate) {
      metadata.rulingDate = matchingYearDate;
    } else {
      // 否则使用第一个日期
      metadata.rulingDate = metadata.extractedDates[0];
    }
    
    // 添加日期标签
    if (metadata.rulingDate) {
      metadata.tags.push(
        `date-${metadata.rulingDate.year}`,
        `${metadata.rulingDate.year}-${String(metadata.rulingDate.month).padStart(2, '0')}`
      );
    }
  }
  
  // 检测排除特征
  const contentLower = content.toLowerCase();
  const filenameLower = filename.toLowerCase();
  
  for (const [exclusionKey, exclusionDef] of Object.entries(EXCLUSION_PATTERNS)) {
    for (const keyword of exclusionDef.keywords) {
      const keywordLower = keyword.toLowerCase();
      if (contentLower.includes(keywordLower) || filenameLower.includes(keywordLower)) {
        metadata.exclusionScore += exclusionDef.weight;
      }
    }
  }
  
  // 检测 Interlocutory 类型
  let maxConfidence = 0;
  let totalMatches = 0;
  
  for (const [typeKey, typeDef] of Object.entries(INTERLOCUTORY_TYPES)) {
    let matched = false;
    let matchCount = 0;
    
    for (const keyword of typeDef.keywords) {
      const keywordLower = keyword.toLowerCase();
      if (contentLower.includes(keywordLower) || filenameLower.includes(keywordLower)) {
        matched = true;
        matchCount++;
      }
    }
    
    if (matched) {
      metadata.types.push(typeKey);
      metadata.categories.push(typeDef.category);
      metadata.subCategories.push(typeDef.subCategory);
      
      // 添加类型标签
      metadata.tags.push(
        typeDef.category.toLowerCase().replace(/\s+/g, '-'),
        typeDef.subCategory.toLowerCase().replace(/\s+/g, '-')
      );
      
      const confidence = Math.min(matchCount / 3, 1);
      maxConfidence = Math.max(maxConfidence, confidence);
      totalMatches += matchCount;
    }
  }
  
  // 提取当事人名称
  const applicantMatch = content.match(/(?:applicant|申请人)[:\s]+([A-Z][A-Za-z\s]+?)(?:\n|,|\.)/i) ||
                         filename.match(/([A-Z][a-z]+_[A-Z][a-z]+)/);
  if (applicantMatch) {
    metadata.parties.applicant = applicantMatch[1].replace(/_/g, ' ').trim();
    // 添加申请人标签
    metadata.tags.push(`applicant-${metadata.parties.applicant.toLowerCase().replace(/\s+/g, '-')}`);
  }
  
  // 特殊案例处理（基于已知案例）
  const specialCases = {
    'SFAT_2023-2': { 
      applicant: 'Ricky Tsang & Samuel Leung', 
      types: ['EXPERT_TESTIMONY'],
      description: 'Expert testimony admission/rejection ruling'
    },
    'SFAT_2022-5': { 
      applicant: 'Pan Tianyu', 
      types: ['WITHDRAWAL_INTERLOCUTORY', 'ASSET_FREEZE_NOTICE'],
      description: 'Withdrawal of interlocutory application with costs implications'
    },
    'SFAT_2021-4': { 
      applicant: 'Ms. Leung Yuk Kit', 
      types: ['WITHDRAWAL_INTERLOCUTORY', 'ACCOUNT_FREEZE', 'SFC_POWERS_204_205'],
      description: 'Multiple procedural matters including asset freeze'
    },
    'SFAT_2022-4': { 
      applicant: 'Calvin Choi', 
      types: ['EXPERT_TESTIMONY', 'CONFIDENTIALITY_AGREEMENT', 'PROCEDURAL_MATTER'],
      description: 'Complex procedural ruling with evidence and confidentiality issues'
    },
    'SFAT_2021-1': { 
      applicant: 'Christopher Aarons', 
      types: ['CONFIDENTIALITY_AGREEMENT', 'IN_CAMERA'],
      description: 'Confidentiality and anonymity related ruling'
    },
    'SFAT_2021-3': {
      applicant: 'Pan Tianyu',
      types: ['WITHDRAWAL_INTERLOCUTORY', 'PROCEDURAL_MATTER'],
      description: 'Application treated as withdrawn due to non-compliance'
    },
    'SFAT_2020-4': {
      applicant: 'Yi Shun Da Capital',
      types: ['PROCEDURAL_MATTER'],
      description: 'Due diligence failures in listing application'
    }
  };
  
  // 匹配特殊案例
  for (const [caseId, caseInfo] of Object.entries(specialCases)) {
    const normalizedFilename = filename.replace(/[-_\s]/g, '').toUpperCase();
    const normalizedCaseId = caseId.replace(/[-_]/g, '').toUpperCase();
    
    if (normalizedFilename.includes(normalizedCaseId) || 
        (metadata.caseNumber && metadata.caseNumber.replace(/[-\s]/g, '').includes(normalizedCaseId))) {
      metadata.parties.applicant = caseInfo.applicant;
      metadata.tags.push(`applicant-${caseInfo.applicant.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and')}`);
      
      for (const type of caseInfo.types) {
        if (!metadata.types.includes(type)) {
          metadata.types.push(type);
          const typeDef = INTERLOCUTORY_TYPES[type];
          if (typeDef) {
            metadata.categories.push(typeDef.category);
            metadata.subCategories.push(typeDef.subCategory);
            metadata.tags.push(
              typeDef.category.toLowerCase().replace(/\s+/g, '-'),
              typeDef.subCategory.toLowerCase().replace(/\s+/g, '-')
            );
          }
        }
      }
      maxConfidence = 1.0;
      break;
    }
  }
  
  // 去重
  metadata.types = [...new Set(metadata.types)];
  metadata.categories = [...new Set(metadata.categories)];
  metadata.subCategories = [...new Set(metadata.subCategories)];
  metadata.tags = [...new Set(metadata.tags)];
  
  // 确定是否为 Interlocutory
  metadata.isInterlocutory = docTypeInfo.isInterlocutory && metadata.exclusionScore > -15;
  
  // 计算最终置信度
  metadata.confidence = Math.max(0, Math.min(1, maxConfidence + (metadata.exclusionScore / 20)));
  
  // 生成摘要
  if (metadata.isInterlocutory) {
    metadata.summary = generateSummary(metadata);
    metadata.keyIssues = extractKeyIssues(content, metadata.types);
  }
  
  return metadata;
}

/**
 * 生成案例摘要
 */
function generateSummary(metadata) {
  const parts = [];
  
  if (metadata.caseNumber) {
    parts.push(`${metadata.caseNumber}`);
  }
  
  if (metadata.year) {
    parts.push(`(${metadata.year})`);
  }
  
  // 添加日期信息
  if (metadata.rulingDate) {
    const { day, month, year } = metadata.rulingDate;
    parts.push(`- ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  
  parts.push('-');
  
  if (metadata.documentType) {
    parts.push(metadata.documentType);
  }
  
  if (metadata.subCategories.length > 0) {
    parts.push(`on ${metadata.subCategories.join('; ')}`);
  }
  
  if (metadata.parties.applicant) {
    parts.push(`- Applicant: ${metadata.parties.applicant}`);
  }
  
  return parts.join(' ');
}

/**
 * 提取关键议题
 */
function extractKeyIssues(content, types) {
  const issues = [];
  const sentences = content.split(/[.!?]+/).slice(0, 50);
  
  const typeSpecificPatterns = {
    EXPERT_TESTIMONY: [/expert witness.*(?:admissible|inadmissible|qualified|disqualified)/i, /expert testimony.*(?:admitted|rejected)/i],
    WITNESS_STATEMENT_ADMISSION: [/witness statement.*(?:admitted|rejected|struck out)/i],
    EXPUNGE_WITNESS_STATEMENT: [/expunge.*witness/i, /strike out.*statement/i],
    CONFIDENTIALITY_AGREEMENT: [/confidentiality.*(?:granted|refused)/i, /protective order/i],
    IN_CAMERA: [/in camera.*(?:granted|refused)/i, /hearing.*(?:public|private)/i],
    ANONYMITY_APPLICATION: [/anonymity.*(?:granted|refused)/i, /name.*suppressed/i],
    ASSET_FREEZE_NOTICE: [/freeze.*(?:granted|continued|lifted)/i],
    ACCOUNT_FREEZE: [/account.*freeze/i, /bank.*freeze/i],
    SFC_POWERS_204_205: [/section 204|section 205/i, /power.*freeze/i],
    COSTS_ASSESSMENT: [/costs.*(?:assessed|ordered|awarded)/i],
    WITHDRAWAL_INTERLOCUTORY: [/application.*withdrawn/i, /withdrawal.*costs/i]
  };
  
  const generalPatterns = [
    /application (?:to|for) \w+/i,
    /whether \w+ (?:should|could|would)/i,
    /(?:granted|dismissed|allowed|rejected)/i,
    /scope of \w+ power/i
  ];
  
  const allPatterns = [...generalPatterns];
  for (const type of types) {
    if (typeSpecificPatterns[type]) {
      allPatterns.push(...typeSpecificPatterns[type]);
    }
  }
  
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length < 20 || trimmed.length > 300) continue;
    
    for (const pattern of allPatterns) {
      if (pattern.test(trimmed) && !issues.includes(trimmed)) {
        issues.push(trimmed);
        break;
      }
    }
    
    if (issues.length >= 5) break;
  }
  
  return issues;
}

/**
 * 批量处理文档并分类
 */
function batchProcessInterlocutory(documents) {
  const results = {
    interlocutoryCases: [],
    byType: {},
    byYear: {},
    byCategory: {},
    bySubCategory: {},
    byTag: {},
    excludedCases: []
  };
  
  for (const doc of documents) {
    const metadata = extractInterlocutoryMetadata(doc.filename, doc.content);
    
    if (metadata.isInterlocutory && metadata.confidence >= 0.3) {
      results.interlocutoryCases.push(metadata);
      
      // 按类型分组
      for (const type of metadata.types) {
        if (!results.byType[type]) results.byType[type] = [];
        results.byType[type].push(metadata);
      }
      
      // 按子类别分组
      for (const subCat of metadata.subCategories) {
        if (!results.bySubCategory[subCat]) results.bySubCategory[subCat] = [];
        results.bySubCategory[subCat].push(metadata);
      }
      
      // 按年份分组
      if (metadata.year) {
        if (!results.byYear[metadata.year]) results.byYear[metadata.year] = [];
        results.byYear[metadata.year].push(metadata);
      }
      
      // 按类别分组
      for (const cat of metadata.categories) {
        if (!results.byCategory[cat]) results.byCategory[cat] = [];
        results.byCategory[cat].push(metadata);
      }
      
      // 按标签分组
      for (const tag of metadata.tags) {
        if (!results.byTag[tag]) results.byTag[tag] = [];
        results.byTag[tag].push(metadata);
      }
    } else if (metadata.exclusionScore <= -10) {
      results.excludedCases.push({
        filename: metadata.filename,
        reason: 'Likely final determination or disciplinary action',
        exclusionScore: metadata.exclusionScore
      });
    }
  }
  
  return results;
}

/**
 * 为向量检索准备增强文本
 */
function prepareForVectorSearch(metadata, originalContent) {
  const enhancedText = `
[Case Information]
Case Number: ${metadata.caseNumber || 'N/A'}
Year: ${metadata.year || 'N/A'}
Ruling Date: ${metadata.rulingDate ? `${metadata.rulingDate.year}-${String(metadata.rulingDate.month).padStart(2, '0')}-${String(metadata.rulingDate.day).padStart(2, '0')}` : 'N/A'}
Document Type: ${metadata.documentType || 'N/A'}
Type: Interlocutory Application
Categories: ${metadata.categories.join(', ') || 'N/A'}
Sub-Categories: ${metadata.subCategories.join('; ') || 'N/A'}
Tags: ${metadata.tags.join(', ') || 'N/A'}
Application Types: ${metadata.types.map(t => INTERLOCUTORY_TYPES[t]?.description || t).join('; ')}

[Parties]
Applicant: ${metadata.parties.applicant || 'N/A'}
Respondent: ${metadata.parties.respondent}

[Summary]
${metadata.summary || 'N/A'}

[Key Issues]
${metadata.keyIssues?.join('\n') || 'N/A'}

[Original Content]
${originalContent}
`.trim();

  return {
    id: metadata.filename,
    text: enhancedText,
    metadata: {
      ...metadata,
      searchKeywords: generateSearchKeywords(metadata)
    }
  };
}

/**
 * 生成搜索关键词
 */
function generateSearchKeywords(metadata) {
  const keywords = [];
  
  // 基础关键词
  keywords.push('interlocutory', 'application', 'sfat');
  if (metadata.documentType) {
    keywords.push(metadata.documentType.toLowerCase());
  }
  
  // 标签作为关键词
  keywords.push(...metadata.tags);
  
  // 类别关键词
  for (const cat of metadata.categories) {
    keywords.push(cat.toLowerCase().replace(/\s+/g, '_'));
  }
  
  // 子类别关键词
  for (const subCat of metadata.subCategories) {
    keywords.push(subCat.toLowerCase().replace(/\s+/g, '_'));
  }
  
  // 类型关键词
  for (const type of metadata.types) {
    const typeDef = INTERLOCUTORY_TYPES[type];
    if (typeDef) {
      keywords.push(...typeDef.keywords.slice(0, 3));
    }
  }
  
  // 当事人
  if (metadata.parties.applicant) {
    keywords.push(...metadata.parties.applicant.toLowerCase().split(' '));
  }
  
  // 案号
  if (metadata.caseNumber) {
    keywords.push(metadata.caseNumber.toLowerCase().replace(/\s/g, ''));
  }
  
  // 年份
  if (metadata.year) {
    keywords.push(metadata.year.toString());
  }
  
  // 日期
  if (metadata.rulingDate) {
    keywords.push(`${metadata.rulingDate.year}-${String(metadata.rulingDate.month).padStart(2, '0')}`);
  }
  
  return [...new Set(keywords)];
}

/**
 * 查询 Interlocutory Cases
 */
function queryInterlocutory(cases, query) {
  const queryLower = query.toLowerCase();
  const results = [];
  
  for (const caseItem of cases) {
    let score = 0;
    
    // 案号匹配
    if (caseItem.caseNumber && queryLower.includes(caseItem.caseNumber.toLowerCase())) {
      score += 10;
    }
    
    // 当事人匹配
    if (caseItem.parties.applicant && 
        queryLower.includes(caseItem.parties.applicant.toLowerCase())) {
      score += 8;
    }
    
    // 标签匹配
    for (const tag of caseItem.tags) {
      if (queryLower.includes(tag.toLowerCase())) {
        score += 7;
      }
    }
    
    // 子类别匹配
    for (const subCat of caseItem.subCategories) {
      if (queryLower.includes(subCat.toLowerCase())) {
        score += 6;
      }
    }
    
    // 类型匹配
    for (const type of caseItem.types) {
      const typeDef = INTERLOCUTORY_TYPES[type];
      if (typeDef) {
        for (const keyword of typeDef.keywords) {
          if (queryLower.includes(keyword.toLowerCase())) {
            score += 5;
            break;
          }
        }
      }
    }
    
    // 类别匹配
    for (const cat of caseItem.categories) {
      if (queryLower.includes(cat.toLowerCase())) {
        score += 3;
      }
    }
    
    // 年份匹配
    if (caseItem.year && query.includes(caseItem.year.toString())) {
      score += 2;
    }
    
    // 日期匹配
    if (caseItem.rulingDate && query.includes(caseItem.rulingDate.year.toString())) {
      score += 2;
    }
    
    if (score > 0) {
      results.push({ ...caseItem, relevanceScore: score });
    }
  }
  
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * 按标签过滤案例
 */
function filterByTag(cases, tag) {
  return cases.filter(c => c.tags.includes(tag));
}

/**
 * 按年份过滤案例
 */
function filterByYear(cases, year) {
  return cases.filter(c => c.year === parseInt(year));
}

/**
 * 按日期范围过滤案例
 */
function filterByDateRange(cases, startDate, endDate) {
  return cases.filter(c => {
    if (!c.rulingDate) return false;
    const caseDate = new Date(c.rulingDate.year, c.rulingDate.month - 1, c.rulingDate.day);
    return caseDate >= new Date(startDate) && caseDate <= new Date(endDate);
  });
}

/**
 * 获取所有可用的 Interlocutory 类型定义
 */
function getAllTypes() {
  return INTERLOCUTORY_TYPES;
}

/**
 * 按类别获取类型
 */
function getTypesByCategory(category) {
  const result = {};
  for (const [key, def] of Object.entries(INTERLOCUTORY_TYPES)) {
    if (def.category === category) {
      result[key] = def;
    }
  }
  return result;
}

/**
 * 获取所有预定义标签
 */
function getAllPredefinedTags() {
  return {
    documentTypes: ['ruling', 'sfat', 'interlocutory', 'costs-decision', 'determination'],
    years: Array.from({length: 10}, (_, i) => 2020 + i).map(y => `year-${y}`),
    categories: ['Evidence', 'Procedural', 'Asset Freeze', 'Costs'],
    subCategories: Object.values(INTERLOCUTORY_TYPES).map(t => t.subCategory)
  };
}

module.exports = {
  INTERLOCUTORY_TYPES,
  EXCLUSION_PATTERNS,
  extractInterlocutoryMetadata,
  batchProcessInterlocutory,
  prepareForVectorSearch,
  queryInterlocutory,
  generateSearchKeywords,
  filterByTag,
  filterByYear,
  filterByDateRange,
  getAllTypes,
  getTypesByCategory,
  getAllPredefinedTags,
  extractDateFromContent,
  isSFATDocument,
  detectDocumentType
};
