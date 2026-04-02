const fs = require('fs');
const path = require('path');
const axios = require('axios');

class VectorSearch {
  constructor(options = {}) {
    this.chunkDBPath = options.chunkDBPath || path.join(__dirname, '../backend/chunks_database.json');
    this.apiKey = options.apiKey || process.env.DASHSCOPE_API_KEY;
    if (!this.apiKey) {
      console.warn('未配置 DASHSCOPE_API_KEY 环境变量');
    }
    this.vectorCache = new Map();
  }

  readChunkDB() {
    try {
      if (fs.existsSync(this.chunkDBPath)) {
        const data = fs.readFileSync(this.chunkDBPath, 'utf-8');
        return JSON.parse(data);
      }
      return { chunks: [], docs: {} };
    } catch (error) {
      console.error('读取分块数据库失败:', error.message);
      return { chunks: [], docs: {} };
    }
  }

  async generateEmbedding(text) {
    if (!this.apiKey) {
      throw new Error('未配置 DASHSCOPE_API_KEY 环境变量');
    }

    try {
      const response = await axios.post(
        'https://coding.dashscope.aliyuncs.com/v1/embeddings',
        {
          model: 'text-embedding-v1',
          input: text,
          encoding_format: 'float'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data[0].embedding;
    } catch (error) {
      console.error('生成向量失败:', error.message);
      throw new Error(`生成向量失败: ${error.message}`);
    }
  }

  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('向量长度不一致');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  async search(params) {
    const { query, topK = 5 } = params;

    if (!query) {
      throw new Error('请输入搜索查询');
    }

    const chunkDB = this.readChunkDB();
    if (!chunkDB.chunks || chunkDB.chunks.length === 0) {
      return {
        success: true,
        results: [],
        message: '分块数据库为空'
      };
    }

    try {
      // 生成查询向量
      const queryEmbedding = await this.generateEmbedding(query);

      // 计算相似度
      const similarities = [];

      for (const chunk of chunkDB.chunks) {
        if (chunk.embedding) {
          const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
          similarities.push({
            chunk: chunk,
            similarity: similarity
          });
        }
      }

      // 排序并取前 topK 个
      similarities.sort((a, b) => b.similarity - a.similarity);
      const topResults = similarities.slice(0, topK);

      // 构建结果
      const results = topResults.map(item => ({
        chunkId: item.chunk.chunkId,
        docId: item.chunk.docId,
        docName: chunkDB.docs[item.chunk.docId]?.title || 'Unknown',
        content: item.chunk.content.substring(0, 300) + '...',
        similarity: item.similarity.toFixed(4),
        category: item.chunk.category
      }));

      return {
        success: true,
        results: results,
        total: results.length,
        query: query
      };
    } catch (error) {
      console.error('搜索失败:', error.message);
      throw new Error(`搜索失败: ${error.message}`);
    }
  }

  async generateEmbeddingsForChunks() {
    const chunkDB = this.readChunkDB();
    if (!chunkDB.chunks || chunkDB.chunks.length === 0) {
      return {
        success: false,
        message: '分块数据库为空'
      };
    }

    let processed = 0;
    let failed = 0;

    for (const chunk of chunkDB.chunks) {
      if (!chunk.embedding) {
        try {
          const embedding = await this.generateEmbedding(chunk.content);
          chunk.embedding = embedding;
          processed++;
        } catch (error) {
          console.error(`生成向量失败 for chunk ${chunk.chunkId}:`, error.message);
          failed++;
        }
      }
    }

    // 保存更新后的数据库
    try {
      fs.writeFileSync(this.chunkDBPath, JSON.stringify(chunkDB, null, 2));
    } catch (error) {
      console.error('保存向量失败:', error.message);
      return {
        success: false,
        message: '保存向量失败',
        processed: processed,
        failed: failed
      };
    }

    return {
      success: true,
      processed: processed,
      failed: failed,
      message: `成功生成 ${processed} 个向量，失败 ${failed} 个`
    };
  }
}

module.exports = VectorSearch;