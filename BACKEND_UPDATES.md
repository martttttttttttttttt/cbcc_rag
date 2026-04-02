# ClawText 后端更新 - AI 分析所有文档功能

## ✅ 已实现功能

### 📚 "分析所有文档"模式

当用户查询的关键词在 PDF 文档中匹配度很低（<3 个文档）或无匹配时，系统会自动切换到"分析所有文档"模式：

1. **自动触发条件**：
   - 搜索匹配的文档数 < 3 个
   - 且用户上传的文档总数 > 0

2. **处理方式**：
   - 读取所有上传的 PDF 文档内容
   - 限制每个文档最多 800 字符（避免 prompt 过长）
   - 最多分析前 20 个文档
   - 将内容发送给 AI 进行智能分析

3. **日志输出**：
   ```
   📚 匹配文档较少 (0)，将分析所有 28 个文档
   📚 分析所有文档模式：共 28 个文档
   📚 过滤后有效文档：11 个，每个文档限制 800 字符
   ```

## 🔧 修改的文件

### 1. `backend/ai-integration.js`

**修改位置**：`generateAnswer` 函数（约第 345 行）

**新增功能**：
- 添加 `options` 参数支持 `{ analyzeAllDocs, allDocuments }`
- 当 `analyzeAllDocs=true` 且无匹配文档时，使用所有文档进行分析
- 添加调试日志输出

**代码片段**：
```javascript
async generateAnswer(query, searchResults, context = '', options = {}) {
  const { analyzeAllDocs = false, allDocuments = [] } = options;
  
  // ... 提取搜索结果 ...
  
  // 如果启用"分析所有文档"模式，且没有匹配文档，则使用所有文档
  if (analyzeAllDocs && relevantDocs.length === 0 && allDocuments.length > 0) {
    console.log(`📚 分析所有文档模式：共 ${allDocuments.length} 个文档`);
    const maxContentPerDoc = 800;
    const maxDocs = Math.min(allDocuments.length, 20);
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
  
  // ... 生成 AI 回答 ...
}
```

### 2. `backend/server.js`

**修改位置**：`handleQueryWithAI` 函数（约第 1826 行）

**新增功能**：
- 准备所有文档作为回退数据
- 检测匹配文档数量，自动决定是否启用"分析所有文档"模式
- 传递 `options` 参数给 `generateAnswer`

**代码片段**：
```javascript
// 准备所有文档（用于无匹配时的回退）
const allDocumentsForFallback = files.map(file => ({
  originalName: file.originalName,
  fileName: file.originalName,
  content: file.content,
  year: getJudgmentYear(file),
  category: file.category
}));

// 如果搜索结果很少（<3 个），启用"分析所有文档"模式
const analyzeAllDocs = searchResults.totalMatches < 3 && files.length > 0;

if (analyzeAllDocs) {
  console.log(`📚 匹配文档较少 (${searchResults.totalMatches})，将分析所有 ${files.length} 个文档`);
}

const aiResponse = await aiProcessor.generateAnswer(
  query,
  searchResults.documents,
  `查询类型：${queryType}\n查询分析：${JSON.stringify(queryAnalysis, null, 2)}`,
  {
    analyzeAllDocs: analyzeAllDocs,
    allDocuments: allDocumentsForFallback
  }
);
```

## 📝 使用方法

### 前端使用

1. 打开前端页面 `http://localhost:5173`
2. 上传 PDF 文件
3. 在聊天框输入问题，例如：
   - "PDF 文档中是否提到区块链？"
   - "文档里有没有关于 cryptocurrency 的内容？"
   - 任何冷门关键词查询

4. 系统会自动：
   - 先尝试关键词匹配
   - 如果匹配少，自动分析所有文档
   - 返回基于所有文档内容的 AI 分析结果

### 后端 API

```bash
POST http://localhost:3000/api/chat?ai=true
Content-Type: application/json

{
  "message": "你的问题"
}
```

## ⚠️ 注意事项

1. **内容限制**：每个文档最多 800 字符，避免 prompt 过长导致 API 错误
2. **文档数量限制**：最多分析前 20 个文档
3. **API 超时**：分析多个文档可能需要较长时间，建议设置 timeout > 60 秒
4. **API 密钥**：确保 `.env` 中配置了有效的 `DASHSCOPE_API_KEY`

## 🧪 测试

运行测试脚本：
```bash
cd backend
node test-analyze-all.js
```

或手动测试：
```bash
node -e "const axios=require('axios'); axios.post('http://localhost:3000/api/chat?ai=true',{message:'PDF 文档中是否提到区块链？'},{headers:{'Content-Type':'application/json'}}).then(r=>console.log(r.data.answer))"
```

## 📊 当前状态

- ✅ 代码修改完成
- ✅ "分析所有文档"模式已实现
- ✅ 调试日志已添加
- ⚠️ AI API 调用可能超时（需要优化或检查 API 密钥）

## 🔄 下一步优化建议

1. **流式响应**：实现流式输出，让用户看到逐步生成的回答
2. **分批处理**：将文档分批发送给 AI，避免单次 prompt 过长
3. **缓存机制**：缓存已分析的文档内容，避免重复处理
4. **进度提示**：在前端显示"正在分析 X 个文档..."的进度提示
