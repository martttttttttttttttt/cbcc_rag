# ClawText PDF 检索系统 - AI 大模型集成说明

## 📋 概述

ClawText PDF 检索系统现已集成 AI 大模型功能，显著提升了系统的智能对话和内容理解能力。系统默认使用**阿里云千问模型（Qwen-max）**，同时支持多种 AI 模型。

## ✨ 核心功能

### 1. 智能查询理解
- 自动分析用户查询的真实意图
- 识别涉及的法律领域和概念
- 发现查询中的歧义并提供澄清建议
- 提供查询重写建议以优化搜索结果

### 2. AI 增强回答生成
- 基于搜索结果生成专业、准确的法律回答
- 自动引用相关文档和具体内容
- 保持专业、客观的法律语气
- 在信息不足时明确说明

### 3. 文档智能摘要
- 自动生成法律文档的结构化摘要
- 提取核心主题、法律问题、关键条款
- 总结最终决定和对相关方的影响

### 4. 深度法律分析
- 分析复杂法律问题的背景和重要性
- 提供相关法律原则和先例
- 分析不同立场的论证
- 提供解决方案和建议

## 🔧 技术架构

### AI 模型支持
系统支持多种 AI 模型，通过配置文件轻松切换：

| 模型 | 提供商 | 配置项 | 状态 |
|------|--------|--------|------|
| **Qwen-max** | 阿里云 DashScope | `DASHSCOPE_API_KEY` | ✅ 默认 |
| DeepSeek-chat | DeepSeek | `DEEPSEEK_API_KEY` | ⚪ 可选 |
| GPT-4-turbo | OpenAI | `OPENAI_API_KEY` | ⚪ 可选 |
| Claude-3-opus | Anthropic | `CLAUDE_API_KEY` | ⚪ 可选 |
| Llama2 | Ollama (本地) | 无需密钥 | ⚪ 可选 |

### 模块化设计
```
backend/
├── ai-integration.js          # AI 集成核心模块
├── server.js                  # 主服务器（已集成 AI 处理器）
├── .env                       # API 密钥配置
├── test-qwen.js              # AI 功能测试脚本
└── test-api-connection.js    # API 连接测试脚本
```

## 🚀 使用方法

### 1. 配置 API 密钥

编辑 `backend/.env` 文件：

```bash
# 千问模型 (已配置)
DASHSCOPE_API_KEY=sk-0eda770ec42f4bbe9af2152d12a503aa

# 其他模型（可选）
DEEPSEEK_API_KEY=your_deepseek_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here
```

### 2. 启动服务器

```bash
cd backend
node server.js
```

服务器启动后会显示：
```
🤖 AI 处理器已初始化，使用模型：qwen
```

### 3. 使用 AI 增强查询

#### 方法 A: 通过查询参数
```
POST http://localhost:3000/api/chat?ai=true
Content-Type: application/json

{
  "message": "What are the SFC disciplinary powers under section 194?",
  "category": "SFAT"
}
```

#### 方法 B: 通过关键词
在查询中包含 `[ai]` 或 `ai 分析` 关键词：
```json
{
  "message": "[ai] Analyze the legal requirements for section 194",
  "category": "SFAT"
}
```

### 4. API 响应格式

AI 增强的查询会返回额外的字段：

```json
{
  "success": true,
  "answer": "AI 生成的专业回答...",
  "sources": [
    {
      "fileName": "SFAT 2021-5 Determination (f).pdf",
      "score": 10.5,
      "year": 2021
    }
  ],
  "totalMatches": 2,
  "aiEnhanced": true,
  "queryAnalysis": {
    "originalQuery": "What are the SFC disciplinary powers...",
    "intent": "查询 SFC 在 section 194 下的纪律处分权力",
    "legalAreas": ["证券法", "纪律处分", "监管权力"],
    "documentTypes": ["SFAT 裁决", "SFC 决定"],
    "ambiguities": [],
    "suggestedRewrites": []
  },
  "debug": {
    "queryType": "legal_document",
    "searchResultsCount": 2,
    "aiModel": "qwen"
  }
}
```

