# ClawTextPDFAnalysis Skill

## 技能描述

ClawTextPDFAnalysis 是一个专业的 PDF 文档分析与 AI 智能问答技能包，专为法律文档（特别是香港 SFAT 相关文档）的处理和分析而设计。它集成了 PDF 管理、OCR 提取、文档分析、AI 问答、向量搜索和法律分析等核心功能，为用户提供端到端的文档处理解决方案。

## 功能特性

### 1. PDF 管理 (PDFManagement)
- **PDF文件上传**：支持批量上传 PDF 文件，自动处理同名文件覆盖
- **文件分类**：支持 MMT 和 SFAT 两种文档分类
- **文件列表查询**：支持按分类过滤
- **文件删除**：安全删除文件及其相关数据

### 2. OCR 提取 (OCRExtraction)
- **自动文本提取**：从 PDF 中提取文本内容
- **扫描版 PDF 检测**：自动识别扫描版 PDF 并进行 OCR 处理
- **OCR 处理**：基于 Tesseract.js 的高精度文本识别
- **图片预处理**：提高 OCR 识别准确率

### 3. 文档分析 (DocumentAnalysis)
- **文本预处理**：清洗、标准化、同义词映射
- **元数据提取**：自动提取标题、案件编号、法院、日期等信息
- **智能分块**：基于结构标记（如 §、Section 等）和段落的智能分块
- **文档结构分析**：识别文档类型（Determination、Ruling、Interlocutory）

### 4. AI 问答 (AIQnA)
- **智能问答**：基于通义千问 API 的文档问答
- **问题分类**：自动识别问题类型并采用相应的回答策略
- **文档相关性评分**：基于关键词权重的文档相关性计算
- **多文档综合分析**：整合多个文档的信息进行回答
- **引用标注**：自动标注回答来源和段落号

### 5. 向量搜索 (VectorSearch)
- **语义搜索**：基于向量相似度的语义搜索
- **向量生成**：使用 DashScope API 生成文本向量
- **相似度计算**：余弦相似度算法
- **结果排序**：按相关性排序返回结果

### 6. 法律分析 (LegalAnalysis)
- **法院评论识别**：自动识别和分类法院/审裁处的评论
- **评论分类**：分为强调、批评、观察、观点等类型
- **法律条款提取**：自动提取和统计法律条款
- **主题分析**：识别文档的主要主题和关键词

## 技术架构

### 核心组件
- **Node.js**：运行环境
- **Express**：Web 服务（集成到主项目）
- **Tesseract.js**：OCR 处理
- **PDF-Parse**：PDF 文本提取
- **DashScope API**：AI 模型和向量生成
- **文件系统**：本地存储和数据库

### 数据存储
- **PDF 文件**：存储在 `backend/pdf_files/` 目录
- **文档数据库**：`backend/pdf_database.json`
- **分块数据库**：`backend/chunks_database.json`
- **临时文件**：`backend/temp_quick_ocr/`（用于 OCR 处理）

## 安装与配置

### 依赖安装
```bash
# 在项目根目录执行
npm install

# 技能包依赖已包含在主项目中
```

### 环境变量
需要配置以下环境变量（在 `.env` 文件中）：

```env
# DashScope API Key（用于 AI 问答和向量生成）
DASHSCOPE_API_KEY=your_api_key_here
```

## 使用方法

### 初始化技能包
```javascript
const { ClawTextSkills } = require('./skills');

// 初始化技能包
const skills = new ClawTextSkills({
  storageDir: './backend/pdf_files',      // PDF 文件存储目录
  dbPath: './backend/pdf_database.json',  // 文档数据库路径
  chunkDBPath: './backend/chunks_database.json'  // 分块数据库路径
});
```

### 核心功能调用

#### 1. 上传 PDF 文件
```javascript
const result = await skills.uploadPDF([
  './path/to/file1.pdf',
  './path/to/file2.pdf'
], 'SFAT'); // 分类：SFAT 或 MMT
```

#### 2. 提取文本
```javascript
const result = await skills.extractText('./backend/pdf_files/sample.pdf');
console.log(result.text); // 提取的文本内容
```

#### 3. 文档分析
```javascript
const extractResult = await skills.extractText('./backend/pdf_files/sample.pdf');
const result = await skills.analyzeDocument(
  extractResult.text,
  'doc-123',  // 文档ID
  'sample.pdf' // 文档名称
);
console.log(result.metadata); // 提取的元数据
console.log(result.chunks); // 智能分块结果
```

#### 4. AI 问答
```javascript
const result = await skills.askQuestion(
  'What is the court\'s comment on disciplinary powers?',
  'SFAT',  // 分类过滤
  ['doc-123']  // 文档过滤
);
console.log(result.answer); // AI 回答
console.log(result.sources); // 回答来源
```

#### 5. 向量搜索
```javascript
const result = await skills.search('disciplinary powers', 5); // 搜索并返回前 5 个结果
console.log(result.results); // 搜索结果
```

#### 6. 法院评论分析
```javascript
const extractResult = await skills.extractText('./backend/pdf_files/sample.pdf');
const result = await skills.analyzeCourtComments(
  extractResult.text,
  'sample.pdf'
);
console.log(result.comments); // 识别的法院评论
console.log(result.analysis); // 分析结果
```

## API 参考

### 技能模块接口

#### PDFManagement
- `upload({ files, category })`：上传 PDF 文件
- `list({ category })`：获取文件列表
- `delete({ fileId })`：删除文件

#### OCRExtraction
- `extract({ filePath })`：提取文本

#### DocumentAnalysis
- `analyze({ content, docId, docName })`：分析文档

#### AIQnA
- `ask({ question, category, docFilter })`：智能问答

#### VectorSearch
- `search({ query, topK })`：向量搜索
- `generateEmbeddingsForChunks()`：生成向量

#### LegalAnalysis
- `analyzeCourtComments({ content, docName })`：分析法院评论
- `analyzeLegalProvisions({ content, docName })`：分析法律条款

## 最佳实践

1. **文件管理**：建议按分类（MMT/SFAT）组织 PDF 文件，便于后续分析
2. **OCR 处理**：对于扫描版 PDF，OCR 处理可能需要较长时间，请耐心等待
3. **AI 问答**：问题应具体明确，包含足够的上下文信息
4. **向量搜索**：首次使用时，建议先调用 `generateEmbeddings()` 生成向量缓存
5. **法院评论分析**：适用于识别法院的重要意见和观点，对法律研究特别有价值

## 故障排除

### 常见问题

1. **AI 调用失败**
   - 原因：DASHSCOPE_API_KEY 未配置或无效
   - 解决：在 .env 文件中配置有效的 API Key

2. **OCR 处理失败**
   - 原因：PDF 文件损坏或无法解析
   - 解决：检查 PDF 文件是否完整，尝试使用其他 PDF 阅读器打开

3. **向量搜索无结果**
   - 原因：分块数据库为空或未生成向量
   - 解决：先上传 PDF 文件并调用 `generateEmbeddings()`

4. **文件上传失败**
   - 原因：文件路径不存在或权限不足
   - 解决：检查文件路径是否正确，确保有读写权限

## 版本历史

- **v1.0.0**：初始版本
  - 实现 PDF 管理、OCR 提取、文档分析功能
  - 集成 AI 问答和向量搜索
  - 添加法律分析功能

## 许可证

本技能包采用 MIT 许可证，可自由使用和修改。

## 联系方式

如有问题或建议，请联系 ClawText 开发团队。