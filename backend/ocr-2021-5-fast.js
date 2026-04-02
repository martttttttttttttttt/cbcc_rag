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
console.log('📄 Fast OCR Processing:', doc.originalName);
console.log('📁 Path:', fullPath);

(async () => {
  try {
    // 使用更快的配置：300 DPI, 简化图像处理
    console.log('🔍 Running fast OCR (300 DPI, optimized)...');
    
    const ocrText = await new Promise((resolve, reject) => {
      const { createWorker } = require('tesseract.js');
      const pdf2pic = require('pdf2pic');
      
      // 转换 PDF 为图片（300 DPI 更快）
      const store = pdf2pic.fromPath(fullPath, {
        density: 300,
        format: 'png',
        width: 1200,
        height: 1600,
        preserveAspectRatio: true
      });
      
      (async () => {
        let fullText = '';
        const worker = await createWorker('eng');
        
        try {
          // 只处理前 50 页（覆盖主要内容）
          const maxPages = Math.min(50, 73);
          console.log(`📄 Processing ${maxPages} pages...`);
          
          for (let i = 0; i < maxPages; i++) {
            try {
              const image = await store(i);
              const { data: { text } } = await worker.recognize(image.path);
              fullText += text + '\n';
              
              if ((i + 1) % 10 === 0) {
                console.log(`   📄 Page ${i + 1}/${maxPages}, text: ${fullText.length} chars`);
              }
            } catch (e) {
              console.log(`   ⚠️ Page ${i + 1} failed: ${e.message}`);
            }
          }
          
          await worker.terminate();
          resolve(fullText);
        } catch (e) {
          await worker.terminate().catch(() => {});
          reject(e);
        }
      })();
    });
    
    console.log('📊 OCR Result:', ocrText.length, 'characters');
    
    if (ocrText.length > 1000) {
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
      console.log('\n📖 Preview (first 800 chars):');
      console.log(ocrText.substring(0, 800));
    } else {
      console.error('❌ OCR returned too little text!');
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
