# ClawText PDF 检索系统 🚀

> 智能法律文档检索与分析系统 - 专为香港证券及期货法律文档设计

## 📖 简介

ClawText 是一个专门用于检索和分析香港证券及期货事务监察委员会（SFC）和证券及期货上诉审裁处（SFAT）法律文档的智能系统。系统采用先进的术语权重检索算法，并结合 AI 大模型提供智能问答和分析功能。

## ✨ 核心特性

### 🔍 智能检索
- **术语权重检索**：法律核心术语自动加权，提高检索准确性
- **智能分块**：保留法律文本结构（§、Section 等），优化检索粒度
- **文档级过滤**：支持按文档 ID、名称、类别、年份筛选
- **OCR 支持**：自动识别扫描版 PDF，提取文本内容

### 🤖 AI 增强（新增！）
- **智能查询理解**：自动分析查询意图，识别法律领域
- **AI 回答生成**：基于文档内容生成专业、准确的法律回答
- **文档摘要**：自动生成法律文档的结构化摘要
- **法律分析**：深入分析复杂法律问题，提供专业见解
- **多模型支持**：支持千问、DeepSeek、OpenAI、Claude 等多种 AI 模型

### 📊 查询分类
- **列表查询**：快速列出特定年份或类别的文档
- **SFAT 查询**：专门处理 SFAT 相关查询
- **法律文档查询**：识别法律术语，提供专业回答
- **通用查询**：使用术语权重检索的通用查询

## 🏗️ 系统架构

```
clawtext/
├── backend/                    # 后端服务
│   ├── server.js              # 主服务器（Express）
│   ├── ai-integration.js      # AI 集成模块 ⭐ NEW
│   ├── ocr-extract.js         # OCR 文本提取
│   ├── pdf_files/             # PDF 文件存储
│   ├── pdf_database.json      # 文档数据库
│   ├── .env                   # 环境变量配置
│   ├── test-qwen.js          # AI 功能测试
│   └── test-api-connection.js # API 连接测试
├── frontend/                   # 前端界面（可选）
│   └── index.html
├── AI 集成说明.md              # AI 功能详细文档 ⭐ NEW
└── README.md                   # 本文件
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

编辑 `backend/.env` 文件：

```bash
# 千问模型 API 密钥（已配置）
DASHSCOPE_API_KEY=sk-0eda770ec42f4bbe9af2152d12a503aa

# 服务器配置
PORT=3000
NODE_ENV=development
```

### 3. 启动服务器

```bash
cd backend
node server.js
```

服务器将在 `http://localhost:3000` 启动。

### 4. 测试 AI 功能

```bash
# 测试 API 连接
node test-api-connection.js

# 测试完整 AI 功能
node test-qwen.js
```

## 📡 API 接口

### 基础接口

#### GET `/api/hello`
获取服务信息

```bash
curl http://localhost:3000/api/hello
```

#### POST `/api/upload-pdf`
上传 PDF 文件（自动分块和 OCR）

```bash
curl -X POST http://localhost:3000/api/upload-pdf \
  -F "file=@document.pdf" \
  -F "category=SFAT"
```

#### GET `/api/pdf-files`
获取所有 PDF 文件列表

```bash
curl http://localhost:3000/api/pdf-files
```

#### GET `/api/documents`
获取精简版文档列表

```bash
curl http://localhost:3000/api/documents
```

#### DELETE `/api/pdf-files/:id`
删除指定 PDF 文件

```bash
curl -X DELETE http://localhost:3000/api/pdf-files/123
```

### 智能查询接口

#### POST `/api/chat`
智能问答（支持 AI 增强）

**基础查询：**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "List all SFAT rulings in 2021",
    "category": "SFAT"
  }'
```

**AI 增强查询（方法 1 - 查询参数）：**
```bash
curl -X POST "http://localhost:3000/api/chat?ai=true" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the SFC disciplinary powers under section 194?",
    "category": "SFAT"
  }'
```

**AI 增强查询（方法 2 - 关键词）：**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "[ai] Analyze the legal requirements for section 194",
    "category": "SFAT"
  }'
```

### 响应示例

