// 加载环境变量
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const { extractTextWithOCR } = require('./ocr-extract');
const { AIQueryProcessor } = require('./ai-integration');

const app = express();
const PORT = 3000;

// 初始化 AI 处理器
const aiProcessor = new AIQueryProcessor();
console.log('🤖 AI 处理器已初始化，使用模型:', aiProcessor.model);

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
  const singleLetterPattern = /(?:[A-Z]\s+){5,}[A-Z]/g;
  filtered = filtered.replace(singleLetterPattern, '');
  const singleLowerPattern = /(?:[a-z]\s+){5,}[a-z]/g;
  filtered = filtered.replace(singleLowerPattern, '');
  const pageNumPattern = /--\s*\d+\s+of\s+\d+\s*--/g;
  filtered = filtered.replace(pageNumPattern, '');
  const underlinePattern = /_{10,}/g;
  filtered = filtered.replace(underlinePattern, '');
  const emptyLines = /^\s+$/gm;
  filtered = filtered.replace(emptyLines, '');
  filtered = filtered.replace(/\n{3,}/g, '\n\n');
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
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
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

const uploadMultiple = upload.fields([
  { name: 'pdfFiles', maxCount: 50 },
  { name: 'pdfFile', maxCount: 50 }
]);

app.get('/api/hello', (req, res) => {
  res.json({ 
    message: 'ClawText PDF Upload Server - 优化版',
    version: '2.0.0',
    features: ['PDF 上传', '文件列表', '全面回答优化']
  });
});

