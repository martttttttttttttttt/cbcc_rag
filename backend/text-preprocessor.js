/**
 * ClawText 文本预处理模块
 * 包含：文本清洗、格式标准化、法律术语同义词映射
 */

const fs = require('fs');
const path = require('path');

// ============================================
// 法律术语同义词映射表
// ============================================
const LEGAL_SYNONYMS = {
  // 监管机构
  'SFC': 'Securities and Futures Commission',
  'Securities and Futures Commission': 'SFC',
  '证监会': 'SFC',
  
  'SFAT': 'Securities and Futures Appeal Tribunal',
  'Securities and Futures Appeal Tribunal': 'SFAT',
  '证券及期货上诉审裁处': 'SFAT',
  '审裁处': 'SFAT',
  
  // 法律条款
  'SFO': 'Securities and Futures Ordinance',
  'Securities and Futures Ordinance': 'SFO',
  '证券及期货条例': 'SFO',
  
  'section': 's.',
  'Section': 's.',
  'SECTION': 's.',
  '§': 's.',
  
  // 文档类型
  'ruling': 'Ruling',
  'RULING': 'Ruling',
  '裁决': 'Ruling',
  
  'determination': 'Determination',
  'DETERMINATION': 'Determination',
  '决定': 'Determination',
  
  'decision': 'Decision',
  'DECISION': 'Decision',
  '判决': 'Decision',
  
  'notice': 'Notice',
  'NOTICE': 'Notice',
  '通知': 'Notice',
  
  // 常见法律术语
  'appellant': 'Appellant',
  'APPELLANT': 'Appellant',
  '上诉人': 'Appellant',
  
  'respondent': 'Respondent',
  'RESPONDENT': 'Respondent',
  '被上诉人': 'Respondent',
  
  'tribunal': 'Tribunal',
  'TRIBUNAL': 'Tribunal',
  '法庭': 'Tribunal',
  '法院': 'Tribunal',
  
  'court': 'Court',
  'COURT': 'Court',
  
  'hearing': 'Hearing',
  'HEARING': 'Hearing',
  '聆讯': 'Hearing',
  
  'appeal': 'Appeal',
  'APPEAL': 'Appeal',
  '上诉': 'Appeal',
  
  'disciplinary': 'Disciplinary',
  'DISCIPLINARY': 'Disciplinary',
  '纪律': 'Disciplinary',
  
  'sanction': 'Sanction',
  'SANCTION': 'Sanction',
  '制裁': 'Sanction',
  
  'penalty': 'Penalty',
  'PENALTY': 'Penalty',
  '处罚': 'Penalty',
  
  'fine': 'Fine',
  'FINE': 'Fine',
  '罚款': 'Fine',
  
  'suspension': 'Suspension',
  'SUSPENSION': 'Suspension',
  '停牌': 'Suspension',
  
  'revocation': 'Revocation',
  'REVOCATION': 'Revocation',
  '撤销': 'Revocation',
  
  'license': 'License',
  'LICENSE': 'License',
  '牌照': 'License',
  'licence': 'License',
  
  'representative': 'Representative',
  'REPRESENTATIVE': 'Representative',
  '代表': 'Representative',
  
  'officer': 'Officer',
  'OFFICER': 'Officer',
  '高级人员': 'Officer',
  
  'misconduct': 'Misconduct',
  'MISCONDUCT': 'Misconduct',
  '不当行为': 'Misconduct',
  
  'breach': 'Breach',
  'BREACH': 'Breach',
  '违反': 'Breach',
  
  'contravention': 'Contravention',
  'CONTRAVENTION': 'Contravention',
  '违规': 'Contravention',
  
  'compliance': 'Compliance',
  'COMPLIANCE': 'Compliance',
  '合规': 'Compliance',
  
  'regulation': 'Regulation',
  'REGULATION': 'Regulation',
  '规例': 'Regulation',
  
  'provision': 'Provision',
  'PROVISION': 'Provision',
  '条文': 'Provision',
  
  'subsection': 'sub-s.',
  'Subsection': 'sub-s.',
  'SUBSECTION': 'sub-s.',
  
  'paragraph': 'para.',
  'Paragraph': 'para.',
  'PARAGRAPH': 'para.',
  '段': 'para.',
};

