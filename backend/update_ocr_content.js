const fs = require('fs');
const path = require('path');

// 读取数据库
const dbPath = path.join(__dirname, 'pdf_database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// 读取OCR文件
const ocrFilePath = path.join(__dirname, 'pdf_files', '1772531015195-524828469_enhanced_ocr.txt');
const ocrContent = fs.readFileSync(ocrFilePath, 'utf8');

// 清理OCR内容（移除页面标记）
function cleanOCRContent(text) {
  return text
    .replace(/=== Page \d+ ===/g, '')  // 移除页面标记
    .replace(/\n{3,}/g, '\n\n')        // 减少多余空行
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // 清理非ASCII字符
    .replace(/\s+/g, ' ')              // 合并多余空格
    .trim();
}

const cleanedContent = cleanOCRContent(ocrContent);

// 智能分块函数（简化版）
function smartChunk(content, docId, docName) {
  const chunks = [];
  const paragraphs = content.split(/\n\s*\n/);
  
  let chunkIndex = 0;
  for (const para of paragraphs) {
    if (para.trim().length < 10) continue;
    
    // 提取结构标记
    let structureMarker = '';
    const sectionMatch = para.match(/(?:section|paragraph|§|article|clause)\s+(\d+[a-z]?)/i);
    if (sectionMatch) {
      structureMarker = sectionMatch[0];
    }
    
    chunks.push({
      id: `${docId}-chunk-${chunkIndex}`,
      structureMarker,
      chunkIndex,
      content: para.trim()
    });
    chunkIndex++;
  }
  
  return chunks;
}

// 查找并更新文件
let updated = false;
for (const file of db.files) {
  if (file.originalName === 'SFAT 2021-5 Determination (f).pdf') {
    console.log(`找到文件: ${file.originalName}`);
    console.log(`原内容长度: ${file.content?.length || 0} 字符`);
    
    // 更新内容
    file.content = cleanedContent;
    file.contentExtractedAt = new Date().toISOString();
    
    // 生成智能分块
    const chunks = smartChunk(cleanedContent, file.id, file.originalName);
    file.chunks = chunks.map(c => ({
      id: c.id,
      structureMarker: c.structureMarker,
      chunkIndex: c.chunkIndex,
      contentPreview: c.content.substring(0, 100)
    }));
    file.chunkCount = chunks.length;
    
    console.log(`新内容长度: ${file.content.length} 字符`);
    console.log(`生成分块数: ${file.chunkCount}`);
    console.log(`示例分块: ${file.chunks[0]?.contentPreview || '无'}`);
    
    updated = true;
    break;
  }
}

if (updated) {
  // 保存数据库
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  console.log('✅ 数据库已更新！');
} else {
  console.log('❌ 未找到目标文件');
}

// 测试搜索关键词
console.log('\n🔍 测试搜索关键词:');
const testKeywords = ['disciplinary powers', 'route', 'court comments', '2021-5', 'section 194'];
for (const keyword of testKeywords) {
  const regex = new RegExp(keyword, 'gi');
  const matches = cleanedContent.match(regex);
  console.log(`  "${keyword}": ${matches ? matches.length : 0} 次出现`);
}