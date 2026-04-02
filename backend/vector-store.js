/**
 * ClawText 向量存储与语义检索模块
 * 
 * 功能：
 * 1. 文本向量化（支持本地模型或 API）
 * 2. 向量索引构建与管理
 * 3. 相似度搜索（余弦相似度）
 * 4. 混合检索（关键词 + 向量）
 * 5. 标签过滤检索
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ============================================
// 配置
// ============================================
const VECTOR_STORE_CONFIG = {
  // 向量维度（取决于嵌入模型）
  vectorDimension: 384, // all-MiniLM-L6-v2 的维度
  
  // 默认嵌入模型
  embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
  
  // 是否使用 Python 进行嵌入（需要安装 sentence-transformers）
  usePythonEmbedding: true,
  
  // Python 脚本路径
  pythonScriptPath: path.join(__dirname, 'embeddings.py'),
  
  // 向量存储目录
  storeDir: path.join(__dirname, 'vector_store'),
  
  // 缓存目录
  cacheDir: path.join(__dirname, 'vector_cache'),
  
  // 最大检索结果数
  maxResults: 20,
  
  // 相似度阈值
  similarityThreshold: 0.5,
  
  // 启用缓存
  enableCache: true
};

// 确保目录存在
[VECTOR_STORE_CONFIG.storeDir, VECTOR_STORE_CONFIG.cacheDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============================================
// Python 嵌入脚本生成
// ============================================

function ensurePythonScript() {
  const scriptContent = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ClawText 文本嵌入生成脚本
使用 sentence-transformers 生成文本向量
"""

import sys
import json
import numpy as np
from sentence_transformers import SentenceTransformer

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input provided"}), file=sys.stderr)
        sys.exit(1)
    
    try:
        # 解析输入
        input_data = json.loads(sys.argv[1])
        texts = input_data.get('texts', [])
        model_name = input_data.get('model', 'sentence-transformers/all-MiniLM-L6-v2')
        
        if not texts:
            print(json.dumps({"error": "No texts to encode"}), file=sys.stderr)
            sys.exit(1)
        
        # 加载模型
        model = SentenceTransformer(model_name)
        
        # 生成嵌入
        embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        
        # 转换为列表并输出
        result = {
            "embeddings": embeddings.tolist(),
            "dimensions": embeddings.shape[1],
            "count": len(texts)
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
`;

  if (!fs.existsSync(VECTOR_STORE_CONFIG.pythonScriptPath)) {
    fs.writeFileSync(VECTOR_STORE_CONFIG.pythonScriptPath, scriptContent, 'utf-8');
    console.log('✅ Python 嵌入脚本已生成');
  }
}

// ============================================
// 向量生成
// ============================================

/**
 * 使用 Python 生成文本嵌入
 * @param {Array<string>} texts - 文本数组
 * @returns {Promise<Array<Array<number>>>} 向量数组
 */
async function generateEmbeddings(texts) {
  if (!texts || texts.length === 0) {
    return [];
  }
  
  // 检查 Python 和 sentence-transformers 是否可用
  try {
    ensurePythonScript();
    
    const inputData = JSON.stringify({
      texts: texts.map(t => t.slice(0, 5000)), // 限制长度
      model: VECTOR_STORE_CONFIG.embeddingModel
    });
    
    const result = execSync(`python "${VECTOR_STORE_CONFIG.pythonScriptPath}" '${inputData.replace(/'/g, "'\\''")}'`, {
      encoding: 'utf-8',
      timeout: 120000,
      maxBuffer: 50 * 1024 * 1024 // 50MB
    });
    
    const output = JSON.parse(result);
    
    if (output.error) {
      throw new Error(output.error);
    }
    
    return output.embeddings;
    
  } catch (error) {
    console.warn('⚠️ Python 嵌入失败，使用简化版 TF-IDF:', error.message);
    return generateSimpleEmbeddings(texts);
  }
}

/**
 * 生成简化版嵌入（TF-IDF 风格）
 * @param {Array<string>} texts - 文本数组
 * @returns {Array<Array<number>>} 向量数组
 */