// ============================================
// 日期格式标准化规则
// ============================================
const DATE_PATTERNS = [
  { pattern: /(\d{1,2})\/(\d{1,2})\/(\d{4})/g, replacement: '$3-$2-$1' }, // 1/2/2021 → 2021-02-01
  { pattern: /(\d{4})\/(\d{1,2})\/(\d{1,2})/g, replacement: '$1-$2-$3' }, // 2021/1/2 → 2021-01-02
  { pattern: /(\d{1,2})-(\d{1,2})-(\d{4})/g, replacement: '$3-$2-$1' }, // 1-2-2021 → 2021-02-01
  { pattern: /(\d{4})-(\d{1,2})-(\d{1,2})/g, replacement: (match, y, m, d) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` }, // 2021-1-2 → 2021-01-02
  { pattern: /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/gi, replacement: (match, d, m, y) => {
      const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
      return `${y}-${months[m.toLowerCase()]}-${d.padStart(2, '0')}`;
    }
  },
];

// ============================================
// 编号格式标准化规则
// ============================================
const NUMBER_PATTERNS = [
  // SFAT 编号标准化：SFAT 2021-5 → SFAT_2021_5
  { pattern: /SFAT\s+(\d{4})-(\d+)/g, replacement: 'SFAT_$1_$2' },
  { pattern: /SFAT\s+(\d{4})\/(\d+)/g, replacement: 'SFAT_$1_$2' },
  
  // MMT 编号标准化
  { pattern: /MMT\s+(\d{4})-(\d+)/g, replacement: 'MMT_$1_$2' },
  { pattern: /MMT\s+(\d{4})\/(\d+)/g, replacement: 'MMT_$1_$2' },
  
  // 条款编号：§28 → s.28
  { pattern: /§\s*(\d+)/g, replacement: 's.$1' },
  { pattern: /§\s*(\d+)\s*\((\w+)\)/g, replacement: 's.$1($2)' },
  
  // 段落编号：para 123 → para.123
  { pattern: /para\s+(\d+)/gi, replacement: 'para.$1' },
  { pattern: /paragraph\s+(\d+)/gi, replacement: 'para.$1' },
  
  // 章节编号：Chapter 5 → Ch.5
  { pattern: /Chapter\s+(\d+)/gi, replacement: 'Ch.$1' },
];

class TextPreprocessor {
  constructor(options = {}) {
    this.options = {
      enableCleaning: true,
      enableNormalization: true,
      enableSynonyms: true,
      synonymFile: path.join(__dirname, 'legal-synonyms.json'),
      ...options
    };
    
    // 加载自定义同义词（如果有）
    this.customSynonyms = this.loadCustomSynonyms();
  }
  
  loadCustomSynonyms() {
    try {
      if (fs.existsSync(this.options.synonymFile)) {
        const custom = JSON.parse(fs.readFileSync(this.options.synonymFile, 'utf-8'));
        console.log('✅ 已加载自定义法律术语同义词表');
        return custom;
      }
    } catch (error) {
      console.warn('⚠️ 加载自定义同义词表失败:', error.message);
    }
    return {};
  }
  
  /**
   * 主处理函数：执行所有预处理步骤
   */
  preprocess(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return text;
    }
    
    let result = text;
    
    // 步骤 1: 文本清洗
    if (this.options.enableCleaning && options.cleaning !== false) {
      result = this.cleanText(result);
    }
    
    // 步骤 2: 格式标准化
    if (this.options.enableNormalization && options.normalization !== false) {
      result = this.normalizeFormat(result);
    }
    
    // 步骤 3: 同义词映射
    if (this.options.enableSynonyms && options.synonyms !== false) {
      result = this.applySynonyms(result);
    }
    
    return result;
  }
  
  /**
   * 步骤 1: 文本清洗
   * 移除无意义字符、页眉页脚、水印等
   */
  cleanText(text) {
    let cleaned = text;
    
    // 1. 移除连续的单字母序列 (如 "F G H I J K L M N O P Q R S T U V A B C D E")
    const singleLetterPattern = /(?:[A-Z]\s+){5,}[A-Z]/g;
    cleaned = cleaned.replace(singleLetterPattern, '');
    
    // 2. 移除连续的单个小写字母序列
    const singleLowerPattern = /(?:[a-z]\s+){5,}[a-z]/g;
    cleaned = cleaned.replace(singleLowerPattern, '');
    
    // 3. 移除页码标记 (如 "-- 1 of 56 --" 或 "--1 of 56--")
    const pageNumPattern = /--\s*\d+\s+of\s+\d+\s*--/g;
    cleaned = cleaned.replace(pageNumPattern, '');
    
    // 4. 移除页眉页脚模式 (如 "Page 1 of 10" 或 "Page1/10")
    const pageHeaderPattern = /Page\s*\d+\s*(?:of|\/)\s*\d+/gi;
    cleaned = cleaned.replace(pageHeaderPattern, '');
    
    // 5. 移除连续的下划线行
    const underlinePattern = /_{10,}/g;
    cleaned = cleaned.replace(underlinePattern, '');
    
    // 6. 移除连续的等号线
    const equalLinePattern = /={10,}/g;
    cleaned = cleaned.replace(equalLinePattern, '');
    
    // 7. 移除只有空格的行
    const emptyLines = /^\s+$/gm;
    cleaned = cleaned.replace(emptyLines, '');
    
    // 8. 移除 PDF 水印常见模式
    const watermarkPatterns = [
      /CONFIDENTIAL/gi,
      /DRAFT/gi,
      /WORKING\s+COPY/gi,
      /INTERNAL\s+USE\s+ONLY/gi,
    ];
    watermarkPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    // 9. 清理多余的空行（超过 2 个连续换行）
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    // 10. 移除行首尾的多余空格
    cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');
    
    // 11. 移除乱码字符（非打印字符）
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // 12. 标准化空白字符（制表符→空格）
    cleaned = cleaned.replace(/\t/g, ' ');
    
    // 13. 移除多余的空格（3 个以上连续空格→2 个）
    cleaned = cleaned.replace(/ {3,}/g, '  ');
    
    return cleaned.trim();
  }
  
  /**
   * 步骤 2: 格式标准化
   * 统一日期、编号、条款等格式
   */
  normalizeFormat(text) {
    let normalized = text;
    
    // 应用日期格式标准化
    DATE_PATTERNS.forEach(({ pattern, replacement }) => {
      normalized = normalized.replace(pattern, replacement);
    });
    
    // 应用编号格式标准化
    NUMBER_PATTERNS.forEach(({ pattern, replacement }) => {
      normalized = normalized.replace(pattern, replacement);
    });
    
    // 标准化空格：确保标点符号后有一个空格
    normalized = normalized.replace(/([,.:;!?])\s*(?=[A-Z])/g, '$1 ');
    
    // 标准化连字符：统一为单个连字符
    normalized = normalized.replace(/\s*[-–—]\s*/g, '-');
    
    // 标准化括号空格
    normalized = normalized.replace(/\s*\(\s*/g, '(');
    normalized = normalized.replace(/\s*\)\s*/g, ') ');
    
    // 标准化货币格式：HK$ 1,000,000 → HK$1,000,000
    normalized = normalized.replace(/HK\$\s+/g, 'HK$');
    
    return normalized;
  }
  
  /**
   * 步骤 3: 同义词映射
   * 应用法律术语同义词替换
   */
  applySynonyms(text) {
    let result = text;
    
    // 合并内置和自定义同义词
    const allSynonyms = { ...LEGAL_SYNONYMS, ...this.customSynonyms };
    
    // 按长度排序，优先替换长词（避免部分匹配）
    const sortedTerms = Object.keys(allSynonyms).sort((a, b) => b.length - a.length);
    
    sortedTerms.forEach(term => {
      const replacement = allSynonyms[term];
      // 使用单词边界确保精确匹配
      const pattern = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi');
      result = result.replace(pattern, replacement);
    });
    
    return result;
  }
  
  /**
   * 转义正则表达式特殊字符
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * 保存自定义同义词到文件
   */
  saveCustomSynonyms(synonyms) {
    try {
      const existing = this.loadCustomSynonyms();
      const merged = { ...existing, ...synonyms };
      fs.writeFileSync(this.options.synonymFile, JSON.stringify(merged, null, 2), 'utf-8');
      this.customSynonyms = merged;
      console.log(`✅ 已保存 ${Object.keys(synonyms).length} 个同义词到 ${this.options.synonymFile}`);
      return true;
    } catch (error) {
      console.error('❌ 保存同义词失败:', error.message);
      return false;
    }
  }
  
  /**
   * 添加单个同义词
   */
  addSynonym(term, synonym) {
    const synonyms = { [term]: synonym };
    return this.saveCustomSynonyms(synonyms);
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      builtInSynonyms: Object.keys(LEGAL_SYNONYMS).length,
      customSynonyms: Object.keys(this.customSynonyms).length,
      total: Object.keys(LEGAL_SYNONYMS).length + Object.keys(this.customSynonyms).length,
    };
  }
}

// 导出单例实例
const preprocessor = new TextPreprocessor();

module.exports = {
  TextPreprocessor,
  preprocessor,
  preprocess: (text, options) => preprocessor.preprocess(text, options),
  cleanText: (text) => preprocessor.cleanText(text),
  normalizeFormat: (text) => preprocessor.normalizeFormat(text),
  applySynonyms: (text) => preprocessor.applySynonyms(text),
  LEGAL_SYNONYMS,
};