## 🧪 测试

### 运行 API 连接测试
```bash
cd backend
node test-api-connection.js
```

### 运行完整 AI 功能测试
```bash
node test-qwen.js
```

## 🔄 错误处理

系统具有完善的错误处理机制：

1. **AI 服务不可用时**：自动回退到普通处理模式
2. **API 密钥未配置**：使用普通处理模式并记录警告
3. **超时或网络错误**：重试机制 + 回退到普通处理
4. **响应解析失败**：返回原始搜索结果

## 💡 最佳实践

### 何时使用 AI 增强

✅ **适合使用 AI 的场景：**
- 复杂的法律分析问题
- 需要综合多个文档的回答
- 需要专业法律语言的回答
- 查询意图不明确需要澄清

❌ **不需要 AI 的场景：**
- 简单的列表查询（如"List 2021 documents"）
- 特定文档的精确查找
- 已预定义的查询类型（如 SFAT interlocutory applications）

### 性能优化建议

1. **智能缓存**：对常见查询缓存 AI 回答
2. **批量处理**：批量处理多个相关查询
3. **结果过滤**：只将高相关性的搜索结果发送给 AI
4. **Token 控制**：根据查询复杂度动态调整 max_tokens

## 📊 成本估算

使用千问模型（qwen-max）的近似成本：

| 操作 | 输入 Token | 输出 Token | 近似成本（USD） |
|------|-----------|-----------|----------------|
| 查询理解 | ~100 | ~200 | $0.003 |
| 回答生成 | ~500 | ~800 | $0.012 |
| 文档摘要 | ~1000 | ~400 | $0.016 |
| 法律分析 | ~1500 | ~1200 | $0.036 |

*注：基于阿里云 DashScope 定价（2026 年）*

## 🔐 安全注意事项

1. **API 密钥保护**：
   - 不要将 `.env` 文件提交到版本控制
   - 使用环境变量管理密钥
   - 定期轮换 API 密钥

2. **数据隐私**：
   - 仅发送必要的文档片段给 AI
   - 避免发送完整的敏感文档
   - 遵守数据保护法规

3. **访问控制**：
   - 在生产环境中限制 AI 功能的使用
   - 实现用户级别的配额管理
   - 监控异常使用模式

## 🛠️ 故障排查

### 问题：AI 调用失败

**检查清单：**
1. ✅ API 密钥是否正确配置
2. ✅ 网络连接是否正常
3. ✅ API 服务是否可用
4. ✅ Token 配额是否充足

**解决方案：**
```bash
# 1. 检查 API 连接
node test-api-connection.js

# 2. 检查环境变量
echo $DASHSCOPE_API_KEY

# 3. 查看服务器日志
# 服务器会显示详细的错误信息
```

### 问题：回答质量不佳

**可能原因：**
- 搜索结果相关性低
- 查询表述不清晰
- AI 模型理解偏差

**优化建议：**
1. 改进查询表述，使用更具体的法律术语
2. 调整搜索参数，提高结果相关性
3. 在查询中提供更多上下文信息

## 📈 未来扩展

### 计划功能
- [ ] 多轮对话支持
- [ ] 文档对比分析
- [ ] 法律条款解释
- [ ] 案例相似性分析
- [ ] 多语言支持
- [ ] 语音输入/输出

### 模型扩展
- [ ] 支持更多国内 AI 模型（文心一言、通义千问等）
- [ ] 本地模型部署（提高隐私性）
- [ ] 模型自动选择（根据查询类型）

## 📚 相关文档

- [ClawText 系统架构](./README.md)
- [API 接口文档](./API.md)
- [智能查询分类器](./QUERY_CLASSIFIER.md)

## 🤝 技术支持

如有问题或建议，请联系开发团队。

---

*最后更新：2026-03-04*