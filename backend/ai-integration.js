// AI 大模型集成模块
// 用于增强 ClawText PDF 检索系统的智能对话和内容理解能力

const axios = require('axios');

// AI 模型配置
const AI_CONFIG = {
  // 支持多种 AI 模型 API
  models: {
    // 千问模型 (Qwen) - 阿里云 DashScope (OpenClaw 同款配置)
    qwen: {
      baseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
      apiKey: process.env.DASHSCOPE_API_KEY,
      model: 'qwen3.5-plus',
      maxTokens: 4096
    },
    // DeepSeek API
    deepseek: {
      baseUrl: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: 'deepseek-chat',
      maxTokens: 4096
    },
    // OpenAI API
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4-turbo-preview',
      maxTokens: 4096
    },
    // Claude API
    claude: {
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: process.env.CLAUDE_API_KEY,
      model: 'claude-3-opus-20240229',
      maxTokens: 4096
    },
    // 本地模型 (Ollama)
    local: {
      baseUrl: 'http://localhost:11434/api',
      model: 'llama2',
      maxTokens: 2048
    }
  },
  
  // 默认使用千问模型
  defaultModel: 'qwen'
};

// AI 查询处理器类
class AIQueryProcessor {
  constructor() {
    this.model = AI_CONFIG.defaultModel;
    this.config = AI_CONFIG.models[this.model];
  }
  
  // 设置 AI 模型
  setModel(modelName) {
    if (AI_CONFIG.models[modelName]) {
      this.model = modelName;
      this.config = AI_CONFIG.models[modelName];
      return true;
    }
    return false;
  }
  
  // 调用 AI 模型
  async callAI(prompt, context = '', options = {}) {
    try {
      const modelConfig = this.config;
      
      // 构建完整的提示词
      const fullPrompt = this.buildPrompt(prompt, context, options);
      
      // 根据不同的模型调用不同的 API
      switch (this.model) {
        case 'qwen':
          return await this.callQwen(fullPrompt, options);
        case 'deepseek':
          return await this.callDeepSeek(fullPrompt, options);
        case 'openai':
          return await this.callOpenAI(fullPrompt, options);
        case 'claude':
          return await this.callClaude(fullPrompt, options);
        case 'local':
          return await this.callLocalModel(fullPrompt, options);
        default:
          throw new Error(`Unsupported model: ${this.model}`);
      }
    } catch (error) {
      console.error('AI 调用失败:', error.message);
      throw error;
    }
  }
  
  // 构建提示词
  buildPrompt(prompt, context, options) {
    const { queryType = 'general', documentContext = [] } = options;
    
    let systemPrompt = '';
    
    // 根据查询类型构建不同的系统提示词
    switch (queryType) {
      case 'legal_analysis':
        systemPrompt = `你是一个专业的法律 AI 助手，专门分析香港证券及期货事务监察委员会 (SFC) 和证券及期货上诉审裁处 (SFAT) 的法律文件。请基于提供的法律文档内容，提供专业的法律分析。`;
        break;
      case 'document_summary':
        systemPrompt = `你是一个专业的文档摘要 AI 助手，专门总结法律文档的关键内容。请基于提供的文档内容，提供清晰、准确、结构化的摘要。`;
        break;
      case 'query_understanding':
        systemPrompt = `你是一个智能查询理解 AI 助手，专门分析用户的法律查询意图。请分析用户的查询，理解其真实意图，并提供查询重写建议。`;
        break;
      case 'answer_generation':
        systemPrompt = `你是一个专业的法律问答 AI 助手，专门回答基于法律文档的问题。请基于提供的文档内容，提供准确、详细、有引用的回答。`;
        break;
      default:
        systemPrompt = `你是一个专业的 AI 助手，专门处理法律文档相关的查询。请基于提供的上下文信息，提供准确、有用的回答。`;
    }
    
    // 添加文档上下文
    if (documentContext.length > 0) {
      systemPrompt += `\n\n以下是相关的文档内容（来自 PDF 文件）：\n\n`;
      documentContext.forEach((doc, index) => {
        systemPrompt += `文档 ${index + 1}: ${doc.fileName}\n`;
        if (doc.snippet) {
          systemPrompt += `相关内容：${doc.snippet.substring(0, 500)}...\n\n`;
        }
      });
    }
    
    // 添加额外的上下文
    if (context) {
      systemPrompt += `\n额外的上下文信息：${context}\n\n`;
    }
    
    // 构建最终提示词
    const finalPrompt = {
      system: systemPrompt,
      user: prompt
    };
    
    return finalPrompt;
  }
  
