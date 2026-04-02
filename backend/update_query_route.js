/**
 * 更新 interlocutory-routes.js 的 query 路由，支持搜索所有文档
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'interlocutory-routes.js');
let content = fs.readFileSync(filePath, 'utf8');

// 查找并替换 query 路由的实现
const oldQueryRoute = `/**
 * POST /api/interlocutory/query
 * 自然语言查询 Interlocutory 案例
 */
router.post('/query', async (req, res) => {
  try {
    const { question, context = '' } = req.body;
    
    if (!question) {
      return res.status(400).json({
        success: false,
        error: '请提供问题'
      });
    }
    
    console.log(\`❓ [Interlocutory] Query: "\${question}"\`);
    
    // 1. 搜索相关案例
    const relevantCases = await store.hybridSearch(question, { topK: 5 });
    
    if (relevantCases.length === 0) {
      return res.json({
        success: true,
        answer: '未找到相关的 Interlocutory Application 案例。',
        cases: []
      });
    }
    
    // 2. 构建上下文
    const casesContext = relevantCases.map((c, i) => \`
案例 \${i + 1}: \${c.caseNumber || 'N/A'} (\${c.year || 'N/A'})
类型: \${c.types?.join(', ') || 'N/A'}
申请人: \${c.parties?.applicant || c.applicant || 'N/A'}
摘要: \${c.summary || 'N/A'}
关键议题: \${c.keyIssues?.join('; ') || 'N/A'}
\`).join('\\n---\\n');

    // 3. 调用 AI 生成回答
    const axios = require('axios');
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: \`你是香港证券及期货事务上诉审裁处(SFAT) Interlocutory Applications 的专家。
请基于提供的案例信息，回答用户关于中期申请的问题。
回答应包括：
1. 直接回答用户问题
2. 引用相关案例（注明案号和年份）
3. 解释法律原则或程序要点
4. 如适用，说明不同案例之间的异同\`
          },
          {
            role: 'user',
            content: \`\${context ? '背景信息：\\n' + context + '\\n\\n' : ''}问题：\${question}

相关案例信息：
\${casesContext}

请提供详细的分析和回答。\`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': \`Bearer \${process.env.OPENAI_API_KEY}\`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const answer = response.data.choices[0].message.content;
    
    res.json({
      success: true,
      question,
      answer,
      referencedCases: relevantCases.map(c => ({
        caseNumber: c.caseNumber,
        year: c.year,
        applicant: c.parties?.applicant || c.applicant,
        types: c.types,
        relevanceScore: c.similarity || c.finalScore
      }))
    });`;

const newQueryRoute = `/**
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
    
    console.log(\`❓ [Interlocutory] Query: "\${question}"\`);
    console.log(\`   Search mode: \${searchAllDocs ? 'All documents' : 'Interlocutory only'}\`);
    
    let allResults = [];
    
    // 1. 搜索 Interlocutory 专用库
    const interlocutoryCases = await store.hybridSearch(question, { topK: 5 });
    console.log(\`   Found \${interlocutoryCases.length} interlocutory cases\`);
    
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
        console.log(\`   Searching \${allChunks.length} chunks from general database...\`);
        
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
        
        console.log(\`   Found \${scoredChunks.length} relevant chunks from general DB\`);
        
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
        return \`
[来源 \${i + 1}] Interlocutory Case: \${item.caseNumber || 'N/A'} (\${item.year || 'N/A'})
类型: \${item.types?.join(', ') || 'N/A'}
申请人: \${item.parties?.applicant || item.applicant || 'N/A'}
摘要: \${item.summary || 'N/A'}
关键议题: \${item.keyIssues?.join('; ') || 'N/A'}
\`;
      } else {
        return \`
[来源 \${i + 1}] Document: \${item.filename}
类型: \${item.metadata?.tags?.join(', ') || 'General Document'}
内容片段: \${item.text?.slice(0, 300)}...
\`;
      }
    });
    
    const combinedContext = contextParts.join('\\n---\\n');

    // 5. 调用 AI 生成回答
    const axios = require('axios');
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: \`你是香港证券及期货事务上诉审裁处(SFAT) Interlocutory Applications 的法律专家。
请基于提供的文档和案例信息，回答用户关于中期申请的问题。
回答应包括：
1. 直接回答用户问题
2. 引用相关案例或文档（注明来源）
3. 解释法律原则或程序要点
4. 区分正式 Interlocutory 决定和普通文档中的相关内容
5. 如适用，说明不同案例/文档之间的关联\`
          },
          {
            role: 'user',
            content: \`\${context ? '背景信息：\\n' + context + '\\n\\n' : ''}问题：\${question}

检索到的相关文档和案例：
\${combinedContext}

请基于以上信息提供详细的分析和回答。注意区分正式的 Interlocutory Application 决定和普通参考文档。\`
          }
        ],
        temperature: 0.3,
        max_tokens: 2500
      },
      {
        headers: {
          'Authorization': \`Bearer \${process.env.OPENAI_API_KEY}\`,
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
    });`;

if (content.includes('自然语言查询 Interlocutory 案例')) {
  content = content.replace(oldQueryRoute, newQueryRoute);
  fs.writeFileSync(filePath, content);
  console.log('✅ Updated query route to search all documents!');
} else {
  console.log('⚠️ Could not find the exact query route pattern. File may have been modified.');
}
