// 重新提取 SFAT 2021-5 文档内容
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const DB_PATH = path.join(__dirname, 'pdf_database.json');
const PDF_DIR = path.join(__dirname, 'pdf_files');

async function extractSFAT2021_5() {
  console.log('📄 重新提取 SFAT 2021-5 文档内容...\n');
  
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
  console.log('   当前内容长度:', doc.content?.length || 0);
  console.log('   当前分块数:', doc.chunks?.length || 0);
  
  const pdfPath = path.join(PDF_DIR, doc.fileName);
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF 文件不存在:', pdfPath);
    return;
  }
  
  console.log('\n⏳ 开始提取 PDF 内容...');
  
  try {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const parser = new PDFParse({ data: pdfBuffer });
    const data = await parser.getText();
    
    console.log('\n✅ 提取成功!');
    console.log('   页数:', data.numpages);
    console.log('   内容长度:', data.text.length);
    
    // 更新数据库
    doc.content = data.text;
    doc.info = data.info;
    doc.metadata = data.metadata;
    doc.version = data.version;
    
    // 创建分块（简单按段落分割）
    const chunks = [];
    const paragraphs = data.text.split(/\n\s*\n/).filter(p => p.trim().length > 50);
    
    const CHUNK_SIZE = 2000; // 每分块约 2000 字符
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (const para of paragraphs) {
      if (currentChunk.length + para.length > CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push({
          chunkIndex: chunkIndex++,
          content: currentChunk.trim(),
          startChar: data.text.indexOf(currentChunk.trim())
        });
        currentChunk = '';
      }
      currentChunk += para + '\n\n';
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push({
        chunkIndex: chunkIndex++,
        content: currentChunk.trim(),
        startChar: data.text.indexOf(currentChunk.trim())
      });
    }
    
    doc.chunks = chunks;
    doc.chunkCount = chunks.length;
    
    console.log('   分块数:', chunks.length);
    
    // 保存数据库
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    
    console.log('\n✅ 数据库已更新!');
    
    // 验证内容是否包含关键词
    console.log('\n🔍 验证关键词:');
    const keywords = ['section 194', 'fit and proper', 'and/or', 'disciplinary', 'route'];
    keywords.forEach(kw => {
      const found = data.text.toLowerCase().includes(kw.toLowerCase());
      console.log(`   ${found ? '✅' : '❌'} "${kw}": ${found ? '找到' : '未找到'}`);
    });
    
    // 显示内容预览
    console.log('\n📝 内容预览 (前 1000 字符):');
    console.log('-'.repeat(60));
    console.log(data.text.substring(0, 1000));
    console.log('-'.repeat(60));
    
  } catch (error) {
    console.error('❌ 提取失败:', error.message);
  }
}

extractSFAT2021_5();
