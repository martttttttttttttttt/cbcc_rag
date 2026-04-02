# ClawTextPDFAnalysis 技能包

## 项目简介

ClawTextPDFAnalysis 是一个专业的 PDF 文档分析与 AI 智能问答技能包，专为法律文档（特别是香港 SFAT 相关文档）的处理和分析而设计。它集成了 PDF 管理、OCR 提取、文档分析、AI 问答、向量搜索和法律分析等核心功能，为用户提供端到端的文档处理解决方案。

## 技能包结构

```
skills/
├── manifest.json          # 技能包配置文件
├── SKILL.md               # 技能说明书
├── index.js               # 主入口文件
├── pdf-management.js      # PDF文件管理技能
├── ocr-extraction.js      # OCR文本提取技能
├── document-analysis.js   # 文档分析与分块技能
├── ai-qna.js              # AI智能问答技能
├── vector-search.js       # 向量语义搜索技能
├── legal-analysis.js      # 法律文档分析技能
├── example.js             # 使用示例
└── reference/             # 参考资料
    └── legal-terms.json   # 法律术语词典
```

## 核心功能

### 1. PDF 管理 (PDFManagement)
- PDF文件上传、覆盖和管理
- 文件分类（MMT/SFAT）
- 文件列表查询和删除

### 2. OCR 提取 (OCRExtraction)
- 自动文本提取
- 扫描版 PDF 检测和 OCR 处理
- 图片预处理提高识别准确率

### 3. 文档分析 (DocumentAnalysis)
- 文本预处理（清洗、标准化、同义词映射）
- 元数据提取（标题、案件编号、法院、日期等）
- 智能分块（基于结构标记和段落）

### 4. AI 问答 (AIQnA)
- 基于通义千问 API 的智能问答
- 问题分类和文档相关性评分
- 多文档综合分析和引用标注

### 5. 向量搜索 (VectorSearch)
- 基于向量相似度的语义搜索
- 向量生成和缓存管理
- 结果排序和相关性评分

### 6. 法律分析 (LegalAnalysis)
- 法院评论识别和分类
- 法律条款提取和统计
- 主题分析和关键词识别

## 快速开始

### 安装依赖

```bash
# 在项目根目录执行
npm install
```

### 配置环境变量

在 `.env` 文件中配置以下环境变量：

```env
# DashScope API Key（用于 AI 问答和向量生成）
DASHSCOPE_API_KEY=your_api_key_here
```

### 使用示例

```javascript
const { ClawTextSkills } = require('./skills');

// 初始化技能包
const skills = new ClawTextSkills();

// 上传 PDF 文件
const uploadResult = await skills.uploadPDF(['./sample.pdf'], 'SFAT');

// 智能问答
const qnaResult = await skills.askQuestion('What is the court\'s comment on disciplinary powers?');
console.log(qnaResult.answer);

// 向量搜索
const searchResult = await skills.search('disciplinary powers', 5);
console.log(searchResult.results);
```

## 详细文档

请参考 `SKILL.md` 文件获取详细的技能说明、API 参考和最佳实践。

## 运行示例

```bash
# 运行所有示例
node skills/example.js
```

## 技术要求

- Node.js >= 14.0
- npm >= 6.0
- 有效的 DashScope API Key（用于 AI 功能）

## 许可证

本技能包采用 MIT 许可证，可自由使用和修改。

## 联系方式

如有问题或建议，请联系 ClawText 开发团队。