const fs = require('fs');
const path = require('path');

class LegalAnalysis {
  constructor(options = {}) {
    this.courtCommentPatterns = {
      courtEmphasis: /(court|tribunal)\s+(emphasized|stressed|highlighted)/gi,
      courtCriticism: /(court|tribunal)\s+(criticized|condemned|disapproved)/gi,
      courtNoted: /(court|tribunal)\s+(noted|observed|remarked)/gi,
      courtPointedOut: /(court|tribunal)\s+(pointed out|indicated)/gi,
      legalBasis: /(section|article|clause)\s+\d+/gi,
      disciplinaryPowers: /disciplinary\s+powers/gi,
      fitAndProper: /fit\s+and\s+proper/gi,
      transparency: /transparency|clarity/gi
    };
  }

  extractCourtComments(content) {
    const comments = [];
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 50);

    paragraphs.forEach((paragraph, index) => {
      const paraLower = paragraph.toLowerCase();
      const comment = {
        paragraphIndex: index + 1,
        content: paragraph.trim(),
        type: 'general',
        keywords: []
      };

      // 识别评论类型
      if (this.courtCommentPatterns.courtEmphasis.test(paraLower)) {
        comment.type = 'emphasis';
        comment.keywords.push('emphasis');
      } else if (this.courtCommentPatterns.courtCriticism.test(paraLower)) {
        comment.type = 'criticism';
        comment.keywords.push('criticism');
      } else if (this.courtCommentPatterns.courtNoted.test(paraLower)) {
        comment.type = 'observation';
        comment.keywords.push('observation');
      } else if (this.courtCommentPatterns.courtPointedOut.test(paraLower)) {
        comment.type = 'point';
        comment.keywords.push('point');
      }

      // 提取法律关键词
      if (this.courtCommentPatterns.legalBasis.test(paraLower)) {
        comment.keywords.push('legal_basis');
      }
      if (this.courtCommentPatterns.disciplinaryPowers.test(paraLower)) {
        comment.keywords.push('disciplinary_powers');
      }
      if (this.courtCommentPatterns.fitAndProper.test(paraLower)) {
        comment.keywords.push('fit_and_proper');
      }
      if (this.courtCommentPatterns.transparency.test(paraLower)) {
        comment.keywords.push('transparency');
      }

      // 只添加有意义的评论
      if (comment.type !== 'general' || comment.keywords.length > 0) {
        comments.push(comment);
      }
    });

    return comments;
  }

  analyzeCourtComments(params) {
    const { content, docName = '' } = params;

    if (!content) {
      throw new Error('缺少文档内容');
    }

    try {
      const courtComments = this.extractCourtComments(content);

      // 分类统计
      const commentTypes = {
        emphasis: 0,
        criticism: 0,
        observation: 0,
        point: 0,
        general: 0
      };

      courtComments.forEach(comment => {
        commentTypes[comment.type] = (commentTypes[comment.type] || 0) + 1;
      });

      // 关键词统计
      const keywordStats = {};
      courtComments.forEach(comment => {
        comment.keywords.forEach(keyword => {
          keywordStats[keyword] = (keywordStats[keyword] || 0) + 1;
        });
      });

      return {
        success: true,
        docName: docName,
        totalComments: courtComments.length,
        commentTypes: commentTypes,
        keywordStats: keywordStats,
        comments: courtComments,
        analysis: {
          hasSignificantComments: courtComments.length > 0,
          mainThemes: Object.entries(keywordStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([keyword]) => keyword),
          commentDensity: (courtComments.length / (content.split(/\n\s*\n/).length)).toFixed(2)
        }
      };
    } catch (error) {
      console.error('法院评论分析失败:', error.message);
      throw new Error(`法院评论分析失败: ${error.message}`);
    }
  }

  extractLegalProvisions(content) {
    const provisions = [];
    const provisionPattern = /(section|article|clause)\s+(\d+)(?:\([^)]+\))?/gi;
    let match;

    while ((match = provisionPattern.exec(content)) !== null) {
      const provision = {
        type: match[1].toLowerCase(),
        number: match[2],
        fullMatch: match[0],
        context: this.extractContext(content, match.index, 200)
      };
      provisions.push(provision);
    }

    return provisions;
  }

  extractContext(text, index, radius) {
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + radius);
    return text.substring(start, end).trim();
  }

  analyzeLegalProvisions(params) {
    const { content, docName = '' } = params;

    if (!content) {
      throw new Error('缺少文档内容');
    }

    try {
      const provisions = this.extractLegalProvisions(content);

      // 统计条款出现频率
      const provisionStats = {};
      provisions.forEach(provision => {
        const key = `${provision.type} ${provision.number}`;
        provisionStats[key] = (provisionStats[key] || 0) + 1;
      });

      return {
        success: true,
        docName: docName,
        totalProvisions: provisions.length,
        provisionStats: provisionStats,
        provisions: provisions
      };
    } catch (error) {
      console.error('法律条款分析失败:', error.message);
      throw new Error(`法律条款分析失败: ${error.message}`);
    }
  }
}

module.exports = LegalAnalysis;