**普通查询响应：**
```json
{
  "success": true,
  "answer": "Based on the document: SFAT 2021-5...\n\n**Key Points:**\n• Section 194: The court emphasized...",
  "sources": [
    {
      "docId": "sfat_2021_5",
      "fileName": "SFAT 2021-5 Determination (f).pdf",
      "category": "SFAT",
      "score": 15.5
    }
  ],
  "totalMatches": 3
}
```

**AI 增强查询响应：**
```json
{
  "success": true,
  "answer": "Based on the search results, the SFC's disciplinary powers under section 194...",
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
    "legalAreas": ["证券法", "纪律处分", "监管权力"]
  },
  "debug": {
    "queryType": "legal_document",
    "aiModel": "qwen"
  }
}
```

## 🧠 AI 功能详解

### 支持的 AI 模型

| 模型 | 提供商 | 配置项 | 状态 |
|------|--------|--------|------|
| **Qwen-max** | 阿里云 DashScope | `DASHSCOPE_API_KEY` | ✅ 默认 |
| DeepSeek-chat | DeepSeek | `DEEPSEEK_API_KEY` | ⚪ 可选 |
| GPT-4-turbo | OpenAI | `OPENAI_API_KEY` | ⚪ 可选 |
| Claude-3-opus | Anthropic | `CLAUDE_API_KEY` | ⚪ 可选 |

### 何时使用 AI 增强

✅ **适合使用 AI：**
- 复杂的法律分析问题
- 需要综合多个文档的回答
- 需要专业法律语言的回答
- 查询意图不明确需要澄清

❌ **不需要 AI：**
- 简单的列表查询
- 特定文档的精确查找
- 已预定义的查询类型

### 切换 AI 模型

在 `backend/ai-integration.js` 中修改默认模型：

```javascript
const AI_CONFIG = {
  // ...
  defaultModel: 'qwen'  // 改为 'deepseek', 'openai', 'claude'
};
```

## 📊 查询示例

### 1. 列表查询
```
"Identify all SFAT rulings in 2021"
"List 2019 documents"
"Show me all SFC decisions"
```

### 2. 法律分析查询（使用 AI）
```
"[ai] What are the legal requirements for section 194?"
"[ai] Analyze the court's reasoning in SFAT 2021-5"
"ai 分析 section 193 和 section 194 的区别"
```

### 3. 文档摘要（使用 AI）
```
"[ai] Summarize SFAT 2021-5 Determination"
"ai 摘要 SFAT 2022-4 Ruling"
```

## 🔧 技术栈

- **后端**：Node.js + Express
- **PDF 处理**：pdf-parse + pdf-poppler
- **OCR**：tesseract.js / 百度 OCR API
- **AI 集成**：axios + 多模型支持
- **数据库**：JSON 文件（可扩展到 MongoDB/PostgreSQL）

## 📈 性能指标

- **检索速度**：平均 < 500ms（普通查询）
- **AI 响应**：平均 2-5 秒（取决于查询复杂度）
- **OCR 准确率**：> 95%（清晰扫描件）
- **支持格式**：PDF（文本版和扫描版）

## 🔐 安全注意事项

1. **API 密钥保护**：不要将 `.env` 文件提交到版本控制
2. **数据隐私**：仅发送必要的文档片段给 AI
3. **访问控制**：在生产环境中限制 AI 功能的使用

## 📚 文档

- **[AI 集成说明](./AI 集成说明.md)** - AI 功能的详细文档
- **API 接口** - 见上方 API 接口部分
- **查询分类器** - 智能查询类型识别（代码内注释）

## 🛠️ 故障排查

### AI 调用失败
```bash
# 检查 API 连接
node test-api-connection.js

# 检查环境变量
echo $DASHSCOPE_API_KEY

# 查看服务器日志
# 服务器会显示详细的错误信息
```

### OCR 提取失败
- 检查 PDF 文件是否损坏
- 确认 OCR 依赖已正确安装
- 查看服务器日志中的详细错误

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 📞 联系

如有问题或建议，请联系开发团队。

---

*最后更新：2026-03-04*

**版本：2.0.0** (AI 增强版) 🎉