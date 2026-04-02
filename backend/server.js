// 加载环境变量
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const { extractTextWithOCR } = require('./ocr-extract');
const axios = require('axios');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use('/pdf', express.static(path.join(__dirname, 'pdf_files')));

// 数据库文件路径
const DB_PATH = path.join(__dirname, 'pdf_database.json');

// 确保存储目录存在
const storageDir = path.join(__dirname, 'pdf_files');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// 初始化数据库
function initDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      uploadTime: new Date().toISOString(),
      files: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
  }
}

initDatabase();

// 过滤 PDF 内容中的无意义字符
function filterContent(content) {
  if (!content) return content;
  
  let filtered = content;
  
  // 1. 移除连续的单字母序列 (如 "F G H I J K L M N O P Q R S T U V A B C D E")
  // 匹配模式：单个大写字母 + 空格，重复 5 次以上
  const singleLetterPattern = /(?:[A-Z]\s+){5,}[A-Z]/g;
  filtered = filtered.replace(singleLetterPattern, '');
  
  // 2. 移除连续的单个小写字母序列
  const singleLowerPattern = /(?:[a-z]\s+){5,}[a-z]/g;
  filtered = filtered.replace(singleLowerPattern, '');
  
  // 3. 移除页码标记 (如 "-- 1 of 56 --" 或 "--1 of 56--")
  const pageNumPattern = /--\s*\d+\s+of\s+\d+\s*--/g;
  filtered = filtered.replace(pageNumPattern, '');
  
  // 4. 移除连续的下划线行
  const underlinePattern = /_{10,}/g;
  filtered = filtered.replace(underlinePattern, '');
  
  // 5. 移除只有空格的行
  const emptyLines = /^\s+$/gm;
  filtered = filtered.replace(emptyLines, '');
  
  // 6. 清理多余的空行（超过 2 个连续换行）
  filtered = filtered.replace(/\n{3,}/g, '\n\n');
  
  // 7. 移除行首尾的多余空格
  filtered = filtered.split('\n').map(line => line.trim()).join('\n');
  
  return filtered.trim();
}

// 读取数据库
function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取数据库失败:', error.message);
    return { files: [] };
  }
}

// 写入数据库
function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('写入数据库失败:', error.message);
    throw new Error('保存数据失败');
  }
}

// Multer 配置
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, storageDir);
  },
  filename: function (req, file, cb) {
    // 使用唯一文件名避免冲突
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  // 无文件大小限制 - 由服务器内存和磁盘空间决定
  fileFilter: function (req, file, cb) {
    // 检查文件类型
    const allowedTypes = [
      'application/pdf',
      'application/x-pdf',
      'application/acrobat',
      'applications/vnd.pdf',
      'text/pdf',
      'text/x-pdf'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('仅允许上传 PDF 文件'), false);
    }
  }
});

// 批量上传中间件 - 支持 pdfFiles (复数) 或 pdfFile (单数)
const uploadMultiple = upload.fields([
  { name: 'pdfFiles', maxCount: 50 },
  { name: 'pdfFile', maxCount: 50 }
]);

// 简单的 Hello API
app.get('/api/hello', (req, res) => {
  res.json({ 
    message: 'ClawText PDF Upload Server',
    version: '1.0.0',
    features: ['PDF 上传', '文件列表']
  });
});

