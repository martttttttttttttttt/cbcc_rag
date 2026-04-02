/**
 * ClawText 增强检索模块
 * 
 * 功能：
 * 1. 标签过滤检索（按年份/案件类型/法条编号等）
 * 2. 语义向量检索
 * 3. 混合检索（关键词 + 向量 + 标签过滤）
 * 4. 结果重排序和聚合
 */

const fs = require('fs');
const path = require('path');
const { tagPDF } = require('./pdf-tagger');
const { VectorStore, cosineSimilarity } = require('./vector-store');

// ============================================
// 配置
// ============================================
const SEARCH_CONFIG = {
  // 默认返回结果数
  defaultTopK: 10,
  
  // 相似度阈值
  minSimilarityScore: 0.5,
  
  // 混合搜索权重
  weights: {
    vector: 0.5,
    keyword: 0.3,
    tag: 0.2
  },
  
  // 结果片段长度
  snippetLength: 300,
  
  // 高亮标记
  highlightPre: '<mark>',
  highlightPost: '</mark>'
};

// ============================================
// 增强检索器类
// ============================================

class EnhancedSearcher {
  constructor(options = {}) {
    this.chunkDBPath = options.chunkDBPath || path.join(__dirname, 'chunks_database.json');
    this.metadataDBPath = options.metadataDBPath || path.join(__dirname, 'metadata_database.json');
    this.vectorStore = new VectorStore('enhanced_search');
    this.chunks = [];
    this.documents = new Map();
    this.isInitialized = false;
  }
  
  /**
   * 初始化检索器
   */
  async initialize() {
    console.log('🔧 初始化增强检索器...');
    
    // 加载分块数据库
    this.loadChunkDB();
    
    // 加载元数据
    this.loadMetadataDB();
    
    // 加载或构建向量索引
    this.vectorStore.load();
    
    if (this.vectorStore.documents.length === 0 && this.chunks.length > 0) {
      await this.buildVectorIndex();
    }
    
    this.isInitialized = true;
    console.log('✅ 增强检索器初始化完成');
    console.log(`   - 文档块: ${this.chunks.length}`);
    console.log(`   - 向量索引: ${this.vectorStore.documents.length}`);
  }
  
  /**
   * 加载分块数据库
   */
  loadChunkDB() {
    try {
      if (fs.existsSync(this.chunkDBPath)) {
        const data = JSON.parse(fs.readFileSync(this.chunkDBPath, 'utf-8'));
        this.chunks = data.chunks || [];
        console.log(`📚 已加载 ${this.chunks.length} 个文档块`);
      }
    } catch (error) {
      console.error('❌ 加载分块数据库失败:', error.message);
    }
  }
  
  /**
   * 加载元数据数据库
   */
  loadMetadataDB() {
    try {
      if (fs.existsSync(this.metadataDBPath)) {
        const data = JSON.parse(fs.readFileSync(this.metadataDBPath, 'utf-8'));
        
        // 转换为 Map
        Object.entries(data.documents || {}).forEach(([docId, metadata]) => {
          this.documents.set(docId, metadata);
        });
        
        console.log(`📚 已加载 ${this.documents.size} 个文档元数据`);
      }
    } catch (error) {
      console.error('❌ 加载元数据数据库失败:', error.message);
    }
  }
  
  /**
   * 构建向量索引
   */
  async buildVectorIndex() {
    console.log('🏗️ 构建向量索引...');
    
    const documents = this.chunks.map(chunk => ({
      id: chunk.chunkId,
      text: chunk.content,
      metadata: {
        docId: chunk.docId,
        pageRange: chunk.pageRange,
        sectionTitle: chunk.sectionTitle
      },
      tags: chunk.tags || {}
    }));
    
    await this.vectorStore.addDocuments(documents);
    this.vectorStore.save();
    
    console.log('✅ 向量索引构建完成');
  }
  
