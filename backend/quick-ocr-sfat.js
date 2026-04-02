// 快速 OCR 提取 SFAT 2021-5 前几页
const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');
const poppler = require('pdf-poppler');

const DB_PATH = path.join(__dirname, 'pdf_database.json');
const PDF_DIR = path.join(__dirname, 'pdf_files');
const TEMP_DIR = path.join(__dirname, 'temp_quick_ocr');

async function quickOCR() {
  console.log('🚀 快速 OCR 提取 SFAT 2021-5 前 10 页...\n');
  
  // 找到文档
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const doc = db.files.find(f => f.originalName.includes('SFAT 2021-5'));
  
  if (!doc) {
    console.log('❌ 未找到文档');
    return;
  }
  
  const pdfPath = path.join(PDF_DIR, doc.fileName);
  console.log('📄 文档:', doc.originalName);
  console.log('📁 路径:', pdfPath);
  
  // 创建临时目录
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  
  // 转换 PDF 为图片 (低 DPI 加快速度)
  console.log('\n⏳ 转换 PDF 为图片 (150 DPI)...');
  
  const opts = {
    format: 'png',
    out_dir: TEMP_DIR,
    out_prefix: 'page',
    scale: 300,  // 使用更高 DPI
    first_page: 1,
    last_page: 10  // 转换前 10 页
  };
  
  try {
    const result = await poppler.convert(pdfPath, opts);
    console.log('✅ 转换完成');
    
    // 列出图片
    const files = fs.readdirSync(TEMP_DIR)
      .filter(f => f.endsWith('.png'))
      .sort();
    
    console.log(`📊 生成 ${files.length} 张图片`);
    
    if (files.length === 0) {
      console.log('❌ 未生成图片');
      return;
    }
    
    // 初始化 OCR
    console.log('\n🚀 初始化 Tesseract OCR...');
    const worker = await createWorker('eng');
    
    let allText = '';
    
    // OCR 每张图片
    for (let i = 0; i < Math.min(files.length, 10); i++) {
      const file = files[i];
      const imgPath = path.join(TEMP_DIR, file);
      
      console.log(`📄 处理 ${i + 1}/${Math.min(files.length, 10)}: ${file}`);
      
      const { data: { text } } = await worker.recognize(imgPath);
      allText += text + '\n\n';
      
      console.log(`   提取 ${text.length} 字符`);
    }
    
    await worker.terminate();
    
    console.log(`\n✅ OCR 完成！总字符数：${allText.length}`);
    
    // 更新数据库
    doc.content = allText;
    
    // 创建分块
    const chunks = [];
    const paragraphs = allText.split(/\n\s*\n/).filter(p => p.trim().length > 50);
    
    let currentChunk = '';
    let chunkIndex = 0;
    const CHUNK_SIZE = 2000;
    
    for (const para of paragraphs) {
      if (currentChunk.length + para.length > CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push({
          chunkIndex: chunkIndex++,
          content: currentChunk.trim()
        });
        currentChunk = '';
      }
      currentChunk += para + '\n\n';
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push({
        chunkIndex: chunkIndex++,
        content: currentChunk.trim()
      });
    }
    
    doc.chunks = chunks;
    doc.chunkCount = chunks.length;
    doc.ocrProcessed = true;
    
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    
    console.log('✅ 数据库已更新');
    
    // 验证关键词
    console.log('\n🔍 验证关键词:');
    const keywords = ['section 194', 'fit and proper', 'and/or', 'disciplinary', 'route', 'unacceptable'];
    keywords.forEach(kw => {
      const found = allText.toLowerCase().includes(kw.toLowerCase());
      console.log(`   ${found ? '✅' : '❌'} "${kw}": ${found ? '找到' : '未找到'}`);
    });
    
    // 显示预览
    console.log('\n📝 内容预览 (前 1500 字符):');
    console.log('-'.repeat(60));
    console.log(allText.substring(0, 1500));
    console.log('-'.repeat(60));
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack?.split('\n')[1]);
  }
}

quickOCR();