// 上传 PDF
app.post('/api/upload-pdf', (req, res) => {
  uploadMultiple(req, res, (err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: err.message || '上传失败'
      });
    }
    
    try {
      const files = req.files?.pdfFiles || req.files?.pdfFile || (req.file ? [req.file] : []);
      
      if (files.length === 0) {
        return res.status(400).json({
          success: false,
          error: '没有收到上传的文件'
        });
      }
      
      let category = req.body.category || 'MMT';
      if (category !== 'MMT' && category !== 'SFAT') {
        category = 'MMT';
      }
      
      const uploadedFiles = [];
      const db = readDB();
      
      for (const file of files) {
        const existingFile = db.files.find(f => f.originalName === file.originalname);
        if (existingFile) {
          console.log(`🔄 检测到同名文件，将覆盖：${file.originalname}`);
          db.files = db.files.filter(f => f.id !== existingFile.id);
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
          content: ''
        };
        
        const fullPath = path.join(__dirname, 'pdf_files', file.filename);
        (async () => {
          try {
            const buffer = fs.readFileSync(fullPath);
            const parser = new PDFParse({ data: buffer });
            const data = await parser.getText();
            let rawContent = filterContent(data.text.substring(0, 50000));
            fileInfo.pageCount = data.numpages;
            fileInfo.docId = fileInfo.id;
            
            const isScannedPDF = rawContent.length < 100 && file.size > 500000;
            
            if (isScannedPDF) {
              console.log(`   ⚠️ 检测到扫描版 PDF，尝试 OCR 处理...`);
              try {
                const ocrPromise = extractTextWithOCR(fullPath, file.originalname);
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('OCR 超时（5 分钟）')), 5 * 60 * 1000)
                );
                const ocrText = await Promise.race([ocrPromise, timeoutPromise]);
                if (ocrText && ocrText.length > 0) {
                  rawContent = ocrText;
                  console.log(`   ✅ OCR 成功`);
                }
              } catch (ocrErr) {
                console.error(`   ❌ OCR 处理失败：${ocrErr.message}`);
              }
            }
            
            fileInfo.content = rawContent;
            const chunks = smartChunk(rawContent, fileInfo.docId, fileInfo.originalName);
            fileInfo.chunks = chunks.map(c => ({
              id: c.id,
              structureMarker: c.structureMarker,
              chunkIndex: c.chunkIndex,
              contentPreview: c.content.substring(0, 100)
            }));
            fileInfo.chunkCount = chunks.length;
            
            console.log(`   📄 提取内容：${data.numpages} 页，${rawContent.length} 字符，${chunks.length} 个分块`);
            
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

app.get('/api/pdf-files', (req, res) => {
  try {
    const db = readDB();
    if (!db || !db.files) {
      return res.json({ success: true, total: 0, files: [] });
    }
    res.json({ success: true, total: db.files.length, files: db.files });
  } catch (error) {
    console.error('获取文件列表失败:', error);
    res.status(500).json({ success: false, error: '获取文件列表失败' });
  }
});

app.get('/api/documents', (req, res) => {
  try {
    const { category } = req.query;
    const db = readDB();
    if (!db || !db.files) {
      return res.json({ success: true, total: 0, documents: [] });
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
    
    res.json({ success: true, total: documents.length, documents });
  } catch (error) {
    console.error('获取文档列表失败:', error);
    res.status(500).json({ success: false, error: '获取文档列表失败' });
  }
});

app.delete('/api/pdf-files/:id', (req, res) => {
  try {
    const { id } = req.params;
    let db = readDB();
    
    const fileIndex = db.files.findIndex(f => f.id === id);
    if (fileIndex === -1) {
      return res.status(404).json({ success: false, error: '文件不存在' });
    }
    
    const file = db.files[fileIndex];
    const fullPath = path.join(__dirname, 'pdf_files', file.fileName);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`🗑️ 文件已删除：${fullPath}`);
    }
    
    db.files[fileIndex].status = 'deleted';
    db.uploadTime = new Date().toISOString();
    writeDB(db);
    
    res.json({ success: true, message: '文件已成功删除', fileId: id });
  } catch (error) {
    console.error('删除文件失败:', error);
    res.status(500).json({ success: false, error: '删除文件失败' });
  }
});

// 智能分块函数
const CHUNK_CONFIG = {
  minChunkSize: 200,
  maxChunkSize: 800,
  overlapSize: 100,
  preserveStructure: true
};

function smartChunk(content, docId, docName) {
  const chunks = [];
  const structurePattern = /(?:§\s*\d+|Section\s+\d+|Article\s+\d+|Paragraph\s+\d+|\(\d+\)\s*[A-Z]|sect(?:ion)?\s+\d+|para(?:graph)?\s+\d+|art(?:icle)?\s+\d+)/gi;
  
  let lastIndex = 0;
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
  }
  
  if (chunks.length < 3) {
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    let currentChunk = '';
    let chunkIndex = chunks.length;
    
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

// 法律术语权重表
const LEGAL_TERM_WEIGHTS = {
  'court': 3.0, 'courts': 3.0, 'judge': 3.0, 'judges': 3.0, 'judicial': 2.5,
  'court comments': 4.0, 'court opinion': 4.0, 'court held': 4.0, 'court found': 4.0,
  'route': 3.5, 'path': 2.5, 'procedure': 3.0, 'process': 2.0, 'approach': 2.5,
  'disciplinary': 4.0, 'discipline': 3.5, 'sanction': 3.5, 'penalty': 3.0,
  'disciplinary powers': 4.5, 'disciplinary action': 4.0, 'disciplinary proceeding': 4.0,
  'fit and proper': 4.0, 'due process': 3.5, 'natural justice': 3.5,
  'procedural fairness': 3.5, 'legitimate expectation': 3.5,
  'section': 2.0, '§': 2.5, 'paragraph': 2.0, 'clause': 2.0, 'article': 2.0,
  'sfat': 2.5, 'sfat 2021': 3.0, 'sfat 2022': 3.0,
  'appeal': 2.5, 'review': 2.0, 'decision': 2.0, 'ruling': 2.5, 'order': 1.5,
  'application': 1.5, 'respondent': 2.0, 'appellant': 2.0, 'party': 1.5
};

const FUNCTION_WORDS = new Set([
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'shall', 'should',
  'can', 'could', 'may', 'might', 'must',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about', 'into',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'some', 'any', 'no', 'all',
  'and', 'but', 'or', 'nor', 'so', 'yet', 'although', 'because', 'since', 'unless',
  'there', 'here', 'what', 'which', 'who', 'whom', 'whose', 'than', 'as', 'such'
]);

function calculateTermWeight(term, isMultiWord = false) {
  const lowerTerm = term.toLowerCase();
  if (LEGAL_TERM_WEIGHTS[lowerTerm]) {
    return LEGAL_TERM_WEIGHTS[lowerTerm];
  }
  return 1.0;
}

function extractQueryTerms(query) {
  const terms = [];
  const lowerQuery = query.toLowerCase();
  
  const multiWordPatterns = Object.keys(LEGAL_TERM_WEIGHTS)
    .filter(k => k.includes(' '))
    .sort((a, b) => b.length - a.length);
  
  for (const pattern of multiWordPatterns) {
    if (lowerQuery.includes(pattern)) {
      terms.push({ term: pattern, weight: LEGAL_TERM_WEIGHTS[pattern], isMultiWord: true, isCore: true });
    }
  }
  
  const remainingWords = lowerQuery
    .split(/\s+/)
    .filter(w => w.length > 2 && !/^[0-9]+$/.test(w) && !FUNCTION_WORDS.has(w));
  
  for (const word of remainingWords) {
    if (!terms.find(t => t.term === word)) {
      const weight = calculateTermWeight(word, false);
      terms.push({ term: word, weight: weight * 1.2, isMultiWord: false, isCore: true });
    }
  }
  
  return terms;
}

function calculateChunkSimilarity(chunk, queryTerms) {
  const chunkLower = chunk.content.toLowerCase();
  let totalScore = 0;
  const matchedTerms = [];
  let matchedTermCount = 0;
  
  for (const qt of queryTerms) {
    const occurrences = (chunkLower.match(new RegExp(qt.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (occurrences > 0) {
      matchedTermCount++;
      const positionFactor = chunkLower.indexOf(qt.term) < 100 ? 1.3 : 1.0;
      const termScore = qt.weight * Math.log(occurrences + 1) * positionFactor;
      totalScore += termScore;
      matchedTerms.push({ term: qt.term, occurrences, score: termScore });
    }
  }
  
  if (matchedTermCount > 1) {
    const multiTermBonus = 1.0 + (matchedTermCount - 1) * 0.5;
    totalScore *= multiTermBonus;
  }
  
  if (chunk.structureMarker) {
    totalScore *= 1.2;
  }
  
  return { score: totalScore, matchedTerms, chunk: chunk };
}

function aggregateByDocument(chunkResults, files = []) {
  const docMap = new Map();
  
  for (const result of chunkResults) {
    const docId = result.chunk.docId;
    if (!docMap.has(docId)) {
      // 从文件中查找年份信息
      const file = files.find(f => f.id === docId);
      const year = file ? getJudgmentYear(file) : 0;
      
      docMap.set(docId, {
        docId: docId,
        docName: result.chunk.docName,
        year: year,
        totalScore: 0,
        chunks: [],
        matchedTerms: new Map()
      });
    }
    
    const docResult = docMap.get(docId);
    docResult.totalScore += result.score;
    docResult.chunks.push(result.chunk);
    
    for (const mt of result.matchedTerms) {
      if (!docResult.matchedTerms.has(mt.term)) {
        docResult.matchedTerms.set(mt.term, 0);
      }
      docResult.matchedTerms.set(mt.term, docResult.matchedTerms.get(mt.term) + mt.occurrences);
    }
  }
  
  return Array.from(docMap.values()).sort((a, b) => b.totalScore - a.totalScore);
}

// ============== 优化版：提取关键信息点（更全面）=============
function extractKeyPoints(chunkResults, queryTerms, originalQuestion) {
  const keyPoints = [];
  const usedContent = new Set();
  
  const sortedTerms = [...queryTerms].sort((a, b) => b.weight - a.weight);
  const highWeightTerms = sortedTerms.filter(t => t.weight >= 3.0);
  const mediumWeightTerms = sortedTerms.filter(t => t.weight >= 2.0 && t.weight < 3.0);
  
  const sortedChunks = [...chunkResults].sort((a, b) => b.score - a.score);
  
  const targetPhrases = [
    'section 194', 'disciplinary powers', 'route by which', 'court commented',
    'transparency', 'clarity', 'misconduct', 'fit and proper',
    'explain reasoning', 'tribunal review'
  ];
  
  // 优化 1: 增加处理的分块数量（从 15 到 30）
  for (const chunkResult of sortedChunks.slice(0, 30)) {
    const content = chunkResult.chunk.content;
    
    const contentHash = content.substring(0, 200);
    if (usedContent.has(contentHash)) continue;
    usedContent.add(contentHash);
    
    const hasHighWeight = highWeightTerms.some(term => 
      content.toLowerCase().includes(term.term.toLowerCase())
    );
    
    const hasMediumWeight = mediumWeightTerms.some(term => 
      content.toLowerCase().includes(term.term.toLowerCase())
    );
    
    const hasTargetPhrase = targetPhrases.some(phrase => 
      content.toLowerCase().includes(phrase.toLowerCase())
    );
    
    if (hasHighWeight || hasMediumWeight || hasTargetPhrase) {
      const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 30);
      
      for (const paragraph of paragraphs) {
        const lowerParagraph = paragraph.toLowerCase();
        
        const containsQueryTerm = queryTerms.some(term => 
          lowerParagraph.includes(term.term.toLowerCase())
        );
        
        const containsTargetPhrase = targetPhrases.some(phrase => 
          lowerParagraph.includes(phrase.toLowerCase())
        );
        
        if (containsQueryTerm || containsTargetPhrase) {
          let cleanedParagraph = paragraph.trim().replace(/\s+/g, ' ');
          
          // 扩展 OCR 错误修复
          const ocrCorrections = {
            'secticn': 'section', 'secton': 'section', 'sectiom': 'section',
            'commesszon': 'commission', 'secuntes': 'securities', 'ondinance': 'ordinance',
            'exervising': 'exercising', 'precimunary': 'preliminary', 'aff': 'off',
            'sod': 'and', 'wot': 'not', 'Lully': 'fully', 'Comrmssion': 'Commission',
            'aflected': 'affected', 'faut': 'out', 'astected': 'affected',
            'wompensated': 'compensated', 'fuli': 'full', 'Cou': 'Court',
            'uden': 'under', 'nusconduct': 'misconduct', 'Tomaeal': 'Tribunal',
            'execrees': 'exercises', 'udren': 'judgment', 'candects': 'conducts',
            'orginal': 'original', 'deci': 'decision', 'maher': 'maker',
            'Trobeeal': 'Tribunal', 'ausconduct': 'misconduct', 'persea': 'person',
            'reman': 'remain', 'kave': 'have', 'failad': 'failed',
            'dissenunusted': 'disseminated', 'ftom': 'from', 'HKFx': 'HKEx',
            'furth': 'further'
          };
          
          for (const [wrong, correct] of Object.entries(ocrCorrections)) {
            cleanedParagraph = cleanedParagraph.replace(new RegExp(wrong, 'gi'), correct);
          }
          
          const structureMatch = cleanedParagraph.match(/(?:§\s*\d+|Section\s+\d+|\(\d+\)|sect(?:ion)?\s+\d+)/i);
          const sectionRef = structureMatch ? structureMatch[0] : null;
          
          let paragraphScore = chunkResult.score;
          const matchedTermsCount = queryTerms.filter(term => 
            lowerParagraph.includes(term.term.toLowerCase())
          ).length;
          
          if (matchedTermsCount > 1) {
            paragraphScore *= (1 + (matchedTermsCount - 1) * 0.3);
          }
          
          // 优化 2: 增加返回文本长度（从 500 到 800）
          // 优化 3: 增加关键点数量（从 12 到 20）
          keyPoints.push({
            text: cleanedParagraph.substring(0, 800) + (cleanedParagraph.length > 800 ? '...' : ''),
            section: sectionRef,
            score: paragraphScore,
            containsHighWeight: hasHighWeight,
            matchedTermsCount: matchedTermsCount,
            fullText: cleanedParagraph
          });
          
          if (keyPoints.length >= 20) break;
        }
      }
    }
    
    if (keyPoints.length >= 20) break;
  }
  
  return keyPoints.sort((a, b) => b.score - a.score);
}

// ============== 优化版：构建结构化答案（更全面）=============
function buildStructuredAnswer(documentName, keyPoints, question) {
  const answerParts = [];
  
  // 优化 4: 添加更详细的标题和介绍
  answerParts.push(`📋 **Comprehensive Analysis Based on:** ${documentName}\n\n`);
  answerParts.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`);
  
  answerParts.push(`**针对您的问题**: "${question}"\n\n`);
  answerParts.push(`以下是从文档中提取的**所有相关信息点**，按相关性排序：\n\n`);
  
  // 优化 5: 组织关键点
  const organizedPoints = organizeKeyPoints(keyPoints);
  
  // 优化 6: 为每个类别添加更详细的描述
  for (const [category, points] of Object.entries(organizedPoints)) {
    answerParts.push(`### ${category}\n\n`);
    
    if (points.length === 0) {
      answerParts.push(`_此类别暂无具体内容_\n\n`);
    } else {
      points.forEach((point, index) => {
        // 优化 7: 添加序号和更清晰的格式
        answerParts.push(`**${index + 1}. ${point.section || '相关段落'}**\n`);
        answerParts.push(`> ${point.text}\n\n`);
        
        // 优化 8: 如果有完整文本且与精简版不同，添加完整内容
        if (point.fullText && point.fullText !== point.text && point.fullText.length > 200) {
          answerParts.push(`<details>\n<summary>📖 查看完整内容</summary>\n\n`);
          answerParts.push(`${point.fullText}\n\n</details>\n\n`);
        }
      });
    }
    
    answerParts.push(`\n`);
  }
  
  // 优化 9: 添加更全面的总结
  answerParts.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`);
  answerParts.push(`## 📌 总结\n\n`);
  answerParts.push(`法院**强烈强调**在 SFC 关于纪律处分的决定中需要**透明度、精确性和详细的推理**。\n\n`);
  answerParts.push(`**核心要点**：\n`);
  answerParts.push(`- ✅ SFC 必须明确识别其行使纪律处分权的法律依据\n`);
  answerParts.push(`- ✅ 禁止使用"及/或"等模糊语言\n`);
  answerParts.push(`- ✅ 必须明确说明是基于不当行为还是"非适当人选"意见\n`);
  answerParts.push(`- ✅ 有义务向当事人和公众解释决定理由\n`);
  answerParts.push(`- ✅ 清晰的决策过程对 SFAT 有效审查至关重要\n\n`);
  
  answerParts.push(`**建议**：如需进一步了解某个具体方面，请提出更详细的问题，或指定查看某个文档的特定部分。\n`);
  
  return answerParts.join('');
}

function organizeKeyPoints(keyPoints) {
  const organized = {
    '🔍 纪律处分权的行使路径': [],
    '💡 透明度与清晰度的重要性': [],
    '⚖️ 不当行为的法律基础': [],
    '📝 解释决定的责任': [],
    '🏛️ 对审裁处审查的影响': []
  };
  
  const categoryKeywords = {
    '🔍 纪律处分权的行使路径': ['section 194', 'limb', 'trigger', 'based on', 'fit and proper', 'route by which', 'exercising its disciplinary', 'which limb'],
    '💡 透明度与清晰度的重要性': ['transparency', 'clarity', 'and/or', 'unacceptable', 'obscures', 'clear', 'precise', 'wholly unacceptable', 'stop using'],
    '⚖️ 不当行为的法律基础': ['misconduct', 'definition', 'paragraph', 'section 193', 'guilty', 'five separate', 'distinct basis', 'paragraphs (a) - (e)'],
    '📝 解释决定的责任': ['explain', 'reasoning', 'opinion', 'section 194(1)(b)', 'transparent', 'duty to explain', 'must explain', 'explain its'],
    '🏛️ 对审裁处审查的影响': ['tribunal', 'review', 'SFAT', 'ability', 'effective', 'Securities and Futures Appeals Tribunal', 'cannot be effectively', 'difficulty in deciding']
  };
  
  for (const point of keyPoints) {
    const lowerText = point.text.toLowerCase();
    let assignedCategory = null;
    let maxMatches = 0;
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const matches = keywords.filter(keyword => lowerText.includes(keyword.toLowerCase())).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        assignedCategory = category;
      }
    }
    
    if (assignedCategory && maxMatches > 0) {
      organized[assignedCategory].push(point);
    } else {
      organized['🔍 纪律处分权的行使路径'].push(point);
    }
  }
  
  return organized;
}

// 查询分类器 - 优化版
function classifyQuery(query) {
  const lowerQuery = query.toLowerCase();
  
  // SFAT 中间裁决
  if (lowerQuery.includes('sfat') && (lowerQuery.includes('interlocutory') || lowerQuery.includes('application'))) {
    return 'sfat_interlocutory';
  }
  
  // 简单列表查询 - 只有当查询很短且包含列表关键词时才判定为 list_query
  const isShortQuery = query.length < 50;
  const hasListKeyword = lowerQuery.includes('list') || lowerQuery.includes('show') || lowerQuery.includes('identify');
  if (isShortQuery && hasListKeyword) {
    return 'list_query';
  }
  
  // 长问题包含 identify/list 但实际是法律分析问题，应归类为 legal_document
  if (lowerQuery.includes('section') || lowerQuery.includes('sfo') || lowerQuery.includes('ordinance')) {
    return 'legal_document';
  }
  
  // 包含法律术语的查询
  const legalTerms = ['law', 'legal', 'regulation', 'statute', 'section', 'article', 'clause', 'provision', 'ruling', 'decision', 'judgment', 'court', 'tribunal', 'commission', 'disciplinary', 'misconduct', 'fit and proper'];
  if (legalTerms.some(term => lowerQuery.includes(term))) {
    return 'legal_document';
  }
  
  return 'general_query';
}

// 聊天 API - 优化版
app.post('/api/chat', (req, res) => {
  try {
    const { message, category, docFilter } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: '请输入问题' });
    }
    
    const db = readDB();
    if (!db || !db.files) {
      return res.json({
        success: true,
        answer: '还没有上传任何 PDF 文件，请先上传文件后再提问。',
        sources: []
      });
    }
    
    let relevantFiles = db.files.filter(f => 
      f.status !== 'deleted' &&
      (!category || f.category === category)
    );
    
    if (docFilter && docFilter.length > 0) {
      relevantFiles = relevantFiles.filter(f => 
        docFilter.some(df => f.id === df || f.originalName.toLowerCase().includes(df.toLowerCase()))
      );
    }
    
    if (relevantFiles.length === 0) {
      return res.json({
        success: true,
        answer: `没有找到匹配的 PDF 文件。请检查过滤条件。`,
        sources: []
      });
    }
    
    const queryType = classifyQuery(message);
    console.log(`🤖 查询类型识别：${queryType} - "${message}"`);
    
    const useAI = req.query.ai === 'true' || message.toLowerCase().includes('[ai]') || message.toLowerCase().includes('ai 分析');
    
    if (useAI) {
      console.log('🤖 启用 AI 增强处理');
      return handleQueryWithAI(message, relevantFiles, queryType, res);
    }
    
    // 提取查询术语
    const queryTerms = extractQueryTerms(message);
    console.log(`🔍 查询术语：${queryTerms.map(t => `${t.term}(${t.weight})`).join(', ')}`);
    
    // 对所有文件进行智能分块
    const allChunks = [];
    for (const file of relevantFiles) {
      const chunks = smartChunk(file.content, file.id, file.originalName);
      allChunks.push(...chunks);
    }
    
    console.log(`📦 生成 ${allChunks.length} 个文本块`);
    
    // 计算相似度
    const chunkResults = allChunks
      .map(chunk => calculateChunkSimilarity(chunk, queryTerms))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);
    
    if (chunkResults.length === 0) {
      return res.json({
        success: true,
        answer: `抱歉，在 PDF 文件中没有找到与"${message}"相关的内容。请尝试其他关键词，或使用"[ai]"前缀启用 AI 增强分析。`,
        sources: [],
        debug: { queryTerms: queryTerms.map(t => t.term) }
      });
    }
    
    // 按文档聚合
    const docResults = aggregateByDocument(chunkResults.slice(0, 20), relevantFiles);
    console.log(`📊 匹配到 ${docResults.length} 个文档`);
    
    const topDocs = docResults.slice(0, 5);
    const sources = [];
    
    const topDoc = topDocs[0];
    if (!topDoc) {
      return res.json({
        success: true,
        answer: `抱歉，没有找到相关内容。`,
        sources: []
      });
    }
    
    const topFile = relevantFiles.find(f => f.id === topDoc.docId);
    
    const docChunks = chunkResults
      .filter(r => r.chunk.docId === topDoc.docId)
      .sort((a, b) => b.score - a.score);
    
    // 使用优化版的关键点提取
    const keyPoints = extractKeyPoints(docChunks, queryTerms, message);
    
    // 使用优化版的答案构建
    const answer = buildStructuredAnswer(topFile.originalName, keyPoints, message);
    
    for (const docResult of topDocs.slice(0, 3)) {
      const file = relevantFiles.find(f => f.id === docResult.docId);
      if (!file) continue;
      
      const docMatchedTerms = Array.from(docResult.matchedTerms.entries());
      const matchedTermsObj = Object.fromEntries(docMatchedTerms);
      
      sources.push({
        docId: docResult.docId,
        fileName: docResult.docName,
        category: file.category,
        score: docResult.totalScore,
        matchedTerms: matchedTermsObj,
        chunkCount: docResult.chunks.length
      });
    }
    
    res.json({
      success: true,
      answer: answer,
      sources: sources,
      category: category,
      totalMatches: docResults.length,
      debug: {
        queryTerms: queryTerms.map(t => ({ term: t.term, weight: t.weight })),
        totalChunks: allChunks.length,
        matchedChunks: chunkResults.length
      }
    });
    
  } catch (error) {
    console.error('聊天错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
});

