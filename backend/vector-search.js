/**
 * ClawText 向量检索模块 (RAG)
 * 
 * 功能：
 * 1. 文本向量化（使用本地嵌入或 API）
 * 2. 相似度搜索
 * 3. 结果重排序
 * 4. 缓存管理
 * 
 * 注意：当前使用简化的 TF-IDF + 余弦相似度
 * 后续可升级到真正的向量数据库 (FAISS/Milvus/Chroma)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================
// 配置
// ============================================
const VECTOR_CONFIG = {
  // 向量缓存目录
  cacheDir: path.join(__dirname, 'vector_cache'),
  // 最大检索结果数
  maxResults: 10,
  // 相似度阈值 (0-1)
  similarityThreshold: 0.3,
  // 启用缓存
  enableCache: true,
  // 缓存过期时间 (毫秒)
  cacheExpiry: 24 * 60 * 60 * 1000, // 24 小时
  // 使用 API 嵌入（如果可用）
  useApiEmbedding: false,
  // API 端点（可选）
  embeddingApiUrl: null
};

// 确保缓存目录存在
if (!fs.existsSync(VECTOR_CONFIG.cacheDir)) {
  fs.mkdirSync(VECTOR_CONFIG.cacheDir, { recursive: true });
}

// ============================================
// TF-IDF 向量化（简化版）
// ============================================

class SimpleVectorizer {
  constructor() {
    this.documents = [];
    this.vocabulary = new Map();
    this.idf = new Map();
    this.isTrained = false;
  }
  
  /**
   * 训练向量器
   * @param {Array} documents - 文档数组
   */
  train(documents) {
    this.documents = documents;
    this.vocabulary.clear();
    this.idf.clear();
    
    // 构建词汇表
    const docFreq = new Map();
    
    documents.forEach((doc, docIndex) => {
      const tokens = this._tokenize(doc.text || doc.content);
      const uniqueTokens = new Set(tokens);
      
      uniqueTokens.forEach(token => {
        if (!this.vocabulary.has(token)) {
          this.vocabulary.set(token, this.vocabulary.size);
        }
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      });
    });
    
    // 计算 IDF
    const numDocs = documents.length;
    docFreq.forEach((freq, token) => {
      this.idf.set(token, Math.log((numDocs + 1) / (freq + 1)) + 1);
    });
    
    this.isTrained = true;
    console.log(`📚 向量器训练完成：${this.vocabulary.size} 个词，${numDocs} 个文档`);
  }
  
  /**
   * 将文本转换为向量
   * @param {string} text - 文本
   * @returns {Map} 稀疏向量
   */
  transform(text) {
    if (!this.isTrained) {
      throw new Error('向量器未训练，请先调用 train()');
    }
    
    const tokens = this._tokenize(text);
    const tf = new Map();
    
    // 计算词频
    tokens.forEach(token => {
      tf.set(token, (tf.get(token) || 0) + 1);
    });
    
    // 归一化 TF
    const maxFreq = Math.max(...tf.values(), 1);
    tf.forEach((freq, token) => {
      tf.set(token, freq / maxFreq);
    });
    
    // 计算 TF-IDF
    const tfidf = new Map();
    tf.forEach((tfVal, token) => {
      if (this.idf.has(token)) {
        tfidf.set(token, tfVal * this.idf.get(token));
      }
    });
    
    return tfidf;
  }
  
  /**
   * 分词
   * @param {string} text - 文本
   * @returns {Array} 词元列表
   */
  _tokenize(text) {
    if (!text) return [];
    
    // 转换为小写
    text = text.toLowerCase();
    
    // 提取单词（包括连字符）
    const tokens = text.match(/[a-z][a-z0-9-]*/g) || [];
    
    // 过滤停用词和短词
    const stopwords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'this', 'that', 'these', 'those', 'it', 'its', 'as', 'so', 'than',
      'into', 'upon', 'under', 'over', 'through', 'between', 'among'
    ]);
    
    return tokens.filter(token => 
      token.length > 2 && !stopwords.has(token)
    );
  }
}

// ============================================
// 相似度计算
// ============================================

/**
 * 计算余弦相似度
 * @param {Map} vec1 - 向量 1
 * @param {Map} vec2 - 向量 2
 * @returns {number} 相似度 (0-1)
 */
function cosineSimilarity(vec1, vec2) {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  // 计算点积
  vec1.forEach((val1, key) => {
    if (vec2.has(key)) {
      dotProduct += val1 * vec2.get(key);
    }
  });
  
  // 计算范数
  vec1.forEach(val => {
    norm1 += val * val;
  });
  vec2.forEach(val => {
    norm2 += val * val;
  });
  
  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);
  
  if (norm1 === 0 || norm2 === 0) return 0;
  
  return dotProduct / (norm1 * norm2);
}

// ============================================
// 向量搜索器
// ============================================

class VectorSearcher {
  constructor() {
    this.vectorizer = new SimpleVectorizer();
    this.documents = [];
    this.vectors = [];
    this.isReady = false;
  }
  
  /**
   * 索引文档
   * @param {Array} documents - 文档数组 [{chunkId, docId, text, metadata}]
   */
  indexDocuments(documents) {
    console.log(`📑 开始索引 ${documents.length} 个文档块...`);
    
    this.documents = documents;
    
    // 训练向量器
    this.vectorizer.train(documents);
    
    // 计算所有文档的向量
    this.vectors = documents.map(doc => 
      this.vectorizer.transform(doc.text || doc.content)
    );
    
    this.isReady = true;
    console.log(`✅ 索引完成：${documents.length} 个块，${this.vectorizer.vocabulary.size} 个词`);
  }
  
