/**
 * 结构化标注 API 路由模块
 */

const express = require('express');
const router = express.Router();
const pdfAnnotator = require('./pdf-annotator');
const chunkDB = require('./chunk-database');
const { VectorSearcher } = require('./vector-search');

const vectorSearcher = new VectorSearcher();

// ============================================
// 结构化标注 API
// ============================================

/**
 * POST /api/annotate
 * 对PDF内容进行结构化标注
 */
router.post('/annotate', (req, res) => {
  try {
    const { fileName, content } = req.body;
    
    if (!fileName || !content) {
      return res.status(400).json({
        success: false,
        error: '请提供文件名 (fileName) 和内容 (content)'
      });
    }
    
    console.log(`🏷️ [结构化标注] 请求：${fileName}`);
    
    // 执行结构化标注
    const annotations = pdfAnnotator.annotateDocument(fileName, content);
    
    console.log(`✅ [结构化标注] 完成 - ${annotations.stats.totalAnnotations} 个标注`);
    
    res.json({
      success: true,
      annotations
    });
  } catch (error) {
    console.error('❌ [结构化标注] 失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/annotate/batch
 * 批量标注多个文档
 */
router.post('/annotate/batch', (req, res) => {
  try {
    const { documents } = req.body;
    
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供文档数组 (documents)'
      });
    }
    
    console.log(`📚 [批量标注] 请求处理 ${documents.length} 个文档`);
    
    // 执行批量标注
    const result = pdfAnnotator.batchAnnotate(documents);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('❌ [批量标注] 失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/:docId/annotations
 * 获取指定文档的结构化标注
 */
router.get('/documents/:docId/annotations', (req, res) => {
  try {
    const { docId } = req.params;
    
    // 从数据库获取文档信息
    const metadata = chunkDB.getMetadata(docId);
    
    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: `未找到文档：${docId}`
      });
    }
    
    // 如果已有标注，直接返回
    if (metadata.annotations) {
      return res.json({
        success: true,
        docId,
        annotations: metadata.annotations
      });
    }
    
    // 否则实时生成标注
    const chunks = chunkDB.getChunksByDoc(docId);
    const fullContent = chunks.map(c => c.content).join('\n');
    
    const annotations = pdfAnnotator.annotateDocument(metadata.fileName || docId, fullContent);
    
    res.json({
      success: true,
      docId,
      annotations,
      note: '标注为实时生成，建议保存到数据库'
    });
  } catch (error) {
    console.error('❌ [获取文档标注] 失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/search/filtered
 * 按维度筛选搜索（使用结构化标注）
 */
router.post('/search/filtered', async (req, res) => {
  try {
    const { query, filters = {}, topK = 10 } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: '请提供查询文本 (query)'
      });
    }
    
    console.log(`🔍 [筛选搜索] 查询："${query}"`);
    console.log(`🎛️ [筛选搜索] 过滤器：`, JSON.stringify(filters));
    
    // 获取所有分块
    let allChunks = chunkDB.getAllChunks();
    
    // 应用结构化标注过滤器
    if (filters.year || filters.docType || filters.caseNumber || filters.legalProvision) {
      allChunks = allChunks.filter(chunk => {
        const meta = chunk.metadata || {};
        const annotations = meta.annotations || {};
        
        // 年份过滤
        if (filters.year && annotations.year !== parseInt(filters.year)) {
          return false;
        }
        
        // 文档类型过滤
        if (filters.docType && annotations.docType !== filters.docType) {
          return false;
        }
        
        // 案件编号过滤
        if (filters.caseNumber && annotations.caseNumber !== filters.caseNumber) {
          return false;
        }
        
        // 法条编号过滤
        if (filters.legalProvision) {
          const provisions = annotations.legalProvisions || [];
          if (!provisions.some(p => p.includes(filters.legalProvision.toLowerCase()))) {
            return false;
          }
        }
        
        return true;
      });
    }
    
    console.log(`📚 [筛选搜索] 候选分块数：${allChunks.length}`);
    
    if (allChunks.length === 0) {
      return res.json({
        success: true,
        query,
        filters,
        results: [],
        totalResults: 0,
        message: '没有符合筛选条件的文档'
      });
    }
    
    // 执行向量搜索
    const startTime = Date.now();
    const results = await vectorSearcher.search(query, allChunks, topK);
    const searchTime = Date.now() - startTime;
    
    console.log(`✅ [筛选搜索] 完成，耗时 ${searchTime}ms，找到 ${results.length} 个结果`);
    
    res.json({
      success: true,
      query,
      filters,
      totalResults: results.length,
      searchTimeMs: searchTime,
      results: results.map(r => ({
        chunkId: r.chunk.chunkId,
        docId: r.chunk.docId,
        content: r.chunk.content.substring(0, 200) + '...',
        category: r.chunk.category,
        weight: r.chunk.weight,
        similarity: r.similarity,
        annotations: r.chunk.metadata?.annotations || null
      }))
    });
  } catch (error) {
    console.error('❌ [筛选搜索] 失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
