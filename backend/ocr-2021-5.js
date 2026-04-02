const fs = require('fs');
const path = require('path');
const { extractTextWithOCR } = require('./ocr-extract');

const db = JSON.parse(fs.readFileSync('pdf_database.json', 'utf8'));
const doc = db.files.find(f => f.originalName.includes('2021-5'));

if (!doc) {
  console.error('❌ Document not found!');
  process.exit(1);
}

const fullPath = path.join(__dirname, doc.filePath);
console.log('📄 OCR Processing:', doc.originalName);
console.log('📁 Path:', fullPath);

(async () => {
  try {
    console.log('🔍 Running OCR on all pages...');
    const ocrText = await extractTextWithOCR(fullPath, doc.originalName);
    
    console.log('📊 OCR Result:', ocrText.length, 'characters');
    
    if (ocrText.length > 0) {
      // 更新数据库
      doc.content = ocrText;
      doc.contentLen = ocrText.length;
      doc.hasContent = true;
      doc.hasPreview = true;
      doc.previewLen = Math.min(300, ocrText.length);
      doc.preview = ocrText.substring(0, 300);
      
      // 创建分块（每 2000 字符一个分块）
      const CHUNK_SIZE = 2000;
      const chunks = [];
      for (let i = 0; i < ocrText.length; i += CHUNK_SIZE) {
        chunks.push({
          content: ocrText.substring(i, i + CHUNK_SIZE),
          chunkIndex: chunks.length,
          startChar: i,
          endChar: Math.min(i + CHUNK_SIZE, ocrText.length)
        });
      }
      doc.chunks = chunks;
      
      console.log('📦 Chunks created:', chunks.length);
      
      // 保存数据库
      fs.writeFileSync('pdf_database.json', JSON.stringify(db, null, 2));
      console.log('✅ Database updated!');
      
      // 显示预览
      console.log('\n📖 Preview (first 600 chars):');
      console.log(ocrText.substring(0, 600));
    } else {
      console.error('❌ OCR returned empty text!');
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
