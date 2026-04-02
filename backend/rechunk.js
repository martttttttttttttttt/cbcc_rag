const fs = require('fs');
const path = require('path');

// 读取数据库
const dbPath = path.join(__dirname, 'pdf_database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// 智能分块函数（从server.js复制）
const CHUNK_CONFIG = {
  minChunkSize: 200,
  maxChunkSize: 800,
  overlapSize: 100,
  preserveStructure: true
};

function smartChunk(content, docId, docName) {
  const chunks = [];
  
  // 1. 首先按法律文本结构分割（§、Section、Article 等）
  // 增强模式：支持OCR识别错误和大小写变化
  const structurePattern = /(?:§\s*\d+|Section\s+\d+|Article\s+\d+|Paragraph\s+\d+|\(\d+\)\s*[A-Z]|sect(?:ion)?\s+\d+|para(?:graph)?\s+\d+|art(?:icle)?\s+\d+|secticn\s+\d+|secton\s+\d+|sectiom\s+\d+|secti[o0]n\s+\d+)/gi;
  
  let lastIndex = 0;
  const matches = [];
  let match;
  const regex = new RegExp(structurePattern, 'gi');
  
  while ((match = regex.exec(content)) !== null) {
    matches.push({
      index: match.index,
      text: match[0]
    });
  }
  
  if (matches.length > 0) {
    console.log(`📊 找到 ${matches.length} 个结构标记`);
    // 按结构标记分块
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
  
  // 2. 如果没有结构标记或分块太少，按段落分块
  if (chunks.length < 3) {
    console.log(`📝 结构分块不足 (${chunks.length})，使用段落分块`);
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
        // 保留重叠部分
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

// 更新所有文件的分块
let updatedCount = 0;
for (const file of db.files) {
  if (file.content && file.content.length > 0) {
    const oldChunks = file.chunks ? file.chunks.length : 0;
    file.chunks = smartChunk(file.content, file.id, file.originalName);
    const newChunks = file.chunks.length;
    
    if (newChunks !== oldChunks) {
      console.log(`✅ ${file.originalName}: ${oldChunks} → ${newChunks} 个分块`);
      updatedCount++;
    }
  }
}

// 保存数据库
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log(`\n🎉 完成！更新了 ${updatedCount} 个文件的分块`);
console.log(`📁 数据库已保存: ${dbPath}`);