// 上传 PDF（支持单个或批量）
app.post('/api/upload-pdf', (req, res) => {
  uploadMultiple(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(500).json({
        success: false,
        error: err.message || '上传失败'
      });
    }
    
    try {
      // 兼容两种字段名：pdfFiles 或 pdfFile
      const files = req.files?.pdfFiles || req.files?.pdfFile || (req.file ? [req.file] : []);
      
      if (files.length === 0) {
        return res.status(400).json({
          success: false,
          error: '没有收到上传的文件'
        });
      }
      
      // 获取分类参数 - 只允许 MMT 或 SFAT
      let category = req.body.category || 'MMT';
      if (category !== 'MMT' && category !== 'SFAT') {
        category = 'MMT'; // 默认值
      }
      
      const uploadedFiles = [];
      
      // 读取数据库
      const db = readDB();
      
      // 处理所有文件 - 支持同名文件覆盖
      // 先保存基本信息，内容提取异步进行
      for (const file of files) {
        // 检查是否已有同名文件，如果有则先删除（覆盖模式）
        const existingFile = db.files.find(f => f.originalName === file.originalname);
        if (existingFile) {
          console.log(`🔄 检测到同名文件，将覆盖：${file.originalname}`);
          
          // 删除旧文件记录
          db.files = db.files.filter(f => f.id !== existingFile.id);
          
          // 删除旧物理文件
          const oldFilePath = path.join(__dirname, 'pdf_files', existingFile.fileName);
          if (fs.existsSync(oldFilePath)) {
            try {
              fs.unlinkSync(oldFilePath);
              console.log(`   🗑️ 已删除旧文件：${existingFile.fileName}`);
            } catch (err) {
              console.error(`   ⚠️ 删除旧文件失败：${err.message}`);
            }
          }
        }
        
        const fileInfo = {
          id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
          originalName: file.originalname,
          fileName: file.filename,
          filePath: path.join('/', 'pdf', file.filename),
          mimeType: file.mimetype,
          size: file.size,
          category: category,
          uploadTime: new Date().toISOString(),
          uploadTimestamp: Date.now(),
          content: '' // 稍后填充
        };
        
        // 异步提取 PDF 内容并生成智能分块
        const fullPath = path.join(__dirname, 'pdf_files', file.filename);
        (async () => {
          try {
            const buffer = fs.readFileSync(fullPath);
            const parser = new PDFParse({ data: buffer });
            const data = await parser.getText();
            let rawContent = filterContent(data.text.substring(0, 50000));
            fileInfo.pageCount = data.numpages;
            fileInfo.docId = fileInfo.id; // docId 与 fileId 一致，用于文档级检索
            
            // 检测是否为扫描版 PDF（文本提取过少且文件较大）
            const isScannedPDF = rawContent.length < 100 && file.size > 500000;
            
            if (isScannedPDF) {
              console.log(`   ⚠️ 检测到扫描版 PDF（仅提取 ${rawContent.length} 字符），尝试 OCR 处理...`);
              const ocrText = await extractTextWithOCR(fullPath, file.originalname);
              if (ocrText.length > 0) {
                rawContent = ocrText;
                console.log(`   ✅ OCR 成功，使用 OCR 提取的 ${rawContent.length} 字符`);
              }
            }
            
            fileInfo.content = rawContent;
            
            // 生成智能分块并存储
            const chunks = smartChunk(rawContent, fileInfo.docId, fileInfo.originalName);
            fileInfo.chunks = chunks.map(c => ({
              id: c.id,
              structureMarker: c.structureMarker,
              chunkIndex: c.chunkIndex,
              contentPreview: c.content.substring(0, 100)
            }));
            fileInfo.chunkCount = chunks.length;
            
            console.log(`   📄 提取内容：${data.numpages} 页，${rawContent.length} 字符，${chunks.length} 个分块`);
            
            // 更新数据库中的内容
            const db = readDB();
            const idx = db.files.findIndex(f => f.id === fileInfo.id);
            if (idx !== -1) {
              db.files[idx] = fileInfo;
              writeDB(db);
            }
          } catch (err) {
            console.error(`   ⚠️ 内容提取失败：${err.message}`);
          }
        })();
        
        db.files.unshift(fileInfo);
        
        console.log(`✅ PDF 文件已上传：${fileInfo.originalName}`);
        console.log(`   类型：${fileInfo.category}`);
        console.log(`   路径：${fileInfo.filePath}`);
        console.log(`   大小：${(fileInfo.size / 1024).toFixed(2)} KB`);
        
        uploadedFiles.push({
          success: true,
          fileId: fileInfo.id,
          originalName: fileInfo.originalName,
          category: fileInfo.category,
          size: fileInfo.size,
          overwritten: existingFile ? true : false,
          uploadTime: fileInfo.uploadTime,
          filePath: fileInfo.filePath
        });
      }
      
      db.uploadTime = new Date().toISOString();
      
      // 写入数据库
      writeDB(db);
      
      res.json({
        success: true,
        total: uploadedFiles.length,
        files: uploadedFiles,
        category: category,
        message: `成功上传 ${uploadedFiles.length} 个 PDF 文件！`
      });
      
    } catch (error) {
      console.error('上传错误:', error);
      res.status(500).json({
        success: false,
        error: error.message || '服务器内部错误'
      });
    }
  });
});