  // 调用千问 API (DashScope 兼容 OpenAI 格式)
  async callQwen(prompt, options) {
    if (!this.config.apiKey) {
      throw new Error('千问 API 密钥未设置 (DASHSCOPE_API_KEY)');
    }
    
    const response = await axios.post(
      `${this.config.baseUrl}/chat/completions`,
      {
        model: this.config.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || 0.7,
        stream: options.stream || false
      },
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.choices[0].message.content;
  }
  
  // 调用 DeepSeek API
  async callDeepSeek(prompt, options) {
    if (!this.config.apiKey) {
      throw new Error('DeepSeek API 密钥未设置');
    }
    
    const response = await axios.post(
      `${this.config.baseUrl}/chat/completions`,
      {
        model: this.config.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || 0.7,
        stream: options.stream || false
      },
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.choices[0].message.content;
  }
  
  // 调用 OpenAI API
  async callOpenAI(prompt, options) {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API 密钥未设置');
    }
    
    const response = await axios.post(
      `${this.config.baseUrl}/chat/completions`,
      {
        model: this.config.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || 0.7,
        stream: options.stream || false
      },
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.choices[0].message.content;
  }
  
  // 调用 Claude API
  async callClaude(prompt, options) {
    if (!this.config.apiKey) {
      throw new Error('Claude API 密钥未设置');
    }
    
    const response = await axios.post(
      `${this.config.baseUrl}/messages`,
      {
        model: this.config.model,
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || 0.7,
        system: prompt.system,
        messages: [
          { role: 'user', content: prompt.user }
        ]
      },
      {
        headers: {
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.content[0].text;
  }
  
  // 调用本地模型 (Ollama)
  async callLocalModel(prompt, options) {
    const response = await axios.post(
      `${this.config.baseUrl}/generate`,
      {
        model: this.config.model,
        prompt: `${prompt.system}\n\n用户：${prompt.user}\n\n助手:`,
        stream: options.stream || false,
        options: {
          num_predict: options.maxTokens || this.config.maxTokens,
          temperature: options.temperature || 0.7
        }
      }
    );
    
    return response.data.response;
  }
  
  // 智能查询理解
  async understandQuery(query, context = '') {
    const prompt = `分析以下法律查询的意图：
    
查询："${query}"
${context ? `上下文：${context}` : ''}

请分析：
1. 查询的主要意图是什么？
2. 查询涉及哪些法律领域或概念？
3. 查询需要哪些类型的文档或信息？
4. 查询是否有歧义或需要澄清的地方？
5. 建议的查询重写（如果需要）`;

    const analysis = await this.callAI(prompt, '', { queryType: 'query_understanding' });
    
    // 解析分析结果
    const lines = analysis.split('\n');
    const result = {
      originalQuery: query,
      intent: '',
      legalAreas: [],
      documentTypes: [],
      ambiguities: [],
      suggestedRewrites: []
    };
    
    let currentSection = '';
    for (const line of lines) {
      if (line.includes('1. 查询的主要意图')) {
        currentSection = 'intent';
      } else if (line.includes('2. 查询涉及哪些法律领域')) {
        currentSection = 'legalAreas';
      } else if (line.includes('3. 查询需要哪些类型的文档')) {
        currentSection = 'documentTypes';
      } else if (line.includes('4. 查询是否有歧义')) {
        currentSection = 'ambiguities';
      } else if (line.includes('5. 建议的查询重写')) {
        currentSection = 'suggestedRewrites';
      } else if (line.trim() && !line.match(/^\d+\./)) {
        const content = line.replace(/^[-•*]\s*/, '').trim();
        if (content) {
          switch (currentSection) {
            case 'intent':
              result.intent = content;
              break;
            case 'legalAreas':
              result.legalAreas.push(content);
              break;
            case 'documentTypes':
              result.documentTypes.push(content);
              break;
            case 'ambiguities':
              result.ambiguities.push(content);
              break;
            case 'suggestedRewrites':
              result.suggestedRewrites.push(content);
              break;
          }
        }
      }
    }
    
    return result;
  }
  
  // 生成智能回答
  async generateAnswer(query, searchResults, context = '', options = {}) {
    const { analyzeAllDocs = false, allDocuments = [] } = options;
    
    console.log(`🔍 generateAnswer 收到 ${searchResults.length} 个搜索结果`);
    if (searchResults.length > 0) {
      console.log(`   第一个结果：fileName=${searchResults[0].fileName}, snippet 长度=${searchResults[0].snippet?.length || 0}, fullContent 长度=${searchResults[0].fullContent?.length || 0}`);
    }
    
    // 提取搜索结果中的关键信息
    const documentContext = searchResults.map(result => ({
      fileName: result.fileName,
      snippet: result.snippet || result.fullContent || '',
      fullContent: result.fullContent || result.snippet || '',
      score: result.score,
      year: result.year,
      chunkCount: result.chunkCount || 1
    }));
    
    // 极度降低过滤阈值 - 只要有内容就包含进来（让 AI 来判断相关性）
    let relevantDocs = documentContext.filter(doc => doc.snippet && doc.snippet.length > 0);
    console.log(`🔍 过滤后相关文档：${relevantDocs.length} 个`);
    
    // 如果启用"分析所有文档"模式，且没有匹配文档，则使用所有文档
    if (analyzeAllDocs && relevantDocs.length === 0 && allDocuments.length > 0) {
      console.log(`📚 分析所有文档模式：共 ${allDocuments.length} 个文档`);
      // 增加每个文档的内容长度限制（避免 prompt 过长导致 API 错误）
      const maxContentPerDoc = 2000; // 从 800 增加到 2000
      const maxDocs = Math.min(allDocuments.length, 35); // 从 20 增加到 35，支持所有文档
      relevantDocs = allDocuments.slice(0, maxDocs).map(doc => ({
        fileName: doc.originalName || doc.fileName,
        snippet: doc.content ? doc.content.substring(0, maxContentPerDoc) : '',
        fullContent: doc.content ? doc.content.substring(0, maxContentPerDoc) : '',
        score: 0,
        year: doc.year || '未知',
        chunkCount: 1
      })).filter(doc => doc.fullContent && doc.fullContent.length > 0);
      console.log(`📚 过滤后有效文档：${relevantDocs.length} 个，每个文档限制 ${maxContentPerDoc} 字符`);
    }
    
    // 如果仍然没有文档，返回提示
    if (relevantDocs.length === 0) {
      return {
        answer: `⚠️ **当前没有可分析的 PDF 文档**\n\n请先上传 PDF 文件，然后我可以帮你分析文档内容。\n\n上传方法：\n1. 在前端点击"📎 选择 PDF"\n2. 选择文件后点击"🚀 上传到服务器"\n3. 然后输入你的问题`,
        sources: [],
        totalMatches: 0
      };
    }
    
    const prompt = `你是一个专业的法律文档分析 AI 助手。你的任务是**深入分析提供的 PDF 文档完整内容**，找出与用户问题相关的所有信息。

**重要指示**：
1. **必须严格基于提供的 PDF 文档内容** - 不要编造任何信息
2. **深入阅读和分析** - 仔细阅读每个文档的完整内容，找出所有相关信息
3. **具体引用** - 回答时必须引用具体的文档名称、段落或条款
4. **结构化回答** - 使用清晰的格式（列表、标题等）组织答案
5. **如果文档中没有相关信息**，明确说明"在提供的 PDF 文档中未找到相关内容"
6. **不要提及"片段"或"不完整"** - 你收到的是完整的文档内容

---

**用户问题**: "${query}"

---

**相关 PDF 文档完整内容**（共${relevantDocs.length}个文档）：

${relevantDocs.map((doc, index) => 
  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 **文档 ${index + 1}**: ${doc.fileName}
   相关性评分：${doc.score.toFixed(2)} | 匹配分块数：${doc.chunkCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${doc.fullContent || doc.snippet}

`
).join('\n')}

---

**请基于以上 PDF 文档内容，完成以下任务**：

1. **直接回答**用户的问题
2. **列出所有相关的具体信息**（如案例名称、日期、条款号、决定内容等）
3. **引用具体来源** - 说明每个信息来自哪个文档
4. **如果信息不完整**，说明还需要哪些额外信息

请开始分析并回答：`;

    const answer = await this.callAI(prompt, '', { 
      queryType: 'answer_generation',
      documentContext: relevantDocs
    });
    
    return {
      answer: answer,
      sources: relevantDocs.map(doc => ({
        fileName: doc.fileName,
        score: doc.score,
        year: doc.year,
        chunkCount: doc.chunkCount
      })),
      totalMatches: relevantDocs.length
    };
  }
  
  // 文档摘要
  async summarizeDocument(documentContent, fileName = '', options = {}) {
    const prompt = `请总结以下法律文档的关键内容：
    
文档名称：${fileName}
文档内容（前 2000 字符）: ${documentContent.substring(0, 2000)}...

请提供：
1. 文档的核心主题和目的
2. 主要法律问题和争议点
3. 关键的法律条款和引用
4. 最终的决定或结论
5. 对相关方的影响`;

    const summary = await this.callAI(prompt, '', { 
      queryType: 'document_summary',
      maxTokens: options.maxTokens || 1024
    });
    
    return summary;
  }
  
  // 法律分析
  async analyzeLegalIssue(issue, documentContext = [], options = {}) {
    const prompt = `请分析以下法律问题：
    
法律问题：${issue}

相关文档:
${documentContext.map((doc, index) => 
  `文档 ${index + 1}: ${doc.fileName}
  相关内容：${doc.content.substring(0, 500)}...`
).join('\n\n')}

请提供：
1. 问题的法律背景和重要性
2. 相关的法律原则和先例
3. 不同立场的分析和论证
4. 可能的解决方案或建议
5. 对未来类似案件的启示`;

    const analysis = await this.callAI(prompt, '', { 
      queryType: 'legal_analysis',
      maxTokens: options.maxTokens || 2048
    });
    
    return analysis;
  }
  
  // 查询建议
  async suggestQueries(originalQuery, searchResults) {
    const prompt = `基于用户的原始查询和搜索结果，提供改进的查询建议：
    
原始查询："${originalQuery}"

搜索结果统计:
- 总匹配数：${searchResults.totalMatches}
- 平均相关性分数：${searchResults.averageScore ? searchResults.averageScore.toFixed(2) : 'N/A'}
- 文档年份范围：${searchResults.yearRange ? searchResults.yearRange : 'N/A'}

请提供：
1. 3 个更精确的查询建议
2. 每个建议的预期结果
3. 如何优化查询以获得更好结果的建议`;

    const suggestions = await this.callAI(prompt, '', { 
      queryType: 'query_understanding',
      maxTokens: 512
    });
    
    return suggestions;
  }
}

// 导出 AI 处理器
module.exports = {
  AIQueryProcessor,
  AI_CONFIG
};