  /**
   * 搜索相似文档
   * @param {string} query - 查询文本
   * @param {number} topK - 返回结果数
   * @param {object} filters - 过滤器
   * @returns {Array} 搜索结果
   */
  search(query, topK = 10, filters = {}) {
    if (!this.isReady) {
      throw new Error('搜索器未就绪，请先索引文档');
    }
    
    // 将查询转换为向量
    const queryVector = this.vectorizer.transform(query);
    
    // 计算所有文档的相似度
    const scores = this.documents.map((doc, index) => ({
      doc,
      score: cosineSimilarity(queryVector, this.vectors[index]),
      index
    }));
    
    // 应用过滤器
    let filtered = scores;
    if (filters.category) {
      filtered = filtered.filter(s => s.doc.metadata?.category === filters.category);
    }
    if (filters.docId) {
      filtered = filtered.filter(s => s.doc.docId === filters.docId);
    }
    if (filters.minScore) {
      filtered = filtered.filter(s => s.score >= filters.minScore);
    }
    
    // 排序并返回 TopK
    filtered.sort((a, b) => b.score - a.score);
    
    const results = filtered.slice(0, topK).map(s => ({
      chunkId: s.doc.chunkId,
      docId: s.doc.docId,
      text: s.doc.text || s.doc.content,
      score: s.score,
      metadata: s.doc.metadata,
      rank: filtered.indexOf(s) + 1
    }));
    
    return results;
  }
  
  /**
   * 批量搜索（多组替换对比）
   * @param {string} originalQuery - 原始查询
   * @param {Array} replacementSets - 替换对集合
   * @param {object} filters - 过滤器
   * @returns {object} 对比结果
   */
  batchSearch(originalQuery, replacementSets, filters = {}) {
    const results = {
      original: {
        query: originalQuery,
        results: this.search(originalQuery, VECTOR_CONFIG.maxResults, filters)
      },
      variants: []
    };
    
    replacementSets.forEach(set => {
      let variantQuery = originalQuery;
      
      // 应用替换
      (set.replacements || []).forEach(({ from, to }) => {
        const regex = new RegExp(`\\b${escapeRegex(from)}\\b`, 'gi');
        variantQuery = variantQuery.replace(regex, to);
      });
      
      results.variants.push({
        name: set.name,
        query: variantQuery,
        results: this.search(variantQuery, VECTOR_CONFIG.maxResults, filters)
      });
    });
    
    // 计算一致性分数
    results.consistency = this._calculateConsistency(results);
    
    return results;
  }
  
  /**
   * 计算一致性分数
   * @param {object} results - 搜索结果
   * @returns {object} 一致性分析
   */
  _calculateConsistency(results) {
    const originalIds = new Set(results.original.results.map(r => r.chunkId));
    let totalOverlap = 0;
    
    results.variants.forEach(variant => {
      const variantIds = new Set(variant.results.map(r => r.chunkId));
      const overlap = [...originalIds].filter(id => variantIds.has(id)).length;
      totalOverlap += overlap / Math.max(originalIds.size, 1);
    });
    
    const avgOverlap = results.variants.length > 0 
      ? totalOverlap / results.variants.length 
      : 1;
    
    return {
      score: Math.round(avgOverlap * 100),
      level: avgOverlap > 0.7 ? '高' : avgOverlap > 0.4 ? '中' : '低',
      description: avgOverlap > 0.7 
        ? '优秀 - 替换对检索结果高度一致' 
        : avgOverlap > 0.4 
        ? '一般 - 检索结果有差异' 
        : '较差 - 替换对导致检索结果显著不同'
    };
  }
  
  /**
   * 获取统计信息
   * @returns {object} 统计信息
   */
  getStats() {
    return {
      totalDocuments: this.documents.length,
      vocabularySize: this.vectorizer.vocabulary.size,
      isReady: this.isReady
    };
  }
}

// ============================================
// 缓存管理
// ============================================

/**
 * 获取缓存键
 * @param {string} query - 查询
 * @param {object} filters - 过滤器
 * @returns {string} 缓存键
 */
function getCacheKey(query, filters) {
  const keyData = JSON.stringify({ query, filters });
  return crypto.createHash('md5').update(keyData).digest('hex');
}

/**
 * 从缓存获取结果
 * @param {string} cacheKey - 缓存键
 * @returns {object|null} 缓存结果
 */
function getFromCache(cacheKey) {
  if (!VECTOR_CONFIG.enableCache) return null;
  
  const cacheFile = path.join(VECTOR_CONFIG.cacheDir, `${cacheKey}.json`);
  
  if (fs.existsSync(cacheFile)) {
    const stats = fs.statSync(cacheFile);
    const age = Date.now() - stats.mtimeMs;
    
    if (age < VECTOR_CONFIG.cacheExpiry) {
      try {
        const data = fs.readFileSync(cacheFile, 'utf-8');
        return JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
  }
  
  return null;
}

/**
 * 保存结果到缓存
 * @param {string} cacheKey - 缓存键
 * @param {object} data - 数据
 */
function saveToCache(cacheKey, data) {
  if (!VECTOR_CONFIG.enableCache) return;
  
  const cacheFile = path.join(VECTOR_CONFIG.cacheDir, `${cacheKey}.json`);
  fs.writeFileSync(cacheFile, JSON.stringify(data), 'utf-8');
}

// ============================================
// 工具函数
// ============================================

/**
 * 转义正则表达式特殊字符
 * @param {string} string - 字符串
 * @returns {string} 转义后的字符串
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// 导出
// ============================================

module.exports = {
  VECTOR_CONFIG,
  SimpleVectorizer,
  VectorSearcher,
  cosineSimilarity,
  getCacheKey,
  getFromCache,
  saveToCache,
  escapeRegex
};