// 获取 PDF 列表
app.get('/api/pdf-files', (req, res) => {
  try {
    const db = readDB();
    if (!db || !db.files) {
      return res.json({
        success: true,
        total: 0,
        files: []
      });
    }
    res.json({
      success: true,
      total: db.files.length,
      files: db.files
    });
  } catch (error) {
    console.error('获取文件列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取文件列表失败'
    });
  }
});

// 获取文档列表（精简版，用于文档选择器）
app.get('/api/documents', (req, res) => {
  try {
    const { category } = req.query;
    const db = readDB();
    if (!db || !db.files) {
      return res.json({
        success: true,
        total: 0,
        documents: []
      });
    }
    
    let files = db.files.filter(f => f.status !== 'deleted' && f.content && f.content.length > 0);
    
    if (category) {
      files = files.filter(f => f.category === category);
    }
    
    const documents = files.map(f => ({
      id: f.id,
      docId: f.docId || f.id,
      name: f.originalName,
      category: f.category,
      pageCount: f.pageCount,
      chunkCount: f.chunkCount || 0,
      uploadTime: f.uploadTime
    }));
    
    res.json({
      success: true,
      total: documents.length,
      documents
    });
  } catch (error) {
    console.error('获取文档列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取文档列表失败'
    });
  }
});

// 删除 PDF 文件
app.delete('/api/pdf-files/:id', (req, res) => {
  try {
    const { id } = req.params;
    let db = readDB();
    
    // 找到文件
    const fileIndex = db.files.findIndex(f => f.id === id);
    if (fileIndex === -1) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      });
    }
    
    const file = db.files[fileIndex];
    
    // 检查文件是否存在于文件系统
    const fullPath = path.join(__dirname, 'pdf_files', file.fileName);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`🗑️ 文件已删除：${fullPath}`);
    }
    
    // 从数据库中移除（标记为 deleted）
    db.files[fileIndex].status = 'deleted';
    db.uploadTime = new Date().toISOString();
    
    writeDB(db);
    
    res.json({
      success: true,
      message: '文件已成功删除',
      fileId: id
    });
    
  } catch (error) {
    console.error('删除文件失败:', error);
    res.status(500).json({
      success: false,
      error: '删除文件失败'
    });
  }
});