function generateSimpleEmbeddings(texts) {
  // 构建词汇表
  const vocabulary = new Map();
  const docFreq = new Map();
  
  texts.forEach(text => {
    const tokens = tokenize(text);
    const uniqueTokens = new Set(tokens);
    
    uniqueTokens.forEach(token => {
      if (!vocabulary.has(token)) {
        vocabulary.set(token, vocabulary.size);
      }
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    });
  });
  
  // 计算 IDF
  const numDocs = texts.length;
  const idf = new Map();
  docFreq.forEach((freq, token) => {
    idf.set(token, Math.log((numDocs + 1) / (freq + 1)) + 1);
  });
  
  // 生成向量
  const vectors = texts.map(text => {
    const tokens = tokenize(text);
    const tf = new Map();
    
    tokens.forEach(token => {
      tf.set(token, (tf.get(token) || 0) + 1);
    });
    
    // 归一化 TF
    const maxFreq = Math.max(...tf.values(), 1);
    tf.forEach((freq, token) => {
      tf.set(token, freq / maxFreq);
    });
    
    // 构建稀疏向量
    const vector = new Array(Math.min(vocabulary.size, 1000)).fill(0);
    
    tf.forEach((tfVal, token) => {
      const idx = vocabulary.get(token);
      if (idx !== undefined && idx < 1000) {
        vector[idx] = tfVal * (idf.get(token) || 1);
      }
    });
    
    // 归一化
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      return vector.map(v => v / norm);
    }
    return vector;
  });
  
  return vectors;
}

/**
 * 分词
 * @param {string} text - 文本
 * @returns {Array<string>} 词元列表
 */
function tokenize(text) {
  if (!text) return [];
  
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !isStopword(w));
}

/**
 * 检查是否为停用词
 * @param {string} word - 单词
 * @returns {boolean}
 */
function isStopword(word) {
  const stopwords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his'
  ]);
  return stopwords.has(word);
}

// ============================================
// 向量存储类
// ============================================

class VectorStore {
  constructor(name = 'default') {
    this.name = name;
    this.storePath = path.join(VECTOR_STORE_CONFIG.storeDir, `${name}.json`);
    this.documents = [];
    this.vectors = [];
    this.metadata = {};
    this.isLoaded = false;
  }
  
  /**
   * 加载存储
   */
  load() {
    if (fs.existsSync(this.storePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
        this.documents = data.documents || [];
        this.vectors = data.vectors || [];
        this.metadata = data.metadata || {};
        this.isLoaded = true;
        console.log(`📚 向量存储已加载: ${this.name} (${this.documents.length} 个文档)`);
      } catch (error) {
        console.error('❌ 加载向量存储失败:', error.message);
      }
    }
  }
  