  /**
   * 标签过滤搜索
   * @param {object} filters - 过滤条件
   * @returns {Array} 过滤后的文档块
   */
  searchByTags(filters) {
    let results = [...this.chunks];
    
    // 按年份过滤
    if (filters.year) {
      results = results.filter(chunk => {
        const tags = chunk.tags?.metadata;
        return tags?.year === parseInt(filters.year);
      });
    }
    
    // 按文档类型过滤
    if (filters.docType) {
      results = results.filter(chunk => {
        const docType = chunk.tags?.documentType;
        return docType?.primary === filters.docType;
      });
    }
    
    // 按案件编号过滤
    if (filters.caseNumber) {
      results = results.filter(chunk => {
        const caseNum = chunk.tags?.metadata?.caseNumber;
        return caseNum && caseNum.includes(filters.caseNumber);
      });
    }
    
    // 按法条引用过滤
    if (filters.legalRef) {
      results = results.filter(chunk => {
        const refs = chunk.tags?.legalReferences;
        if (!refs) return false;
        
        return Object.values(refs).some(arr => 
          arr.some(ref => ref.toLowerCase().includes(filters.legalRef.toLowerCase()))
        );
      });
    }
    
    // 按当事人过滤
    if (filters.party) {
      results = results.filter(chunk => {
        const parties = chunk.tags?.parties;
        if (!parties) return false;
        
        const allNames = [
          ...(parties.persons || []).map(p => p.name),
          ...(parties.organizations || []).map(o => o.name)
        ];
        
        return allNames.some(name => 
          name.toLowerCase().includes(filters.party.toLowerCase())
        );
      });
    }
    
    return results;
  }
  