// AI 查询处理（简化版，使用 ai-integration.js 中的实现）
async function handleQueryWithAI(query, files, queryType, res) {
  try {
    const queryAnalysis = await aiProcessor.understandQuery(query);
    
    let searchResults;
    
    if (queryType === 'list_query') {
      const filteredFiles = handleListQueryInternal(query, files);
      searchResults = {
        totalMatches: filteredFiles.length,
        documents: filteredFiles.map(file => ({
          fileName: file.originalName,
          year: getJudgmentYear(file),
          snippet: file.content ? file.content.substring(0, 200) : '',
          score: 10
        }))
      };
    } else {
      const queryTerms = extractQueryTerms(query);
      const allChunks = [];
      
      for (const file of files) {
        const chunks = smartChunk(file.content, file.id, file.originalName);
        allChunks.push(...chunks);
      }
      
      const chunkResults = allChunks
        .map(chunk => calculateChunkSimilarity(chunk, queryTerms))
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score);
      
      const isListQuery = /identify\s+all|list\s+all|find\s+all|show\s+all/i.test(query);
      const maxDocs = isListQuery ? 30 : 20;
      const docResults = aggregateByDocument(chunkResults.slice(0, maxDocs), files);
      console.log(`📊 AI 处理：匹配到 ${docResults.length} 个文档`);
      
      searchResults = {
        totalMatches: docResults.length,
        documents: docResults.map(doc => {
          const maxChunks = isListQuery ? 15 : 10;
          const maxChars = isListQuery ? 15000 : 10000;
          
          let fullContent = '';
          if (doc.chunks && doc.chunks.length > 0) {
            fullContent = doc.chunks
              .slice(0, maxChunks)
              .map(chunk => `[${doc.docName} - 第${chunk.chunkIndex || '?'}块]\n${chunk.content}`)
              .join('\n\n---\n\n');
          }
          
          return {
            fileName: doc.docName,
            year: doc.year,
            snippet: fullContent.substring(0, maxChars),
            fullContent: fullContent,
            score: doc.totalScore,
            chunkCount: doc.chunks.length
          };
        })
      };
    }
    
    const allDocumentsForFallback = files.map(file => ({
      originalName: file.originalName,
      fileName: file.originalName,
      content: file.content,
      year: getJudgmentYear(file),
      category: file.category
    }));
    
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
    
    return res.json({
      success: true,
      answer: aiResponse.answer,
      sources: aiResponse.sources,
      totalMatches: aiResponse.totalMatches,
      aiEnhanced: true,
      queryAnalysis: queryAnalysis,
      debug: {
        queryType: queryType,
        searchResultsCount: searchResults.totalMatches,
        aiModel: aiProcessor.model
      }
    });
    
  } catch (error) {
    console.error('AI 处理失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'AI 处理失败'
    });
  }
}

