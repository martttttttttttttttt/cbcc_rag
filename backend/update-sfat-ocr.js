// 使用后端已有的 OCR 功能更新 SFAT 2021-5 文档
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const DB_PATH = path.join(__dirname, 'pdf_database.json');
const PDF_DIR = path.join(__dirname, 'pdf_files');

async function updateSFAT2021_5() {
  console.log('📄 使用 OCR 更新 SFAT 2021-5 文档...\n');
  
  // 读取数据库
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  
  // 找到 SFAT 2021-5 文档
  const doc = db.files.find(f => f.originalName.includes('SFAT 2021-5'));
  
  if (!doc) {
    console.log('❌ 未找到 SFAT 2021-5 文档');
    return;
  }
  
  console.log('📋 文档信息:');
  console.log('   ID:', doc.id);
  console.log('   原名:', doc.originalName);
  console.log('   文件名:', doc.fileName);
  
  const pdfPath = path.join(PDF_DIR, doc.fileName);
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF 文件不存在:', pdfPath);
    return;
  }
  
  const stats = fs.statSync(pdfPath);
  console.log('   文件大小:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
  
  // 检查是否是扫描版（内容短但文件大）
  const isScanned = (!doc.content || doc.content.length < 10000) && stats.size > 500 * 1024;
  
  console.log('   检测扫描版:', isScanned ? '是' : '否');
  
  if (isScanned || process.argv.includes('--force')) {
    console.log('\n⚠️  检测到扫描版 PDF，需要 OCR 处理...');
    console.log('   当前内容长度:', doc.content?.length || 0);
    
    // 调用后端的 OCR 提取接口
    console.log('\n⏳ 调用 OCR 提取...');
    
    try {
      // 使用 pdf-poppler 转换 PDF 为图片，然后用 Tesseract OCR
      const { extractTextWithOCR } = require('./ocr-extract');
      
      const result = await extractTextWithOCR(pdfPath, { 
        dpi: 150,  // 低 DPI 加快速度并减少错误
        imageScale: 1.0,
        sharpen: false,
        threshold: false,
        maxPages: 20  // 只处理前 20 页加快速度
      });
      
      if (result.text && result.text.length > 100) {
        console.log('\n✅ OCR 提取成功!');
        console.log('   提取文本长度:', result.text.length);
        
        // 更新数据库
        doc.content = result.text;
        
        // 创建分块
        const chunks = [];
        const paragraphs = result.text.split(/\n\s*\n/).filter(p => p.trim().length > 50);
        
        const CHUNK_SIZE = 2000;
        let currentChunk = '';
        let chunkIndex = 0;
        
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
        
        console.log('   分块数:', chunks.length);
        
        // 保存数据库
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        
        console.log('\n✅ 数据库已更新!');
        
        // 验证关键词
        console.log('\n🔍 验证关键词:');
        const keywords = ['section 194', 'fit and proper', 'and/or', 'disciplinary', 'route', 'unacceptable'];
        keywords.forEach(kw => {
          const found = result.text.toLowerCase().includes(kw.toLowerCase());
          console.log(`   ${found ? '✅' : '❌'} "${kw}": ${found ? '找到' : '未找到'}`);
        });
        
        // 显示内容预览
        console.log('\n📝 内容预览 (前 1500 字符):');
        console.log('-'.repeat(60));
        console.log(result.text.substring(0, 1500));
        console.log('-'.repeat(60));
        
      } else {
        console.log('❌ OCR 提取的文本太短，可能失败');
      }
      
    } catch (error) {
      console.error('❌ OCR 处理失败:', error.message);
      console.error('   错误详情:', error.stack?.split('\n')[1]);
    }
    
  } else {
    console.log('\n✅ 文档已有内容，无需 OCR');
    console.log('   当前内容长度:', doc.content?.length || 0);
  }
}

updateSFAT2021_5().catch(console.error);
