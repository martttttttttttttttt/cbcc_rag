const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { extractTextWithOCR } = require('./ocr-extract');

const db = JSON.parse(fs.readFileSync('pdf_database.json', 'utf8'));
const doc = db.files.find(f => f.originalName.includes('2021-5'));

if (!doc) {
  console.error('❌ Document not found!');
  process.exit(1);
}

const fullPath = path.join(__dirname, doc.filePath);
console.log('📄 Reprocessing:', doc.originalName);
console.log('📁 Path:', fullPath);
console.log('📊 File size:', fs.statSync(fullPath).size / 1024 / 1024, 'MB');

(async () => {
  try {
    // 先用 pdf-parse 尝试提取
    console.log('\n📖 Step 1: Trying standard PDF text extraction...');
    const parser = new PDFParse({ data: fs.readFileSync(fullPath) });
    const data = await parser.getText();
    let rawContent = data.text;
    
    console.log('   Extracted:', rawContent.length, 'characters');
    console.log('   Pages:', data.numpages);
    
    // 检测是否为扫描版
    const isScanned = rawContent.length < 100 && fs.statSync(fullPath).size > 500000;
    
    if (isScanned || rawContent.length < 1000) {
      console.log('\n⚠️  Detected scanned PDF (only', rawContent.length, 'chars), running OCR...');
      const ocrText = await extractTextWithOCR(fullPath, doc.originalName);
      
      if (ocrText.length > 0) {
        rawContent = ocrText;
        console.log('   ✅ OCR success:', rawContent.length, 'characters');
      }
    }
    
    if (rawContent.length > 1000) {
      // 更新数据库
      doc.content = rawContent;
      doc.contentLen = rawContent.length;
      doc.hasContent = true;
      doc.hasPreview = true;
      doc.preview = rawContent.substring(0, 300);
      doc.previewLen = 300;
      
      // 创建分块
      const CHUNK_SIZE = 2000;
      const chunks = [];
      for (let i = 0; i < rawContent.length; i += CHUNK_SIZE) {
        chunks.push({
          content: rawContent.substring(i, i + CHUNK_SIZE),
          chunkIndex: chunks.length,
          startChar: i,
          endChar: Math.min(i + CHUNK_SIZE, rawContent.length)
        });
      }
      doc.chunks = chunks;
      
      console.log('\n📦 Created chunks:', chunks.length);
      
      // 保存数据库
      fs.writeFileSync('pdf_database.json', JSON.stringify(db, null, 2));
      console.log('✅ Database updated!');
      
      // 显示预览
      console.log('\n📖 Content preview (first 1000 chars):');
      console.log(rawContent.substring(0, 1000));
      
      // 搜索关键词
      console.log('\n🔍 Keyword search:');
      const lower = rawContent.toLowerCase();
      console.log('   "route":', (lower.match(/route/g) || []).length);
      console.log('   "disciplinary":', (lower.match(/disciplinary/g) || []).length);
      console.log('   "power":', (lower.match(/power/g) || []).length);
      console.log('   "section 194":', (lower.match(/section\s*194/g) || []).length);
      console.log('   "fit and proper":', (lower.match(/fit\s+and\s+proper/g) || []).length);
    } else {
      console.error('❌ Final content too short:', rawContent.length);
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
