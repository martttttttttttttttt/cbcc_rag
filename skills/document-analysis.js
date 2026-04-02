const fs = require('fs');
const path = require('path');

class DocumentAnalysis {
  constructor(options = {}) {
    this.chunkConfig = {
      minChunkSize: options.minChunkSize || 500,
      maxChunkSize: options.maxChunkSize || 5000,
      overlapSize: options.overlapSize || 200,
      preserveStructure: options.preserveStructure || true
    };
  }

  extractMetadata(content, docName) {
    const metadata = {
      title: '',
      caseNumber: '',
      court: '',
      date: '',
      parties: [],
      docType: ''
    };

    // 提取标题
    const titleMatch = content.match(/^\s*([A-Z][^\n]+)\n/);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
    } else if (docName) {
      metadata.title = docName.replace('.pdf', '');
    }

    // 提取案件编号
    const caseNumberMatch = content.match(/(SFAT|MMT)\s*\d+-\d+/i);
    if (caseNumberMatch) {
      metadata.caseNumber = caseNumberMatch[0];
    }

    // 提取法院信息
    const courtMatch = content.match(/(Court|Tribunal|SFAT|Securities and Futures Appeals Tribunal)/i);
    if (courtMatch) {
      metadata.court = courtMatch[0];
    }

    // 提取日期
    const dateMatch = content.match(/\d{1,2}\s*[A-Za-z]{3,9}\s*\d{4}/);
    if (dateMatch) {
      metadata.date = dateMatch[0];
    }

    // 提取文档类型
    if (content.includes('Determination')) {
      metadata.docType = 'Determination';
    } else if (content.includes('Ruling')) {
      metadata.docType = 'Ruling';
    } else if (content.includes('Interlocutory')) {
      metadata.docType = 'Interlocutory';
    }

    return metadata;
  }

  chunkDocument(content, options = {}) {
    const { docId, docTitle, category } = options;
    const chunks = [];
    const structurePattern = /(?:§\s*\d+|Section\s+\d+|Article\s+\d+|Paragraph\s+\d+|\(\d+\)\s*[A-Z])/gi;
    
    const matches = [];
    let match;
    const regex = new RegExp(structurePattern, 'gi');
    
    while ((match = regex.exec(content)) !== null) {
      matches.push({ index: match.index, text: match[0] });
    }
    
    if (matches.length > 0) {
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index;
        const end = (i < matches.length - 1) ? matches[i + 1].index : content.length;
        const chunkText = content.substring(start, end).trim();
        
        if (chunkText.length >= this.chunkConfig.minChunkSize) {
          chunks.push({
            chunkId: `${docId}-chunk-${i}`,
            docId: docId,
            docTitle: docTitle,
            content: chunkText,
            type: matches[i].text,
            index: i,
            category: category,
            weight: 1.0
          });
        }
      }
    } else {
      // 按段落分块
      const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      let currentChunk = '';
      let chunkIndex = 0;
      
      for (const para of paragraphs) {
        if (currentChunk.length + para.length > this.chunkConfig.maxChunkSize) {
          if (currentChunk.length >= this.chunkConfig.minChunkSize) {
            chunks.push({
              chunkId: `${docId}-chunk-${chunkIndex}`,
              docId: docId,
              docTitle: docTitle,
              content: currentChunk.trim(),
              type: 'paragraph',
              index: chunkIndex,
              category: category,
              weight: 1.0
            });
            chunkIndex++;
          }
          // 保留重叠部分
          currentChunk = currentChunk.substring(currentChunk.length - this.chunkConfig.overlapSize) + '\n\n' + para;
        } else {
          currentChunk += '\n\n' + para;
        }
      }
      
      if (currentChunk.trim().length >= this.chunkConfig.minChunkSize) {
        chunks.push({
          chunkId: `${docId}-chunk-${chunkIndex}`,
          docId: docId,
          docTitle: docTitle,
          content: currentChunk.trim(),
          type: 'paragraph',
          index: chunkIndex,
          category: category,
          weight: 1.0
        });
      }
    }
    
    return chunks;
  }

  preprocessText(content, options = {}) {
    const {
      cleaning = true,
      normalization = true,
      synonyms = true
    } = options;

    let processed = content;

    if (cleaning) {
      // 清理多余空白字符
      processed = processed.replace(/\s+/g, ' ').trim();
      // 清理特殊字符
      processed = processed.replace(/[^\x20-\x7E\u4E00-\u9FFF]/g, ' ');
    }

    if (normalization) {
      // 标准化大小写（保持首字母大写）
      processed = processed.replace(/(^|[.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
    }

    if (synonyms) {
      // 法律术语同义词映射
      const legalSynonyms = {
        'fit and proper': 'fit and proper',
        'disciplinary powers': 'disciplinary powers',
        'section 194': 'section 194',
        'SFC': 'Securities and Futures Commission',
        'SFAT': 'Securities and Futures Appeals Tribunal'
      };

      Object.entries(legalSynonyms).forEach(([key, value]) => {
        const regex = new RegExp(key, 'gi');
        processed = processed.replace(regex, value);
      });
    }

    return processed;
  }

  async analyze(params) {
    const { content, docId, docName = '' } = params;

    if (!content || !docId) {
      throw new Error('缺少必要参数');
    }

    try {
      // 预处理文本
      const processedContent = this.preprocessText(content);

      // 提取元数据
      const metadata = this.extractMetadata(processedContent, docName);

      // 智能分块
      const chunks = this.chunkDocument(processedContent, {
        docId: docId,
        docTitle: metadata.title || docName,
        category: metadata.docType || 'General'
      });

      return {
        success: true,
        metadata: metadata,
        chunks: chunks,
        chunkCount: chunks.length,
        contentLength: processedContent.length,
        docId: docId,
        docName: docName
      };
    } catch (error) {
      console.error('文档分析失败:', error.message);
      throw new Error(`文档分析失败: ${error.message}`);
    }
  }
}

module.exports = DocumentAnalysis;