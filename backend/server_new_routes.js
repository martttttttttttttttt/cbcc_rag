// ============================================
// PDF 智能标签标注 API
// ============================================
const { tagPDF, batchTag } = require('./pdf-tagger');
const { EnhancedSearcher } = require('./enhanced-search');

// 创建增强检索器实例
const enhancedSearcher = new EnhancedSearcher();

/**
 * POST /api/tagger/tag
 * 为单个文档生成标签
 */
app.post('/api/tagger/tag', async (req, res) => {
  try {
    const { docId, content, fileName } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: '请提供文档内容 (content)'
      });
    }
    
    console.log(`🏷️ [标签标注] 开始标注文档: ${fileName || docId || 'unknown'}`);
    
    const tags = tagPDF(content, {
      id: docId,
      originalName: fileName
    });
    
    console.log(`✅ [标签标注] 完成`);
    console.log(`   - 案件编号: ${tags.metadata.caseNumber || 'N/A'}`);
    console.log(`   - 年份: ${tags.metadata.year || 'N/A'}`);
    console.log(`   - 文档类型: ${tags.documentType.primary} (${Math.round(tags.documentType.confidence * 100)}%)`);
    console.log(`   - 法条引用: ${Object.values(tags.legalReferences).flat().length} 个`);
    console.log(`   - 当事人: ${tags.parties.persons.length + tags.parties.organizations.length} 个`);
    
    res.json({
      success: true,
      docId,
      fileName,
      tags
    });
  } catch (error) {
    console.error('❌ [标签标注] 失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/tagger/batch-tag
 * 批量为所有文档生成标签
 */
app.post('/api/tagger/batch-tag', async (req, res) => {
  try {
    const db = readDB();
    
    if (!db.files || db.files.length === 0) {
      return res.json({
        success: true,
        message: '没有可标注的文档',
        tagged: 0
      });
    }
    
    console.log(`🚀 [批量标注] 开始标注 ${db.files.length} 个文档...`);
    
    let taggedCount = 0;
    let failedCount = 0;
    
    for (const file of db.files) {
      if (file.status === 'deleted' || !file.content) continue;
      
      try {
        // 生成标签
        const tags = tagPDF(file.content, {
          id: file.id,
          originalName: file.originalName
        });
        
        // 保存到数据库
        file.tags = tags;
        taggedCount++;
        
        console.log(`  ✅ ${file.originalName}: ${tags.documentType.primary}`);
      } catch (err) {
        console.error(`  ❌ ${file.originalName}: ${err.message}`);
        failedCount++;
      }
    }
    
    writeDB(db);
    
    console.log(`✅ [批量标注] 完成: ${taggedCount} 成功, ${failedCount} 失败`);
    
    res.json({
      success: true,
      message: `批量标注完成`,
      tagged: taggedCount,
      failed: failedCount,
      total: db.files.length
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
 * GET /api/tagger/filters
 * 获取可用的过滤选项（年份、文档类型等）
 */
app.get('/api/tagger/filters', (req, res) => {
  try {
    const db = readDB();
    
    if (!db.files) {
      return res.json({
        success: true,
        filters: {
          years: [],
          docTypes: [],
          caseNumbers: [],
          legalRefs: []
        }
      });
    }
    
    const years = new Set();
    const docTypes = new Set();
    const caseNumbers = new Set();
    const legalRefs = new Set();
    
    db.files.forEach(file => {
      if (file.status === 'deleted') return;
      
      const tags = file.tags;
      if (tags) {
        if (tags.metadata?.year) years.add(tags.metadata.year);
        if (tags.documentType?.primary) docTypes.add(tags.documentType.primary);
        if (tags.metadata?.caseNumber) caseNumbers.add(tags.metadata.caseNumber);
        
        // 收集法条引用
        if (tags.legalReferences) {
          Object.values(tags.legalReferences).flat().forEach(ref => {
            if (ref) legalRefs.add(ref);
          });
        }
      }
    });
    
    res.json({
      success: true,
      filters: {
        years: [...years].sort(),
        docTypes: [...docTypes],
        caseNumbers: [...caseNumbers].sort(),
        legalRefs: [...legalRefs].slice(0, 100) // 限制数量
      }
    });
  } catch (error) {
    console.error('❌ [获取过滤选项] 失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 增强检索 API（标签过滤 + 语义搜索）
// ============================================

/**
 * POST /api/enhanced-search
 * 执行增强检索（支持标签过滤和语义搜索）
 */
app.post('/api/enhanced-search', async (req, res) => {
  try {
    const { query, filters = {}, topK = 10 } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: '请提供查询文本 (query)'
      });
    }
    
    console.log(`🔍 [增强检索] 查询: "${query}"`);
    console.log(`📋 [增强检索] 过滤器:`, filters);
    
    // 初始化检索器
    await enhancedSearcher.initialize();
    
    // 执行搜索
    const result = await enhancedSearcher.search(query, {
      topK,
      filters,
      useHybrid: true,
      includeSnippets: true
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('❌ [增强检索] 失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/enhanced-search/init
 * 初始化增强检索（构建索引）
 */
app.post('/api/enhanced-search/init', async (req, res) => {
  try {
    console.log('🔧 [增强检索] 初始化中...');
    
    await enhancedSearcher.initialize();
    const stats = enhancedSearcher.vectorStore.getStats();
    
    res.json({
      success: true,
      message: '增强检索初始化完成',
      stats
    });
  } catch (error) {
    console.error('❌ [增强检索初始化] 失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/enhanced-search/tag-all
 * 为所有文档块添加标签
 */
app.post('/api/enhanced-search/tag-all', async (req, res) => {
  try {
    console.log('🏷️ [增强检索] 开始为所有文档添加标签...');
    
    await enhancedSearcher.tagAllDocuments();
    
    res.json({
      success: true,
      message: '所有文档已添加标签'
    });
  } catch (error) {
    console.error('❌ [标签添加] 失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
