/**
 * ClawText PDF 智能分块模块
 * 
 * 功能：
 * 1. 按章节/标题分块
 * 2. 按页码分块
 * 3. 按段落分块（备用）
 * 4. 提取元数据（目录、关键词等）
 * 5. 支持重叠分块（保持上下文）
 */

const fs = require('fs');
const path = require('path');

// ============================================
// 配置
// ============================================
const CHUNK_CONFIG = {
  // 目标块大小（字符数）
  targetChunkSize: 1500,
  // 最小块大小
  minChunkSize: 500,
  // 最大块大小
  maxChunkSize: 3000,
  // 重叠大小（保持上下文）
  overlapSize: 200,
  // 按页码分块
  chunkByPage: true,
  // 按章节分块
  chunkBySection: true,
  // 提取元数据
  extractMetadata: true
};

// ============================================
// 章节标题识别模式
// ============================================
const SECTION_PATTERNS = [
  // 英文标题
  /^(?:PART|CHAPTER|SECTION|ARTICLE|PARAGRAPH)\s+[IVX0-9.]+[:.\s]*(.+)$/im,
  /^(?:[IVX]+|[0-9]+(?:\.[0-9]+)*)\s+(.+)$/m,
  /^(?:PART|CHAPTER|SECTION)\s+(.+)$/im,
  
  // 中文标题
  /^(?:第 [一二三四五六七八九十百千\d]+[编部篇章条款项号])[:.\s]*(.+)$/m,
  
  // 通用标题格式
  /^#{1,3}\s+(.+)$/m,
  /^\*{1,2}(.+)\*{1,2}$/m,
  
  // 法院文档特定格式
  /^(?:INTRODUCTION|BACKGROUND|FACTS|ANALYSIS|CONCLUSION|DISPOSITION|ORDER)/im,
  /^(?:I\.|II\.|III\.|IV\.|V\.|VI\.|VII\.|VIII\.|IX\.|X\.)\s+(.+)$/m,
  /^(?:A\.|B\.|C\.|D\.|E\.|F\.|G\.|H\.|I\.|J\.)\s+(.+)$/m
];

// ============================================
// 元数据提取
// ============================================

/**
 * 提取文档元数据
 * @param {string} content - PDF 文本内容
 * @param {object} fileInfo - 文件信息
 * @returns {object} 元数据对象
 */
function extractMetadata(content, fileInfo) {
  // 处理字符串类型的fileInfo（文件名）
  if (typeof fileInfo === 'string') {
    fileInfo = { originalName: fileInfo };
  }
  
  const metadata = {
    // 基本信息
    docId: fileInfo?.id || fileInfo?.docId || null,
    fileName: fileInfo?.originalName || fileInfo?.fileName || 'unknown',
    category: fileInfo?.category || 'MMT',
    uploadTime: fileInfo?.uploadTime || new Date().toISOString(),
    
    // 结构信息
    totalPages: 0,
    totalSections: 0,
    totalChunks: 0,
    
    // 内容特征
    hasTableOfContents: false,
    hasFootnotes: false,
    hasCitations: false,
    
    // 关键词
    keywords: [],
    
    // 章节列表
    sections: [],
    
    // 页码索引
    pageIndex: []
  };
  
  // 检测目录
  const tocPatterns = [
    /(?:TABLE\s+OF\s+CONTENTS|CONTENTS)/i,
    /(?:目 [录録]|目次)/,
    /(?:INDEX)/i
  ];
  metadata.hasTableOfContents = tocPatterns.some(p => p.test(content));
  
  // 检测脚注
  metadata.hasFootnotes = /[†‡§¶]|[0-9]+(?:st|nd|rd|th)\s*(?:fn|note)|(?:注[释解]|footnote)/i.test(content);
  
  // 检测引用
  metadata.hasCitations = /(?:see|cited?|refer|supra|infra|ibid)|(?:参见|引用|依据|根据《)/i.test(content);
  
  // 提取案件信息（香港法律文档）
  const caseNumberMatch = content.match(/(?:民事诉讼|刑事诉讼|上诉).*?(?:编号|案号)[：:]\s*([\d年第\-\s]+号?)/i);
  if (caseNumberMatch) {
    metadata.caseNumber = caseNumberMatch[1].trim();
  }
  
  // 提取法院信息
  const courtMatch = content.match(/(香港特别行政区.*?法院.*?庭|原讼法庭|上诉法庭|终审法院)/i);
  if (courtMatch) {
    metadata.court = courtMatch[1].trim();
  }
  
  // 提取当事人信息
  const partiesMatch = content.match(/(?:原告|上诉人)[：:]\s*(.+?)\s*(?:被告|被上诉人)[：:]\s*(.+?)(?:\n|$)/i);
  if (partiesMatch) {
    metadata.parties = {
      plaintiff: partiesMatch[1].trim(),
      defendant: partiesMatch[2].trim()
    };
  }
  
  // 提取日期
  const dateMatch = content.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (dateMatch) {
    metadata.date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
  }
  
  // 确定文档类型
  if (/判决书|裁定书|命令/.test(content)) {
    metadata.docType = 'judgment';
  } else if (/合同|协议|契约/.test(content)) {
    metadata.docType = 'contract';
  } else if (/条例|法规|法例/.test(content)) {
    metadata.docType = 'legislation';
  } else {
    metadata.docType = 'general';
  }
  
  // 提取章节
  metadata.sections = extractSections(content);
  metadata.totalSections = metadata.sections.length;
  
  // 提取关键词
  metadata.keywords = extractKeywords(content, fileInfo.category);
  
  return metadata;
}

