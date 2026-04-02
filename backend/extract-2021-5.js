const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const db = JSON.parse(fs.readFileSync('pdf_database.json', 'utf8'));
const doc = db.files.find(f => f.originalName.includes('2021-5'));

if (!doc) {
  console.error('Document not found!');
  process.exit(1);
}

const fullPath = path.join(__dirname, doc.filePath);
console.log('📄 Extracting:', doc.originalName);
console.log('📁 Path:', fullPath);
console.log('✅ Exists:', fs.existsSync(fullPath));

(async () => {
  try {
    const buffer = fs.readFileSync(fullPath);
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    console.log('📊 Pages:', data.numpages);
    console.log('📝 Text length:', data.text.length);
    
    // 更新数据库
    doc.content = data.text;
    doc.contentLen = data.text.length;
    doc.hasContent = true;
    doc.hasPreview = true;
    doc.previewLen = Math.min(300, data.text.length);
    doc.preview = data.text.substring(0, 300);
    
    // 创建分块（每 2000 字符一个分块）
    const CHUNK_SIZE = 2000;
    const chunks = [];
    for (let i = 0; i < data.text.length; i += CHUNK_SIZE) {
      chunks.push({
        content: data.text.substring(i, i + CHUNK_SIZE),
        chunkIndex: chunks.length,
        startChar: i,
        endChar: Math.min(i + CHUNK_SIZE, data.text.length)
      });
    }
    doc.chunks = chunks;
    
    console.log('📦 Chunks created:', chunks.length);
    
    // 保存数据库
    fs.writeFileSync('pdf_database.json', JSON.stringify(db, null, 2));
    console.log('✅ Database updated!');
    
    // 显示预览
    console.log('\n📖 Preview (first 500 chars):');
    console.log(data.text.substring(0, 500));
    console.log('✅ Extraction complete!');
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