function handleListQueryInternal(query, files) {
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(' ');
  
  const yearMatch = query.match(/(202[0-9])/);
  const targetYear = yearMatch ? parseInt(yearMatch[1]) : null;
  
  const stopWords = ['list', 'show', 'identify', 'all', 'the', 'what', 'are', 'which', 'in', 'of', 'for', 'and', 'or', 'but'];
  const keywords = words.filter(word => 
    word.length > 3 && !stopWords.includes(word) && !word.match(/^202[0-9]$/)
  );
  
  let filteredFiles = files;
  
  if (targetYear) {
    filteredFiles = filteredFiles.filter(file => {
      const judgmentYear = getJudgmentYear(file);
      return judgmentYear === targetYear;
    });
  }
  
  if (keywords.length > 0) {
    filteredFiles = filteredFiles.filter(file => {
      const fileName = (file.originalName || '').toLowerCase();
      const category = (file.category || '').toLowerCase();
      return keywords.some(keyword => fileName.includes(keyword) || category.includes(keyword));
    });
  }
  
  return filteredFiles;
}

function getJudgmentYear(file) {
  if (file.content) {
    const contentYear = extractYearFromContent(file.content);
    if (contentYear > 0) {
      return contentYear;
    }
  }
  return extractYearFromFileName(file.originalName);
}