  /**
   * 执行增强搜索
   * @param {string} query - 查询文本
   * @param {object} options - 搜索选项
   * @returns {Promise<object>} 搜索结果
   */
  async search(query, options = {}) {
    const startTime = Date.now();
    
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const {
      topK = SEARCH_CONFIG.defaultTopK,
      filters = {},
      useHybrid = true,
      includeSnippets = true
    } = options;
    
    console.log(`🔍 执行搜索: "${query}"`);
    console.log(`   过滤器:`, filters);
    
    let results = [];
    
    // 策略1: 如果有过滤器，先进行标签过滤
    if (Object.keys(filters).length > 0) {
      const tagResults = this.searchByTags(filters);
      console.log(`   标签过滤: ${tagResults.length} 个结果`);
      
      if (tagResults.length > 0) {
        // 在过滤结果中进行向量搜索
        const filteredIds = new Set(tagResults.map(c => c.chunkId));
        
        // 临时创建子索引
        const subDocs = this.vectorStore.documents.filter(d => filteredIds.has(d.id));
        
        if (subDocs.length > 0) {
          const tempStore = new VectorStore('temp');
          tempStore.documents = subDocs;
          tempStore.vectors = subDocs.map(d => {
            const idx = this.vectorStore.documents.findIndex(doc => doc.id === d.id);
            return this.vectorStore.vectors[idx];
          });
          
          results = await tempStore.search(query, { topK, minScore: 0.3 });
        }
      }
    }
    
    // 策略2: 如果没有标签过滤或结果不足，使用混合搜索
    if (results.length === 0) {
      if (useHybrid) {
        results = await this.vectorStore.hybridSearch(query, { topK, minScore: 0.3 });
      } else {
        results = await this.vectorStore.search(query, { topK, minScore: 0.3 });
      }
    }
    
    // 格式化结果
    const formattedResults = results.map(r => {
      const chunk = this.chunks.find(c => c.chunkId === r.document.id);
      const docMetadata = this.documents.get(r.document.metadata?.docId);
      
      const result = {
        rank: r.rank,
        score: r.finalScore || r.score,
        chunkId: r.document.id,
        docId: r.document.metadata?.docId,
        fileName: docMetadata?.fileName || 'Unknown',
        pageRange: chunk?.pageRange || r.document.metadata?.pageRange,
        sectionTitle: chunk?.sectionTitle || r.document.metadata?.sectionTitle,
        tags: chunk?.tags || r.document.tags,
        text: r.document.text
      };
      
      // 生成摘要片段
      if (includeSnippets) {
        result.snippet = this.generateSnippet(r.document.text, query);
      }
      
      return result;
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ 搜索完成: ${formattedResults.length} 个结果 (${duration}ms)`);
    
    return {
      query,
      filters,
      totalResults: formattedResults.length,
      searchTime: duration,
      results: formattedResults
    };
  }
  
  /**
   * 生成带高亮的摘要片段
   * @param {string} text - 原文本
   * @param {string} query - 查询词
   * @returns {string} 摘要片段
   */
  generateSnippet(text, query) {
    if (!text) return '';
    
    const maxLength = SEARCH_CONFIG.snippetLength;
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    
    // 找到最佳匹配位置
    let bestPos = 0;
    let bestScore = 0;
    
    for (let i = 0; i < text.length - 50; i += 20) {
      const segment = text.slice(i, i + 100).toLowerCase();
      let score = 0;
      
      queryTerms.forEach(term => {
        if (segment.includes(term)) {
          score++;
        }
      });
      
      if (score > bestScore) {
        bestScore = score;
        bestPos = i;
      }
    }
    
    // 提取片段
    const start = Math.max(0, bestPos - 50);
    const end = Math.min(text.length, start + maxLength);
    let snippet = text.slice(start, end);
    
    // 添加省略号
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    
    // 高亮查询词
    queryTerms.forEach(term => {
      const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
      snippet = snippet.replace(regex, `${SEARCH_CONFIG.highlightPre}$1${SEARCH_CONFIG.highlightPost}`);
    });
    
    return snippet;
  }
  
  /**
   * 为文档块添加标签
   * @param {string} chunkId - 块ID
   * @param {object} tags - 标签对象
   */
  addTagsToChunk(chunkId, tags) {
    const chunk = this.chunks.find(c => c.chunkId === chunkId);
    if (chunk) {
      chunk.tags = { ...chunk.tags, ...tags };
      
      // 同步更新向量存储
      const vecDoc = this.vectorStore.documents.find(d => d.id === chunkId);
      if (vecDoc) {
        vecDoc.tags = chunk.tags;
      }
    }
  }
  
  /**
   * 批量为所有文档添加标签
   */
  async tagAllDocuments() {
    console.log('🏷️ 开始为所有文档添加标签...');
    
    const pdfDBPath = path.join(__dirname, 'pdf_database.json');
    
    if (!fs.existsSync(pdfDBPath)) {
      console.warn('⚠️ PDF 数据库不存在');
      return;
    }
    
    const pdfDB = JSON.parse(fs.readFileSync(pdfDBPath, 'utf-8'));
    const docs = pdfDB.documents || [];
    
    let taggedCount = 0;
    
    for (const doc of docs) {
      if (!doc.extractedText) continue;
      
      try {
        // 生成标签
        const tags = tagPDF(doc.extractedText, {
          originalName: doc.originalName,
          id: doc.id
        });
        
        // 应用到该文档的所有块
        const docChunks = this.chunks.filter(c => c.docId === doc.id);
        docChunks.forEach(chunk => {
          chunk.tags = tags;
        });
        
        taggedCount++;
        
        if (taggedCount % 10 === 0) {
          console.log(`   已标注 ${taggedCount}/${docs.length} 个文档`);
        }
      } catch (error) {
        console.error(`   ❌ 标注失败 ${doc.originalName}:`, error.message);
      }
    }
    
    // 保存更新后的数据
    this.saveChunkDB();
    
    // 重建向量索引
    await this.buildVectorIndex();
    
    console.log(`✅ 标注完成: ${taggedCount} 个文档`);
  }
  
  /**
   * 保存分块数据库
   */
  saveChunkDB() {
    try {
      const data = {
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        totalChunks: this.chunks.length,
        chunks: this.chunks
      };
      
      fs.writeFileSync(this.chunkDBPath, JSON.stringify(data, null, 2), 'utf-8');
      console.log('💾 分块数据库已保存');
    } catch (error) {
      console.error('❌ 保存分块数据库失败:', error.message);
    }
  }
  
  /**
   * 获取可用的过滤选项
   * @returns {object} 可用选项
   */
  getFilterOptions() {
    const years = new Set();
    const docTypes = new Set();
    const caseNumbers = new Set();
    
    this.chunks.forEach(chunk => {
      const tags = chunk.tags;
      if (tags?.metadata?.year) {
        years.add(tags.metadata.year);
      }
      if (tags?.documentType?.primary) {
        docTypes.add(tags.documentType.primary);
      }
      if (tags?.metadata?.caseNumber) {
        caseNumbers.add(tags.metadata.caseNumber);
      }
    });
    
    return {
      years: [...years].sort(),
      docTypes: [...docTypes],
      caseNumbers: [...caseNumbers].sort()
    };
  }
}

// ============================================
// 工具函数
// ============================================

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// 导出
// ============================================

module.exports = {
  EnhancedSearcher,
  SEARCH_CONFIG
};