  /**
   * 保存存储
   */
  save() {
    try {
      const data = {
        name: this.name,
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        documents: this.documents,
        vectors: this.vectors,
        metadata: this.metadata
      };
      
      fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`💾 向量存储已保存: ${this.name}`);
    } catch (error) {
      console.error('❌ 保存向量存储失败:', error.message);
    }
  }
  
  /**
   * 添加文档
   * @param {Array} documents - 文档数组 [{ id, text, metadata, tags }]
   */
  async addDocuments(documents) {
    if (!documents || documents.length === 0) return;
    
    console.log(`📝 添加 ${documents.length} 个文档到向量存储...`);
    
    // 生成嵌入
    const texts = documents.map(d => d.text || d.content);
    const embeddings = await generateEmbeddings(texts);
    
    // 添加到存储
    documents.forEach((doc, i) => {
      this.documents.push({
        id: doc.id || `doc_${Date.now()}_${i}`,
        text: doc.text || doc.content,
        metadata: doc.metadata || {},
        tags: doc.tags || {}
      });
      
      this.vectors.push(embeddings[i] || []);
    });
    
    this.metadata.totalDocs = this.documents.length;
    this.metadata.lastUpdated = new Date().toISOString();
    
    console.log(`✅ 已添加 ${documents.length} 个文档`);
  }
  
  /**
   * 语义搜索
   * @param {string} query - 查询文本
   * @param {object} options - 选项 { topK, filters, minScore }
   * @returns {Promise<Array>} 搜索结果
   */
  async search(query, options = {}) {
    const { topK = 10, filters = {}, minScore = 0.5 } = options;
    
    if (this.vectors.length === 0) {
      return [];
    }
    
    // 生成查询向量
    const queryEmbeddings = await generateEmbeddings([query]);
    const queryVector = queryEmbeddings[0];
    
    // 计算相似度
    const scores = this.vectors.map((vector, index) => ({
      index,
      score: cosineSimilarity(queryVector, vector),
      document: this.documents[index]
    }));
    
    // 应用过滤器
    let results = scores;
    
    if (filters.year) {
      results = results.filter(r => 
        r.document.tags?.metadata?.year === filters.year ||
        r.document.metadata?.year === filters.year
      );
    }
    
    if (filters.docType) {
      results = results.filter(r => 
        r.document.tags?.documentType?.primary === filters.docType
      );
    }
    
    if (filters.caseNumber) {
      results = results.filter(r => 
        r.document.tags?.metadata?.caseNumber?.includes(filters.caseNumber)
      );
    }
    
    if (filters.legalRef) {
      results = results.filter(r => {
        const refs = r.document.tags?.legalReferences;
        if (!refs) return false;
        return Object.values(refs).some(arr => 
          arr.some(ref => ref.includes(filters.legalRef))
        );
      });
    }
    
    // 按分数排序并返回
    results.sort((a, b) => b.score - a.score);
    
    return results
      .filter(r => r.score >= minScore)
      .slice(0, topK)
      .map((r, i) => ({
        rank: i + 1,
        score: Math.round(r.score * 1000) / 1000,
        document: r.document
      }));
  }
  
  /**
   * 混合搜索（关键词 + 向量）
   * @param {string} query - 查询文本
   * @param {object} options - 选项
   * @returns {Promise<Array>} 搜索结果
   */
  async hybridSearch(query, options = {}) {
    const { keywordWeight = 0.3, vectorWeight = 0.7, ...searchOptions } = options;
    
    // 向量搜索结果
    const vectorResults = await this.search(query, { ...searchOptions, topK: 50 });
    
    // 关键词匹配分数
    const queryTerms = tokenize(query);
    
    const keywordScores = this.documents.map((doc, index) => {
      const docTerms = tokenize(doc.text);
      let matches = 0;
      
      queryTerms.forEach(term => {
        if (docTerms.includes(term)) {
          matches++;
        }
      });
      
      return {
        index,
        score: matches / Math.max(queryTerms.length, 1)
      };
    });
    
    // 合并分数
    const combinedScores = new Map();
    
    vectorResults.forEach(r => {
      const docId = r.document.id;
      combinedScores.set(docId, {
        document: r.document,
        vectorScore: r.score,
        keywordScore: 0,
        finalScore: r.score * vectorWeight
      });
    });
    
    keywordScores.forEach(({ index, score }) => {
      const doc = this.documents[index];
      const existing = combinedScores.get(doc.id);
      
      if (existing) {
        existing.keywordScore = score;
        existing.finalScore += score * keywordWeight;
      } else if (score > 0) {
        combinedScores.set(doc.id, {
          document: doc,
          vectorScore: 0,
          keywordScore: score,
          finalScore: score * keywordWeight
        });
      }
    });
    
    // 排序并返回
    return Array.from(combinedScores.values())
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, options.topK || 10)
      .map((r, i) => ({
        rank: i + 1,
        finalScore: Math.round(r.finalScore * 1000) / 1000,
        vectorScore: Math.round(r.vectorScore * 1000) / 1000,
        keywordScore: Math.round(r.keywordScore * 1000) / 1000,
        document: r.document
      }));
  }
  
  /**
   * 获取统计信息
   * @returns {object} 统计信息
   */
  getStats() {
    return {
      name: this.name,
      totalDocuments: this.documents.length,
      vectorDimension: this.vectors[0]?.length || 0,
      lastUpdated: this.metadata.lastUpdated
    };
  }
  
  /**
   * 清空存储
   */
  clear() {
    this.documents = [];
    this.vectors = [];
    this.metadata = {};
    console.log(`🗑️ 向量存储已清空: ${this.name}`);
  }
}

// ============================================
// 相似度计算
// ============================================

/**
 * 计算余弦相似度
 * @param {Array<number>} vec1 - 向量1
 * @param {Array<number>} vec2 - 向量2
 * @returns {number} 相似度 (0-1)
 */
function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  if (norm1 === 0 || norm2 === 0) return 0;
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// ============================================
// 导出
// ============================================

module.exports = {
  VectorStore,
  generateEmbeddings,
  generateSimpleEmbeddings,
  cosineSimilarity,
  VECTOR_STORE_CONFIG,
  ensurePythonScript
};