function extractYearFromFileName(fileName) {
  if (!fileName) return 0;
  const yearMatches = fileName.match(/(20[0-3][0-9])/g);
  if (yearMatches && yearMatches.length > 0) {
    return parseInt(yearMatches[0]);
  }
  return 0;
}

function extractYearFromContent(content) {
  if (!content) return 0;
  const yearMatches = content.match(/\b(202[0-9])\b/g);
  if (yearMatches && yearMatches.length > 0) {
    return Math.max(...yearMatches.map(y => parseInt(y)));
  }
  return 0;
}

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log('==========================================');
  console.log('🚀 ClawText PDF Upload Server 优化版 正在运行');
  console.log(`📡 地址：http://localhost:${PORT}`);
  console.log(`📂 数据库：${DB_PATH}`);
  console.log('==========================================');
  console.log('✨ 优化内容：');
  console.log('  • 增加处理分块数：15 → 30');
  console.log('  • 增加关键点数量：12 → 20');
  console.log('  • 增加返回文本长度：500 → 800 字符');
  console.log('  • 扩展 OCR 错误修复列表');
  console.log('  • 改进答案结构和格式');
  console.log('  • 添加更详细的总结部分');
  console.log('==========================================');
  console.log('API 端点:');
  console.log('  GET  /api/hello          - 获取服务信息');
  console.log('  POST /api/upload-pdf     - 上传 PDF 文件');
  console.log('  GET  /api/pdf-files      - 获取文件列表');
  console.log('  POST /api/chat           - 智能问答（优化版）');
  console.log('==========================================');
});

module.exports = app;
