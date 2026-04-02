/**
 * Interlocutory Applications 专用向量存储
 * 使用内存向量存储 + 相似度搜索
 */

const { extractInterlocutoryMetadata, prepareForVectorSearch, queryInterlocutory } = require('./interlocutory-metadata');
const axios = require('axios');

class InterlocutoryVectorStore {
  constructor() {
    this.documents = []; // 存储文档向量
    this.metadata = [];  // 存储元数据
    this.initialized = false;
    this.embeddingCache = new Map(); // 向量缓存
  }

  /**
   * 生成文本的向量嵌入
   */
  async generateEmbedding(text) {
    // 检查缓存
    const cacheKey = text.slice(0, 100); // 使用前100字符作为缓存键
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey);
    }

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          input: text.slice(0, 8000), // OpenAI限制
          model: 'text-embedding-3-small'
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const embedding = response.data.data[0].embedding;
      
      // 缓存结果
      this.embeddingCache.set(cacheKey, embedding);
      
      return embedding;
    } catch (error) {
      console.error('❌ [Interlocutory] Embedding generation failed:', error.message);
      throw error;
    }
  }

  /**
   * 计算余弦相似度
   */
  cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 添加文档到向量库
   */
  async addDocument(filename, content) {
    // 提取元数据
    const metadata = extractInterlocutoryMetadata(filename, content);
    
    if (!metadata.isInterlocutory) {
      console.log(`⚠️ [Interlocutory] Skipping non-interlocutory document: ${filename}`);
      return null;
    }

    console.log(`📄 [Interlocutory] Processing: ${filename}`);
    console.log(`   Case: ${metadata.caseNumber || 'N/A'}, Types: ${metadata.types.join(', ') || 'N/A'}`);

    // 准备增强文本
    const prepared = prepareForVectorSearch(metadata, content);
    
    // 生成向量
    const embedding = await this.generateEmbedding(prepared.text);
    
    // 存储
    const docEntry = {
      id: filename,
      embedding: embedding,
      text: prepared.text,
      metadata: metadata,
      addedAt: new Date().toISOString()
    };
    
    this.documents.push(docEntry);
    this.metadata.push(metadata);
    
    console.log(`✅ [Interlocutory] Added to vector store: ${filename}`);
    
    return metadata;
  }

  /**
   * 批量添加文档
   */
  async addDocuments(documents) {
    const results = [];
    
    for (const doc of documents) {
      try {
        const result = await this.addDocument(doc.filename, doc.content);
        if (result) results.push(result);
      } catch (error) {
        console.error(`❌ [Interlocutory] Failed to add ${doc.filename}:`, error.message);
      }
    }
    
    console.log(`\n📊 [Interlocutory] Vector Store Summary:`);
    console.log(`   Total interlocutory cases: ${this.documents.length}`);
    
    // 按类型统计
    const typeCount = {};
    for (const meta of this.metadata) {
      for (const type of meta.types) {
        typeCount[type] = (typeCount[type] || 0) + 1;
      }
    }
    console.log(`   By Type:`, typeCount);
    
    // 按年份统计
    const yearCount = {};
    for (const meta of this.metadata) {
      if (meta.year) {
        yearCount[meta.year] = (yearCount[meta.year] || 0) + 1;
      }
    }
    console.log(`   By Year:`, yearCount);
    
    return results;
  }

  /**
   * 语义搜索
   */
  async semanticSearch(query, options = {}) {
    const { topK = 5, threshold = 0.7, filter = {} } = options;
    
    console.log(`🔍 [Interlocutory] Semantic search: "${query}"`);
    
    // 生成查询向量
    const queryEmbedding = await this.generateEmbedding(query);
    
    // 计算相似度
    const scores = this.documents.map((doc, index) => {
      // 应用过滤器
      if (filter.type && !doc.metadata.types.includes(filter.type)) {
        return null;
      }
      if (filter.year && doc.metadata.year !== filter.year) {
        return null;
      }
      if (filter.category && !doc.metadata.categories.includes(filter.category)) {
        return null;
      }
      
      const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
      return {
        index,
        similarity,
        document: doc
      };
    }).filter(item => item !== null && item.similarity >= threshold);
    
    // 排序并返回前K个
    scores.sort((a, b) => b.similarity - a.similarity);
    
    const results = scores.slice(0, topK).map(item => ({
      ...item.document.metadata,
      similarity: item.similarity,
      text: item.document.text.slice(0, 500) + '...' // 预览
    }));
    
    console.log(`✅ [Interlocutory] Found ${results.length} relevant cases`);
    
    return results;
  }

  /**
   * 关键词搜索（基于元数据）
   */
  keywordSearch(query, options = {}) {
    const { limit = 10 } = options;
    
    console.log(`🔍 [Interlocutory] Keyword search: "${query}"`);
    
    const results = queryInterlocutory(this.metadata, query);
    
    return results.slice(0, limit);
  }

  /**
   * 混合搜索（语义 + 关键词）
   */
  async hybridSearch(query, options = {}) {
    const { topK = 5 } = options;
    
    // 并行执行两种搜索
    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticSearch(query, { topK: topK * 2, threshold: 0.6 }),
      this.keywordSearch(query, { limit: topK * 2 })
    ]);
    
    // 合并结果并去重
    const seen = new Set();
    const combined = [];
    
    // 先添加语义搜索结果（权重更高）
    for (const result of semanticResults) {
      if (!seen.has(result.filename)) {
        seen.add(result.filename);
        combined.push({ ...result, searchType: 'semantic', finalScore: result.similarity });
      }
    }
    
    // 再添加关键词搜索结果
    for (const result of keywordResults) {
      if (!seen.has(result.filename)) {
        seen.add(result.filename);
        // 将相关性分数归一化到0-1范围
        const normalizedScore = Math.min(result.relevanceScore / 10, 1);
        combined.push({ ...result, searchType: 'keyword', finalScore: normalizedScore * 0.8 });
      }
    }
    
    // 按最终分数排序
    combined.sort((a, b) => b.finalScore - a.finalScore);
    
    return combined.slice(0, topK);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const stats = {
      totalCases: this.documents.length,
      byType: {},
      byYear: {},
      byCategory: {}
    };
    
    for (const meta of this.metadata) {
      // 按类型统计
      for (const type of meta.types) {
        stats.byType[type] = (stats.byType[type] || 0) + 1;
      }
      
      // 按年份统计
      if (meta.year) {
        stats.byYear[meta.year] = (stats.byYear[meta.year] || 0) + 1;
      }
      
      // 按类别统计
      for (const cat of meta.categories) {
        stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
      }
    }
    
    return stats;
  }

  /**
   * 导出所有案例
   */
  exportCases() {
    return this.metadata.map(meta => ({
      caseNumber: meta.caseNumber,
      year: meta.year,
      types: meta.types,
      categories: meta.categories,
      applicant: meta.parties.applicant,
      summary: meta.summary,
      confidence: meta.confidence,
      filename: meta.filename
    }));
  }

  /**
   * 清空存储
   */
  clear() {
    this.documents = [];
    this.metadata = [];
    this.embeddingCache.clear();
    console.log('🗑️ [Interlocutory] Vector store cleared');
  }
}

// 单例实例
let instance = null;

function getInterlocutoryStore() {
  if (!instance) {
    instance = new InterlocutoryVectorStore();
  }
  return instance;
}

module.exports = {
  InterlocutoryVectorStore,
  getInterlocutoryStore
};
