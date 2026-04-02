# ClawText PDF 检索系统 - 快速开始指南

## 🚀 5 分钟快速上手

### 步骤 1: 启动服务器

```bash
cd backend
node server.js
```

你会看到：
```
🤖 AI 处理器已初始化，使用模型：qwen
🚀 ClawText PDF Upload Server 正在运行
📡 地址：http://localhost:3000
```

### 步骤 2: 测试基础功能

**测试 API 连接：**
```bash
curl http://localhost:3000/api/hello
```

**上传 PDF 文件：**
```bash
curl -X POST http://localhost:3000/api/upload-pdf \
  -F "file=@your-document.pdf" \
  -F "category=SFAT"
```

**查询文档：**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "List all documents", "category": "SFAT"}'
```

### 步骤 3: 体验 AI 功能

**方法 1: 使用查询参数**
```bash
curl -X POST "http://localhost:3000/api/chat?ai=true" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the SFC disciplinary powers under section 194?",
    "category": "SFAT"
  }'
```

**方法 2: 使用关键词**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "[ai] Analyze section 194 requirements",
    "category": "SFAT"
  }'
```

### 步骤 4: 测试 AI 功能

```bash
# 测试 API 连接
node test-api-connection.js

# 测试完整 AI 功能
node test-qwen.js
```

## 📡 常用查询示例

### 普通查询（无需 AI）
```bash
# 列表查询
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Identify all SFAT rulings in 2021"}'

# 文档查找
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me SFAT 2021-5 Determination"}'
```

### AI 增强查询
```bash
# 法律分析
curl -X POST "http://localhost:3000/api/chat?ai=true" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Analyze the legal requirements for section 194",
    "category": "SFAT"
  }'

# 文档摘要
curl -X POST "http://localhost:3000/api/chat?ai=true" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Summarize SFAT 2021-5 Determination",
    "category": "SFAT"
  }'

# 查询理解
curl -X POST "http://localhost:3000/api/chat?ai=true" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the difference between section 193 and 194?",
    "category": "SFC"
  }'
```

## 🎯 查询类型说明

| 查询类型 | 示例 | 是否需要 AI |
|---------|------|-----------|
| 列表查询 | "List all 2021 documents" | ❌ |
| 文档查找 | "Show SFAT 2021-5" | ❌ |
| 法律分析 | "Analyze section 194" | ✅ |
| 文档摘要 | "Summarize this document" | ✅ |
| 概念对比 | "Difference between 193 and 194" | ✅ |
| 案例研究 | "Court reasoning in SFAT 2021-5" | ✅ |

## ⚙️ 配置说明

### API 密钥（已配置）
`backend/.env` 文件中已配置千问 API 密钥：
```bash
DASHSCOPE_API_KEY=sk-0eda770ec42f4bbe9af2152d12a503aa
```

### 切换 AI 模型
编辑 `backend/ai-integration.js`：
```javascript
const AI_CONFIG = {
  // ...
  defaultModel: 'qwen'  // 改为 'deepseek', 'openai', 'claude'
};
```

## 🛠️ 故障排查

### 服务器无法启动
```bash
# 检查端口是否被占用
netstat -ano | findstr :3000

# 修改端口
# 编辑 server.js，更改 PORT = 3000 为其他端口
```

### AI 调用失败
```bash
# 测试 API 连接
node test-api-connection.js

# 检查网络连接
ping dashscope.aliyuncs.com
```

### PDF 上传失败
```bash
# 检查文件路径
# 确保 PDF 文件存在且未损坏
# 查看服务器日志中的详细错误
```

## 📚 更多文档

- **[README.md](./README.md)** - 完整项目文档
- **[AI 集成说明.md](./AI 集成说明.md)** - AI 功能详细说明
- **[DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md)** - 开发日志

## 💡 提示

1. **首次使用**: 先上传一些 PDF 文件到系统中
2. **测试 AI**: 使用 `test-api-connection.js` 验证 API 连接
3. **查询优化**: 使用具体的法律术语获得更好的结果
4. **AI 成本**: AI 查询会产生 API 调用费用，合理使用

## 🎉 开始使用

现在你已经准备好了！启动服务器，开始体验智能法律文档检索吧！

```bash
cd backend
node server.js
```

访问 http://localhost:3000 开始使用！

---

*需要帮助？查看 [README.md](./README.md) 或 [AI 集成说明.md](./AI 集成说明.md)*