// 重新提取所有 PDF 内容 API（带智能分块）
app.post('/api/extract-all-content', async (req, res) => {
  try {
    const db = readDB();
    if (!db || !db.files) {
      return res.json({
        success: true,
        message: '没有 PDF 文件需要提取',
        processed: 0
      });
    }
    
    let processed = 0;
    let success = 0;
    let failed = 0;
    let totalChunks = 0;
    
    for (const file of db.files) {
      if (file.status === 'deleted' || !file.filePath) continue;
      
      // 构建正确的文件路径
      const fileName = file.fileName || path.basename(file.filePath);
      const fullPath = path.join(__dirname, 'pdf_files', fileName);
      
      if (!fs.existsSync(fullPath)) {
        console.log(`⚠️ 文件不存在：${fullPath}`);
        failed++;
        continue;
      }
      
      try {
        const buffer = fs.readFileSync(fullPath);
        const parser = new PDFParse({ data: buffer });
        const data = await parser.getText();
        const rawContent = filterContent(data.text.substring(0, 50000));
        file.content = rawContent;
        file.pageCount = data.numpages;
        file.contentExtractedAt = new Date().toISOString();
        file.docId = file.id;
        
        // 生成智能分块
        const chunks = smartChunk(rawContent, file.docId, file.originalName);
        file.chunks = chunks.map(c => ({
          id: c.id,
          structureMarker: c.structureMarker,
          chunkIndex: c.chunkIndex,
          contentPreview: c.content.substring(0, 100)
        }));
        file.chunkCount = chunks.length;
        totalChunks += chunks.length;
        
        console.log(`✅ 提取内容：${file.originalName} - ${data.numpages} 页，${chunks.length} 个分块`);
        success++;
      } catch (err) {
        console.error(`❌ 提取失败：${file.originalName} - ${err.message}`);
        failed++;
      }
      
      processed++;
    }
    
    writeDB(db);
    
    res.json({
      success: true,
      message: `内容提取完成，共生成 ${totalChunks} 个智能分块`,
      processed,
      success,
      failed,
      totalChunks
    });
  } catch (error) {
    console.error('批量提取错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== AI 大模型集成模块 ====================
// 让 AI 直接智能分析用户问题并处理 PDF 内容
// =======================================================

// 调用通义千问 API
async function callQwenAI(question, context) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  
  if (!apiKey) {
    throw new Error('未配置 DASHSCOPE_API_KEY 环境变量');
  }
  
  const systemPrompt = `你是一位专业的法律文档分析助手，专门分析香港 SFAT（Securities and Futures Appeals Tribunal）相关文档。

【角色定位】
- 你是严谨的法律研究助手，不是法律顾问
- 你的回答必须 100% 基于提供的文档内容
- 你不能使用外部知识或推测

【核心任务类型识别】

**任务 1：识别法院评论**（当用户询问"court comments"、"法院评论"、"tribunal 意见"时）
1. 精准定位文档中法院/审裁处的具体评论段落
2. 提取法院的原话或核心观点（使用引号标注原文）
3. 必须注明具体段落号（§XX）或页码
4. 如法院有批评/建议，明确标注

**任务 2：识别中间申请/程序性裁决**（当用户询问"interlocutory applications"、"procedural rulings"、"interim matters"时）
1. 理解"interlocutory"含义：程序性或临时性裁决，非最终判决
2. 识别关键词：Ruling（非 Determination）、withdrawal、costs、evidence admission、anonymity、in camera、expunge、asset-freeze
3. 区分文档类型：
   - **Ruling** = 中间裁决（程序性事项）
   - **Determination** = 最终判决（实体性事项）
4. 提取每个中间申请的关键信息：
   - 案件编号（如 SFAT 2023-2）
   - 年份
   - 裁决类型（Ruling）
   - 涉及的程序事项（证据采纳、费用、匿名申请等）
   - 当事人姓名（如有）

【回答格式要求】

**针对法院评论问题：**
1. 开头直接回答问题 - 1-2 句概括法院是否有相关评论
2. 分点列出法院评论 - 每个评论点包含：
   - 小标题概括该点主题
   - 法院的具体评论/观点
   - 精确引用（文档名 + §段落号）
3. 使用清晰的结构 - 可用编号或项目符号
4. 保留法律术语原文 - 如"fit and proper"、"disciplinary powers"不翻译

**针对中间申请识别问题：**
1. 开头直接回答识别到的数量（如"Based on the provided metadata, the following are identified as SFAT interlocutory applications..."）
2. 编号列表，每项包含：
   - **文档名称**（加粗）
   - **年份**
   - **裁决类型**（Ruling on...）
   - **程序事项描述**（如"Admission of factual witness statements"）
   - **当事人姓名**（如有）
3. 结尾总结这些案件的共同特征（如"These cases explicitly involve interlocutory matters...rather than final determinations"）

【严格约束条件】
⚠️ 禁止行为：
- 禁止编造任何文档中不存在的信息
- 禁止使用"可能"、"大概"、"通常"、"也许"等模糊词汇
- 禁止引用未提供的法律条文或案例
- 禁止推测文档作者的意图或观点
- 禁止泛泛而谈，必须提供具体来源

✅ 正确做法：
- 如果文档中没有答案，直接回复："⚠️ 提供的文档中没有相关信息"
- 引用时必须注明具体文档名称（如"SFAT 2021-5 Determination.pdf"）
- 优先引用原文（使用引号）
- 如多个文档有相关信息，分别列出并编号

【输出语言】
- 使用与用户问题相同的语言回答
- 法律术语、案件编号、条款号保留英文原文`;

  const userPrompt = `【文档内容】
以下法律文档包含 SFAT（Securities and Futures Appeals Tribunal）的相关决定书、裁决书、法院判词和程序指引。

${context}

【用户问题】
${question}

【回答指令 - 严格遵守】

**第一步：理解问题类型**
- 如询问"court comments"、"tribunal comments"、"法院评论"、"审裁处意见"→ 执行【法院评论识别】
- 如询问"interlocutory applications"、"procedural rulings"、"interim matters"→ 执行【中间申请识别】
- 其他问题 → 直接分析文档内容回答

**第二步：定位相关信息**
- 仔细阅读提供的文档
- 找到与问题直接相关的段落
- 记录文档名称、段落号（§）、页码

**第三步：结构化输出（必须严格按照以下格式，不能偏离）**

【法院评论问题 - 标准格式】
第一行：Based on the document: [文档名称]
第二行：The court has commented [extensively/briefly] on [问题主题]. Below are the relevant points:
然后：空行
然后：**[小标题 1]**: [评论内容] (§段落号)
然后：**[小标题 2]**: [评论内容] (§段落号)
然后：空行
然后：In summary, [总结法院的核心观点].

【中间申请识别 - 标准格式】
第一行：Based on the provided metadata, the following are identified as SFAT interlocutory applications:
然后：空行
然后：1. **[文档名称]** ([年份])
然后：   - Ruling type: [裁决类型]
然后：   - Procedural matter: [程序事项]
然后：   - Parties: [当事人]
然后：...
然后：空行
然后：These cases involve interlocutory matters rather than final determinations.

**第四步：严格约束**
- 必须基于文档内容，不能添加外部知识
- 必须标注精确引用（文档名 + §段落号）
- 保留法律术语原文（如"fit and proper"、"and/or"、"misconduct"）
- 禁止使用模糊词汇（"可能"、"大概"、"似乎"）
- 如无相关信息，直接回复："⚠️ 提供的文档中没有相关信息"
- 禁止编造段落号或文档名称

**⚠️ 重要：必须严格遵循以下示例答案的格式！**

【示例答案 - 必须模仿此格式】
Based on the document: SFAT 2021-5 Determination (f).pdf
The court has commented extensively on the route by which disciplinary powers are exercised. Below are the relevant points:

**Identification of the Route**: The court emphasized that the SFC must clearly identify which limb of section 194(1) of the SFO it is relying on as the trigger for exercising its disciplinary powers. This includes specifying whether the decision is based on a finding of misconduct or the opinion that the applicant is "not a fit and proper person to be or to remain the same type of regulated person" (§28).

**Importance of Transparency**: The court criticized the SFC's use of "and/or" in articulating its decision, stating that it obscures the clarity of the route and basis for exercising disciplinary powers. The court declared this practice "wholly unacceptable" and urged the SFC to stop using such language (§42).

**Legal Basis for Misconduct**: The court noted that the definition of misconduct in section 193(1) includes five separate paragraphs, each providing a distinct basis for finding a regulated person guilty of misconduct (§30, §47).

**Duty to Explain Decisions**: The court pointed out that when the SFC forms the opinion under section 194(1)(b) that a regulated person is "not fit and proper," but decides not to impose an exclusionary sanction, it has a duty to explain its reasoning. This explanation must be transparent to both the individual and the public (§45).

**Impact on Tribunal Review**: The lack of clarity in the SFC's decision-making process impacts the ability of the Securities and Futures Appeals Tribunal (SFAT) to effectively review the decision. The tribunal requires unequivocal clarity and precision regarding the legal route taken by the SFC to impose disciplinary measures (§41).

In summary, the court has strongly emphasized the need for transparency, precision, and detailed reasoning in the SFC's decisions regarding disciplinary actions. It criticized practices that lack clarity and called for improvements to ensure the integrity of the regulatory process.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
  
  try {
    const response = await axios.post(
      'https://coding.dashscope.aliyuncs.com/v1/chat/completions',
      {
        model: 'qwen3.5-plus',
        messages: messages,
        temperature: 0.3,
        max_tokens: 4096,
        top_p: 0.9,
        frequency_penalty: 0.1
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 180000
      }
    );
    
    const answer = response.data.choices?.[0]?.message?.content;
    
    const answerWithDisclaimer = answer 
      ? `${answer}\n\n---\n*⚖️ 以上答案基于提供的文档内容生成，仅供参考，不构成法律意见。*`
      : 'AI 未能生成答案';
    
    return {
      success: true,
      answer: answerWithDisclaimer,
      model: 'qwen3.5-plus'
    };
  } catch (error) {
    console.error('❌ AI 调用失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data));
    }
    return {
      success: false,
      error: error.message,
      answer: null
    };
  }
}

// ==================== 文档智能分块（用于上传时结构化存储） ====================
// 保留法律文本结构（§、Section、Article 等），仅用于数据存储，不用于检索

const CHUNK_CONFIG = {
  minChunkSize: 200,
  maxChunkSize: 800,
  overlapSize: 100,
  preserveStructure: true
};

function smartChunk(content, docId, docName) {
  const chunks = [];
  const structurePattern = /(?:§\s*\d+|Section\s+\d+|Article\s+\d+|Paragraph\s+\d+|\(\d+\)\s*[A-Z])/gi;
  
  const matches = [];
  let match;
  const regex = new RegExp(structurePattern, 'gi');
  
  while ((match = regex.exec(content)) !== null) {
    matches.push({ index: match.index, text: match[0] });
  }
  
  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = (i < matches.length - 1) ? matches[i + 1].index : content.length;
      const chunkText = content.substring(start, end).trim();
      
      if (chunkText.length >= CHUNK_CONFIG.minChunkSize) {
        chunks.push({
          id: `${docId}-chunk-${i}`,
          docId: docId,
          docName: docName,
          content: chunkText,
          structureMarker: matches[i].text,
          chunkIndex: i,
          totalChunks: matches.length
        });
      }
    }
  } else {
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (const para of paragraphs) {
      if (currentChunk.length + para.length > CHUNK_CONFIG.maxChunkSize) {
        if (currentChunk.length >= CHUNK_CONFIG.minChunkSize) {
          chunks.push({
            id: `${docId}-chunk-${chunkIndex}`,
            docId: docId,
            docName: docName,
            content: currentChunk.trim(),
            structureMarker: null,
            chunkIndex: chunkIndex
          });
          chunkIndex++;
        }
        currentChunk = currentChunk.substring(currentChunk.length - CHUNK_CONFIG.overlapSize) + '\n\n' + para;
      } else {
        currentChunk += '\n\n' + para;
      }
    }
    
    if (currentChunk.trim().length >= CHUNK_CONFIG.minChunkSize) {
      chunks.push({
        id: `${docId}-chunk-${chunkIndex}`,
        docId: docId,
        docName: docName,
        content: currentChunk.trim(),
        structureMarker: null,
        chunkIndex: chunkIndex
      });
    }
  }
  
  return chunks;
}

// ==================== 智能检索模块 ====================
// 根据问题关键词定位相关文档和相关段落
// ===================================================

// 提取问题中的关键词（用于检索）
function extractKeywords(question) {
  // 法律领域关键词权重（高权重）
  const legalKeywords = [
    'court', 'tribunal', 'SFAT', 'SFC', 'determination', 'ruling',
    'disciplinary', 'powers', 'route', 'section', 'ordinance', 'SFO',
    'misconduct', 'fit and proper', 'sanction', 'interlocutory',
    'evidence', 'witness', 'costs', 'anonymity', 'in camera', 'comment',
    'comments', 'emphasized', 'criticized', 'transparency', 'clarity'
  ];
  
  // 超高权重关键词（问题核心）
  const ultraKeywords = ['route', 'disciplinary', 'powers', 'comment', 'comments', 'court', 'tribunal'];
  
  // 停用词（不提取这些常见词）
  const stopWords = ['there', 'from', 'which', 'have', 'been', 'that', 'this', 'with', 'they', 'their', 'what', 'when', 'where', 'how', 'any', 'about', 'into', 'would', 'could', 'should'];
  
  const keywords = [];
  const lowerQuestion = question.toLowerCase();
  
  // 1. 优先提取超高权重关键词（weight: 5）
  for (const keyword of ultraKeywords) {
    if (lowerQuestion.includes(keyword.toLowerCase())) {
      keywords.push({ word: keyword, weight: 5, type: 'ultra' });
    }
  }
  
  // 2. 提取其他法律关键词（weight: 3）
  for (const keyword of legalKeywords) {
    if (!keywords.some(k => k.word.toLowerCase() === keyword.toLowerCase()) && 
        lowerQuestion.includes(keyword.toLowerCase())) {
      keywords.push({ word: keyword, weight: 3, type: 'legal' });
    }
  }
  
  // 3. 提取问题中的实词（名词、动词）（weight: 1），排除停用词
  const words = question.split(/\s+/).filter(w => w.length > 3);
  for (const word of words) {
    const cleanWord = word.replace(/[^a-zA-Z]/g, '');
    if (cleanWord.length > 3 && 
        !keywords.some(k => k.word.toLowerCase() === cleanWord.toLowerCase()) &&
        !stopWords.includes(cleanWord.toLowerCase())) {
      keywords.push({ word: cleanWord, weight: 1, type: 'general' });
    }
  }
  
  return keywords;
}

// 计算文档与问题的相关性分数
function calculateRelevanceScore(docContent, docName, keywords) {
  let score = 0;
  const lowerContent = docContent.toLowerCase();
  const lowerName = docName.toLowerCase();
  
  for (const keyword of keywords) {
    const lowerKeyword = keyword.word.toLowerCase();
    const weight = keyword.weight;
    
    // 文档名称匹配（超高权重：weight × 10）
    if (lowerName.includes(lowerKeyword)) {
      score += weight * 10;
      console.log(`  📛 名称匹配 "${keyword.word}": +${weight * 10}`);
    }
    
    // 内容匹配（计算出现次数）
    const regex = new RegExp(lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = lowerContent.match(regex);
    if (matches) {
      const matchScore = weight * matches.length;
      score += matchScore;
      if (matches.length >= 3) {
        console.log(`  📄 内容匹配 "${keyword.word}": ${matches.length}次 +${matchScore}`);
      }
    }
  }
  
  return score;
}

// 定位文档中与问题最相关的段落
function extractRelevantParagraphs(docContent, keywords, maxChars = 6000) {
  const paragraphs = docContent.split(/\n\s*\n/).filter(p => p.trim().length > 50);
  const scoredParagraphs = [];
  
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    let paraScore = 0;
    
    for (const keyword of keywords) {
      const lowerKeyword = keyword.word.toLowerCase();
      const matches = para.toLowerCase().match(new RegExp(lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
      if (matches) {
        paraScore += keyword.weight * matches.length;
      }
    }
    
    if (paraScore > 0) {
      scoredParagraphs.push({
        index: i,
        content: para.trim(),
        score: paraScore
      });
    }
  }
  
  // 按分数排序，取最相关的段落
  scoredParagraphs.sort((a, b) => b.score - a.score);
  
  // 选取最相关的段落，直到达到字符限制
  const selectedParagraphs = [];
  let totalChars = 0;
  
  // 优先选取分数最高的段落
  for (const para of scoredParagraphs) {
    if (totalChars + para.content.length <= maxChars) {
      selectedParagraphs.push(para);
      totalChars += para.content.length;
    }
  }
  
  // 如果没有找到相关段落，返回文档开头部分
  if (selectedParagraphs.length === 0) {
    return docContent.substring(0, maxChars);
  }
  
  // 按原文顺序重新排列选中的段落，保持上下文连贯
  selectedParagraphs.sort((a, b) => a.index - b.index);
  
  return selectedParagraphs.map(p => p.content).join('\n\n');
}

// ==================== 增强版聊天 API（AI 全量分析） ====================
// 传递所有文档给 AI，让 AI 自己判断哪些内容相关
// ================================================================

app.post('/api/chat', async (req, res) => {
  try {
    const { message, category, docFilter } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: '请输入问题'
      });
    }
    
    const db = readDB();
    if (!db || !db.files) {
      return res.json({
        success: true,
        answer: '还没有上传任何 PDF 文件，请先上传文件后再提问。',
        sources: []
      });
    }
    
    // 根据分类筛选文件
    let relevantFiles = db.files.filter(f => 
      f.status !== 'deleted' && 
      f.content && 
      f.content.length > 0 &&
      (!category || f.category === category)
    );
    
    // 文档级过滤（如果指定了 docFilter）
    if (docFilter && docFilter.length > 0) {
      relevantFiles = relevantFiles.filter(f => 
        docFilter.some(df => f.id === df || f.originalName.toLowerCase().includes(df.toLowerCase()))
      );
    }
    
    if (relevantFiles.length === 0) {
      const catMsg = category ? `【${category}】分类下` : '';
      const docMsg = docFilter ? `（文档过滤：${docFilter.join(', ')}）` : '';
      return res.json({
        success: true,
        answer: `${catMsg}没有找到匹配的 PDF 文件${docMsg}。请检查过滤条件。`,
        sources: [],
        category: category
      });
    }
    
    console.log(`📚 找到 ${relevantFiles.length} 个文档`);
    
    // 提取问题关键词用于智能筛选
    const keywords = extractKeywords(message);
    console.log(`🔍 问题关键词：${keywords.map(k => `${k.word}(${k.weight})`).join(', ')}`);
    
    // 计算每个文档的相关性分数
    const scoredFiles = relevantFiles.map(f => ({
      file: f,
      score: calculateRelevanceScore(f.content, f.originalName, keywords)
    }));
    
    // 按相关性排序
    scoredFiles.sort((a, b) => b.score - a.score);
    
    // 调试输出：显示所有文档评分
    console.log('📊 文档评分排名:');
    scoredFiles.forEach((sf, i) => {
      if (sf.score > 0 || i < 3) {
        console.log(`  ${i+1}. ${sf.file.originalName.substring(0, 40)}... score=${sf.score}`);
      }
    });
    
    // 选取最相关的 Top 5 文档（避免上下文过大导致超时）
    const topFiles = scoredFiles.slice(0, 10).filter(f => f.score > 0);
    
    let selectedFiles;
    if (topFiles.length === 0) {
      console.log('⚠️ 未找到关键词匹配的文档，使用所有候选文件（最多 10 个）');
      selectedFiles = relevantFiles.slice(0, 10);
    } else {
      selectedFiles = topFiles.map(f => f.file);
      console.log(`✅ 选取 Top ${selectedFiles.length} 个最相关文档`);
    }
    
    // 构建 AI 上下文 - 传递精选文档的完整内容
    const sources = [];
    const contextParts = [];
    
    // 每个文档最多 8000 字符（平衡上下文大小和内容完整性）
    const maxCharsPerDoc = 25000;
    
    for (const file of selectedFiles) {
      // 传递完整文档内容（不超过限制）
      const docContent = file.content.length > maxCharsPerDoc 
        ? file.content.substring(0, maxCharsPerDoc) + '\n\n[...内容过长，已截断...]' 
        : file.content;
      
      contextParts.push(`📄 文档：${file.originalName}\n类别：${file.category}\n页数：${file.pageCount || '未知'}\n\n${docContent}`);
      
      sources.push({
        docId: file.id,
        fileName: file.originalName,
        category: file.category,
        pageCount: file.pageCount,
        contentLength: file.content.length,
        relevanceScore: scoredFiles.find(f => f.file.id === file.id)?.score || 0
      });
    }
    
    const aiContext = contextParts.join('\n\n==========\n\n');
    
    console.log('🤖 正在调用 AI 大模型分析精选文档...');
    console.log(`📝 上下文总长度：${aiContext.length} 字符`);
    
    // 调用 AI 大模型生成答案
    const aiResult = await callQwenAI(message, aiContext);
    
    let finalAnswer = '';
    let aiUsed = false;
    let aiModel = null;
    
    if (aiResult.success && aiResult.answer) {
      finalAnswer = aiResult.answer;
      aiUsed = true;
      aiModel = aiResult.model;
      console.log('✅ AI 答案生成成功');
    } else {
      console.log('⚠️ AI 调用失败，返回错误信息');
      finalAnswer = `抱歉，AI 分析过程中出现问题：${aiResult.error || '未知错误'}\n\n请尝试简化您的问题或检查文档内容。`;
      aiUsed = false;
    }
    
    res.json({
      success: true,
      answer: finalAnswer,
      sources: sources,
      category: category,
      totalDocuments: relevantFiles.length,
      aiUsed: aiUsed,
      aiModel: aiModel
    });
    
  } catch (error) {
    console.error('聊天错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log('==========================================');
  console.log('🚀 ClawText PDF Upload Server 正在运行');
  console.log(`📡 地址：http://localhost:${PORT}`);
  console.log(`📂 数据库：${DB_PATH}`);
  console.log('==========================================');
  console.log('✨ 增强功能：');
  console.log('  • AI 智能分析 - 大模型直接理解问题并提取答案');
  console.log('  • 精准引用 - 自动标注段落号（§）和文档来源');
  console.log('  • 法院评论识别 - 专门优化识别法院/审裁处意见');
  console.log('==========================================');
  console.log('API 端点:');
  console.log('  GET  /api/hello          - 获取服务信息');
  console.log('  POST /api/upload-pdf     - 上传 PDF 文件（自动分块）');
  console.log('  GET  /api/pdf-files      - 获取所有 PDF 文件列表');
  console.log('  GET  /api/documents      - 获取文档列表（精简版）');
  console.log('  DELETE /api/pdf-files/:id - 删除 PDF 文件');
  console.log('  POST /api/chat           - 智能问答（加权检索 + 文档过滤）');
  console.log('  POST /api/extract-all-content - 重新提取内容（带分块）');
  console.log('==========================================');
});

module.exports = app;
