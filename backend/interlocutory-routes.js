/**
 * Interlocutory Applications API 路由
 */

const express = require('express');
const router = express.Router();
const { getInterlocutoryStore } = require('./interlocutory-vector-store');
const { batchProcessInterlocutory } = require('./interlocutory-metadata');
const fs = require('fs').promises;
const path = require('path');

// 获取存储实例
const store = getInterlocutoryStore();

/**
 * POST /api/interlocutory/index
 * 索引文档到 Interlocutory 向量库
 */
router.post('/index', async (req, res) => {
  try {
    const { documents } = req.body;
    
    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({
        success: false,
        error: '请提供 documents 数组'
      });
    }
    
    console.log(`📚 [Interlocutory] Indexing ${documents.length} documents...`);
    
    const results = await store.addDocuments(documents);
    
    res.json({
      success: true,
      indexed: results.length,
      stats: store.getStats()
    });
    
  } catch (error) {
    console.error('❌ [Interlocutory] Index error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/interlocutory/search
 * 搜索 Interlocutory Cases
 */
router.post('/search', async (req, res) => {
  try {
    const { query, type, year, category, topK = 5, searchMode = 'hybrid' } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: '请提供查询内容'
      });
    }
    
    console.log(`🔍 [Interlocutory] Search: "${query}" (mode: ${searchMode})`);
    
    let results;
    const filter = {};
    if (type) filter.type = type;
    if (year) filter.year = parseInt(year);
    if (category) filter.category = category;
    
    switch (searchMode) {
      case 'semantic':
        results = await store.semanticSearch(query, { topK, filter });
        break;
      case 'keyword':
        results = store.keywordSearch(query, { limit: topK });
        break;
      case 'hybrid':
      default:
        results = await store.hybridSearch(query, { topK });
        break;
    }
    
    res.json({
      success: true,
      query,
      searchMode,
      totalFound: results.length,
      results: results.map(r => ({
        caseNumber: r.caseNumber,
        year: r.year,
        types: r.types,
        categories: r.categories,
        applicant: r.parties?.applicant || r.applicant,
        summary: r.summary,
        confidence: r.confidence,
        filename: r.filename,
        relevanceScore: r.similarity || r.relevanceScore || r.finalScore,
        searchType: r.searchType || 'semantic'
      }))
    });
    
  } catch (error) {
    console.error('❌ [Interlocutory] Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/interlocutory/stats
 * 获取统计信息
 */
router.get('/stats', (req, res) => {
  try {
    const stats = store.getStats();
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('❌ [Interlocutory] Stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/interlocutory/cases
 * 获取所有案例列表
 */
router.get('/cases', (req, res) => {
  try {
    const cases = store.exportCases();
    
    res.json({
      success: true,
      total: cases.length,
      cases
    });
    
  } catch (error) {
    console.error('❌ [Interlocutory] Cases error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/interlocutory/analyze-directory
 * 分析整个目录并索引所有 Interlocutory 案例
 */
router.post('/analyze-directory', async (req, res) => {
  try {
    const { directoryPath } = req.body;
    
    if (!directoryPath) {
      return res.status(400).json({
        success: false,
        error: '请提供目录路径'
      });
    }
    
    console.log(`📂 [Interlocutory] Analyzing directory: ${directoryPath}`);
    
    // 读取目录中的所有文件
    const files = await fs.readdir(directoryPath);
    const txtFiles = files.filter(f => f.endsWith('.txt'));
    
    console.log(`   Found ${txtFiles.length} text files`);
    
    const documents = [];
    
    for (const filename of txtFiles) {
      try {
        const content = await fs.readFile(path.join(directoryPath, filename), 'utf-8');
        documents.push({ filename, content });
      } catch (err) {
        console.warn(`⚠️ Failed to read ${filename}:`, err.message);
      }
    }
    
    // 批量处理
    const processed = batchProcessInterlocutory(documents);
    
    // 只索引被识别为 Interlocutory 的文档
    const interlocutoryDocs = documents.filter(doc => {
      return processed.interlocutoryCases.some(c => c.filename === doc.filename);
    });
    
    console.log(`   Identified ${interlocutoryDocs.length} interlocutory cases`);
    
    // 添加到向量库
    const indexed = await store.addDocuments(interlocutoryDocs);
    
    res.json({
      success: true,
      directory: directoryPath,
      totalFiles: txtFiles.length,
      identifiedAsInterlocutory: processed.interlocutoryCases.length,
      indexed: indexed.length,
      byType: processed.byType,
      byYear: processed.byYear,
      cases: processed.interlocutoryCases.map(c => ({
        filename: c.filename,
        caseNumber: c.caseNumber,
        types: c.types,
        applicant: c.parties.applicant
      }))
    });
    
  } catch (error) {
    console.error('❌ [Interlocutory] Analyze directory error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/interlocutory/query
 * 自然语言查询 Interlocutory 案例（搜索所有文档）
 */
router.post('/query', async (req, res) => {
  try {
    const { question, context = '', searchAllDocs = true } = req.body;
    
    if (!question) {
      return res.status(400).json({
        success: false,
        error: '请提供问题'
      });
    }
    
    console.log(`❓ [Interlocutory] Query: "${question}"`);
    console.log(`   Search mode: ${searchAllDocs ? 'All documents' : 'Interlocutory only'}`);
    
    let allResults = [];
    
    // 1. 搜索 Interlocutory 专用库
    const interlocutoryCases = await store.hybridSearch(question, { topK: 5 });
    console.log(`   Found ${interlocutoryCases.length} interlocutory cases`);
    
    allResults = interlocutoryCases.map(c => ({
      ...c,
      source: 'interlocutory',
      type: 'interlocutory_case'
    }));
    
    // 2. 如果启用，同时搜索通用文档库
    if (searchAllDocs) {
      const chunkDB = require('./chunk-database');
      const { VectorSearcher } = require('./vector-search');
      
      const vectorSearcher = new VectorSearcher();
      const allChunks = chunkDB.getAllChunks();
      
      if (allChunks.length > 0) {
        console.log(`   Searching ${allChunks.length} chunks from general database...`);
        
        // 为查询生成向量
        const queryEmbedding = await vectorSearcher.generateEmbedding(question);
        
        // 计算相似度
        const scoredChunks = allChunks
          .map(chunk => ({
            ...chunk,
            similarity: vectorSearcher.cosineSimilarity(queryEmbedding, chunk.embedding)
          }))
          .filter(c => c.similarity >= 0.6)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5);
        
        console.log(`   Found ${scoredChunks.length} relevant chunks from general DB`);
        
        // 添加到结果中
        for (const chunk of scoredChunks) {
          allResults.push({
            filename: chunk.docId,
            text: chunk.text.slice(0, 500),
            similarity: chunk.similarity,
            source: 'general',
            type: 'document_chunk',
            metadata: chunk.metadata
          });
        }
      }
    }
    
    // 3. 重新排序所有结果
    allResults.sort((a, b) => (b.similarity || b.finalScore || 0) - (a.similarity || a.finalScore || 0));
    
    // 取前8个最相关的结果
    const topResults = allResults.slice(0, 8);
    
    if (topResults.length === 0) {
      return res.json({
        success: true,
        answer: '未找到与 Interlocutory Applications 相关的文档内容。',
        sources: []
      });
    }
    
    // 4. 构建上下文
    const contextParts = topResults.map((item, i) => {
      if (item.type === 'interlocutory_case') {
        return `
[来源 ${i + 1}] Interlocutory Case: ${item.caseNumber || 'N/A'} (${item.year || 'N/A'})
类型: ${item.types?.join(', ') || 'N/A'}
申请人: ${item.parties?.applicant || item.applicant || 'N/A'}
摘要: ${item.summary || 'N/A'}
关键议题: ${item.keyIssues?.join('; ') || 'N/A'}
`;
      } else {
        return `
[来源 ${i + 1}] Document: ${item.filename}
类型: ${item.metadata?.tags?.join(', ') || 'General Document'}
内容片段: ${item.text?.slice(0, 300)}...
`;
      }
    });
    
    const combinedContext = contextParts.join('\n---\n');

    // 5. 调用 AI 生成回答
    const axios = require('axios');
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `你是香港证券及期货事务上诉审裁处(SFAT) Interlocutory Applications 的法律专家。
请基于提供的文档和案例信息，回答用户关于中期申请的问题。
回答应包括：
1. 直接回答用户问题
2. 引用相关案例或文档（注明来源）
3. 解释法律原则或程序要点
4. 区分正式 Interlocutory 决定和普通文档中的相关内容
5. 如适用，说明不同案例/文档之间的关联`
          },
          {
            role: 'user',
            content: `${context ? '背景信息：\n' + context + '\n\n' : ''}问题：${question}

检索到的相关文档和案例：
${combinedContext}

请基于以上信息提供详细的分析和回答。注意区分正式的 Interlocutory Application 决定和普通参考文档。`
          }
        ],
        temperature: 0.3,
        max_tokens: 2500
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const answer = response.data.choices[0].message.content;
    
    res.json({
      success: true,
      question,
      answer,
      searchMode: searchAllDocs ? 'comprehensive' : 'interlocutory_only',
      totalSources: topResults.length,
      sources: topResults.map(item => ({
        type: item.type,
        source: item.source,
        filename: item.filename,
        caseNumber: item.caseNumber,
        year: item.year,
        applicant: item.parties?.applicant || item.applicant,
        tags: item.metadata?.tags,
        relevanceScore: item.similarity || item.finalScore
      }))
    });
    
  } catch (error) {
    console.error('❌ [Interlocutory] Query error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
