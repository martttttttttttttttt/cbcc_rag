// 手动调用 OCR 提取
const fs = require('fs');
const path = require('path');
const { extractTextWithOCR } = require('./ocr-extract');

const DB_PATH = path.join(__dirname, 'pdf_database.json');
const PDF_DIR = path.join(__dirname, 'pdf_files');

async function manualOCR() {
  console.log('🔧 手动 OCR 提取 SFAT 2021-5...\n');
  
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const doc = db.files.find(f => f.originalName.includes('SFAT 2021-5'));
  
  if (!doc) {
    console.log('❌ 未找到文档');
    return;
  }
  
  const pdfPath = path.join(PDF_DIR, doc.fileName);
  
  console.log('📄 文档:', doc.originalName);
  console.log('📁 路径:', pdfPath);
  console.log('📊 大小:', (fs.statSync(pdfPath).size / 1024 / 1024).toFixed(2), 'MB');
  
  console.log('\n⏳ 开始 OCR 提取 (这可能需要几分钟)...');
  
  try {
    const text = await extractTextWithOCR(pdfPath, doc.originalName);
    
    console.log('\n✅ OCR 完成!');
    console.log('📊 提取字符数:', text.length);
    
    if (text.length > 100) {
      // 更新数据库
      doc.content = text;
      
      // 创建分块
      const chunks = [];
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 50);
      
      let currentChunk = '';
      let chunkIndex = 0;
      const CHUNK_SIZE = 2000;
      
      for (const para of paragraphs) {
        if (currentChunk.length + para.length > CHUNK_SIZE && currentChunk.length > 0) {
          chunks.push({ chunkIndex: chunkIndex++, content: currentChunk.trim() });
          currentChunk = '';
        }
        currentChunk += para + '\n\n';
      }
      
      if (currentChunk.trim().length > 0) {
        chunks.push({ chunkIndex: chunkIndex++, content: currentChunk.trim() });
      }
      
      doc.chunks = chunks;
      doc.chunkCount = chunks.length;
      doc.ocrProcessed = true;
      
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
      
      console.log('✅ 数据库已更新');
      
      // 验证关键词
      console.log('\n🔍 验证关键词:');
      const keywords = ['section 194', 'fit and proper', 'and/or', 'disciplinary', 'route', 'unacceptable', '193'];
      keywords.forEach(kw => {
        const found = text.toLowerCase().includes(kw.toLowerCase());
        console.log(`   ${found ? '✅' : '❌'} "${kw}": ${found ? '找到' : '未找到'}`);
      });
      
      // 显示预览
      console.log('\n📝 内容预览 (前 2000 字符):');
      console.log('-'.repeat(60));
      console.log(text.substring(0, 2000));
      console.log('-'.repeat(60));
      
    } else {
      console.log('⚠️  提取的文本太短，可能 OCR 失败');
      console.log('内容:', text.substring(0, 500));
    }
    
  } catch (error) {
    console.error('❌ OCR 失败:', error.message);
    console.error(error.stack?.split('\n')[1]);
  }
}

manualOCR();