/**
 * 提取章节结构
 * @param {string} content - 文本内容
 * @returns {Array} 章节列表
 */
function extractSections(content) {
  const sections = [];
  const lines = content.split('\n');
  
  let currentSection = null;
  let sectionStart = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 检查是否是章节标题
    const sectionMatch = SECTION_PATTERNS.some(pattern => {
      const match = line.match(pattern);
      if (match) {
        return true;
      }
      return false;
    });
    
    if (sectionMatch) {
      // 保存之前的章节
      if (currentSection) {
        currentSection.endLine = i - 1;
        currentSection.content = lines.slice(sectionStart, i).join('\n');
        sections.push(currentSection);
      }
      
      // 开始新章节
      const titleMatch = line.match(SECTION_PATTERNS.find(p => line.match(p)));
      currentSection = {
        title: titleMatch ? (titleMatch[1] || line) : line,
        startLine: i,
        endLine: null,
        content: '',
        level: getSectionLevel(line)
      };
      sectionStart = i;
    }
  }
  
  // 添加最后一个章节
  if (currentSection) {
    currentSection.endLine = lines.length - 1;
    currentSection.content = lines.slice(sectionStart).join('\n');
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * 获取章节级别
 * @param {string} line - 标题行
 * @returns {number} 级别 (1=最高)
 */
function getSectionLevel(line) {
  if (/^(?:PART|CHAPTER|第 [一二三四五六七八九十百千\d]+[编部])/i.test(line)) return 1;
  if (/^(?:SECTION|第 [一二三四五六七八九十百千\d]+[篇章条])/i.test(line)) return 2;
  if (/^(?:[IVX]+|[0-9]+\.)/.test(line)) return 3;
  if (/^(?:[A-Z]\.|[a-z]\.)/.test(line)) return 4;
  return 5;
}

/**
 * 提取关键词
 * @param {string} content - 文本内容
 * @param {string} category - 文档类别
 * @returns {Array} 关键词列表
 */
function extractKeywords(content, category) {
  const keywords = new Set();
  
  // 添加类别关键词
  if (category) {
    keywords.add(category);
  }
  
  // 提取高频法律术语
  const legalTerms = [
    'appeal', 'tribunal', 'commission', 'securities', 'futures',
    'licensing', 'disciplinary', 'sanction', 'penalty', 'ruling',
    'appellant', 'respondent', 'hearing', 'evidence', 'submission'
  ];
  
  const contentLower = content.toLowerCase();
  legalTerms.forEach(term => {
    if (contentLower.includes(term.toLowerCase())) {
      keywords.add(term);
    }
  });
  
  // 提取数字（可能是条款号、年份等）
  const numberMatches = content.match(/\b(?:section|s\.?|article)\s*([0-9]+(?:\.[0-9]+)*)/gi);
  if (numberMatches) {
    numberMatches.forEach(match => {
      const num = match.match(/[0-9]+(?:\.[0-9]+)*/);
      if (num) keywords.add(`s.${num[0]}`);
    });
  }
  
  return Array.from(keywords).slice(0, 20); // 限制最多 20 个关键词
}

// ============================================
// 智能分块
// ============================================

/**
 * 将文档分块
 * @param {string} content - PDF 文本内容
 * @param {object} metadata - 元数据
 * @param {object} options - 分块选项
 * @returns {Array} 分块数组
 */
function chunkDocument(content, metadata, options = {}) {
  const config = { ...CHUNK_CONFIG, ...options };
  const chunks = [];
  
  // 优先按章节分块
  if (config.chunkBySection && metadata.sections && metadata.sections.length > 0) {
    const sectionChunks = chunkBySections(metadata.sections, config);
    chunks.push(...sectionChunks);
  }
  
  // 如果章节分块结果太少，使用滑动窗口分块
  if (chunks.length === 0) {
    const windowChunks = chunkByWindow(content, config);
    chunks.push(...windowChunks);
  }
  
  // 为每个块添加元数据
  chunks.forEach((chunk, index) => {
    chunk.chunkId = `${metadata.docId}_chunk_${index}`;
    chunk.docId = metadata.docId;
    chunk.index = index;
    chunk.totalChunks = chunks.length;
    chunk.category = metadata.category || 'MMT';
    chunk.keywords = metadata.keywords || [];
    
    // 统一字段名：type 和 weight
    chunk.type = chunk.chunkType || 'content';
    delete chunk.chunkType;
    
    // 根据类型设置权重
    if (!chunk.weight) {
      const weights = { 'heading': 3.0, 'provision': 2.5, 'court-opinion': 2.0, 'section': 1.5 };
      chunk.weight = weights[chunk.type] || 1.0;
    }
  });
  
  return chunks;
}

/**
 * 按章节分块
 * @param {Array} sections - 章节列表
 * @param {object} config - 配置
 * @returns {Array} 分块数组
 */
function chunkBySections(sections, config) {
  const chunks = [];
  
  sections.forEach((section, index) => {
    const sectionContent = section.content || '';
    
    if (sectionContent.length <= config.maxChunkSize) {
      // 章节内容较小，直接作为一个块
      chunks.push({
        sectionTitle: section.title,
        sectionLevel: section.level,
        sectionIndex: index,
        content: sectionContent,
        startLine: section.startLine,
        endLine: section.endLine,
        chunkType: 'section'
      });
    } else {
      // 章节内容较大，进一步分块
      const subChunks = chunkByWindow(sectionContent, {
        ...config,
        preserveSection: true,
        sectionTitle: section.title,
        sectionLevel: section.level,
        sectionIndex: index
      });
      chunks.push(...subChunks);
    }
  });
  
  return chunks;
}

/**
 * 滑动窗口分块
 * @param {string} content - 文本内容
 * @param {object} config - 配置
 * @returns {Array} 分块数组
 */
function chunkByWindow(content, config) {
  const chunks = [];
  const text = content.replace(/\s+/g, ' ').trim();
  
  if (text.length <= config.targetChunkSize) {
    return [{
      content: text,
      chunkType: 'single',
      startChar: 0,
      endChar: text.length
    }];
  }
  
  let start = 0;
  let chunkIndex = 0;
  
  while (start < text.length) {
    // 计算窗口结束位置
    let end = Math.min(start + config.targetChunkSize, text.length);
    
    // 尝试在句子边界处切断
    if (end < text.length) {
      const sentenceEnd = findSentenceBoundary(text, end);
      if (sentenceEnd > start + config.minChunkSize) {
        end = sentenceEnd;
      }
    }
    
    // 提取块内容
    let chunkContent = text.slice(start, end).trim();
    
    // 添加重叠（除了最后一块）
    if (end < text.length && config.overlapSize > 0) {
      const overlapStart = Math.max(start - config.overlapSize, 0);
      if (overlapStart < start) {
        chunkContent = text.slice(overlapStart, start) + '...' + chunkContent;
      }
    }
    
    const chunk = {
      content: chunkContent,
      chunkType: config.preserveSection ? 'section-sub' : 'window',
      startChar: start,
      endChar: end,
      chunkIndex: chunkIndex
    };
    
    // 添加章节信息（如果有）
    if (config.preserveSection) {
      chunk.sectionTitle = config.sectionTitle;
      chunk.sectionLevel = config.sectionLevel;
      chunk.sectionIndex = config.sectionIndex;
    }
    
    chunks.push(chunk);
    chunkIndex++;
    
    // 移动到下一个窗口（考虑重叠）
    start = end - config.overlapSize;
    if (start >= text.length) break;
  }
  
  return chunks;
}

/**
 * 查找句子边界
 * @param {string} text - 文本
 * @param {number} position - 目标位置
 * @returns {number} 句子边界位置
 */
function findSentenceBoundary(text, position) {
  // 向后查找句子结束符
  const lookAhead = 200;
  const searchEnd = Math.min(position + lookAhead, text.length);
  const searchRegion = text.slice(position, searchEnd);
  
  const sentenceEnders = ['. ', '.\n', '! ', '!\n', '? ', '?\n', '." ', '."\\n'];
  
  for (const ender of sentenceEnders) {
    const index = searchRegion.indexOf(ender);
    if (index !== -1) {
      return position + index + ender.length;
    }
  }
  
  // 如果没有找到句子边界，返回原始位置
  return position;
}

// ============================================
// 向量嵌入准备
// ============================================

/**
 * 准备向量嵌入数据
 * @param {Array} chunks - 分块数组
 * @returns {Array} 可嵌入数据
 */
function prepareForEmbedding(chunks) {
  return chunks.map(chunk => ({
    chunkId: chunk.chunkId,
    docId: chunk.docId,
    text: chunk.content,
    metadata: {
      chunkIndex: chunk.chunkIndex,
      totalChunks: chunk.totalChunks,
      sectionTitle: chunk.sectionTitle || null,
      sectionLevel: chunk.sectionLevel || null,
      category: chunk.category,
      keywords: chunk.keywords
    }
  }));
}

// ============================================
// 导出
// ============================================

module.exports = {
  CHUNK_CONFIG,
  extractMetadata,
  extractSections,
  extractKeywords,
  chunkDocument,
  chunkBySections,
  chunkByWindow,
  prepareForEmbedding,
  getSectionLevel,
  findSentenceBoundary
};
