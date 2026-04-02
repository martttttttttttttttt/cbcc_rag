/**
 * 批量重新 OCR 处理
 * 修复 OCR 识别错误的文档
 */

const fs = require('fs');
const path = require('path');
const { extractTextWithOCR } = require('./ocr-extract.js');

// 需要重新 OCR 的文档列表
const NEEDS_REOCR = [
  'SFAT_2023-2_Ruling_EN.pdf',
  'SFAT_2022-5-Ruling_on_Assessment_of_Costs.pdf',
  'SFAT_2019-2-Decision_on_Costs.pdf',
  'SFAT 2022-5-Ruling.pdf',
  'SFAT 2022-4 Ruling dd 9_12_2022.pdf',
  'SFAT 2021-5 Determination (f).pdf',
  'SFAT 2021-1 Ruling.pdf',
  'AN-4-2019-Determination.pdf',
  '20220429-SFAT 2022_4_Ruling.pdf',
  'SFAT-2021-4-Ruling on Prelimin.pdf',
  'SFAT-2021-4-Descion on Costs.pdf',
  'SFAT5-2020-Determination28-9-2020).pdf',
  'SFAT4-2020-Decision6-7-2020_final.pdf',
  'MMT_China_Forestry_Directions(2.8.2024)_e.pdf',
  'CIFC_and_Smartac_Ruling_and_Directions_28.1.2025.pdf',
];

// 加载数据库
const dbPath = path.join(__dirname, 'pdf_database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

// 查找需要处理的文档
const docsToProcess = db.files.filter(file => 
  NEEDS_REOCR.includes(file.originalName)
);

console.log('📋 ClawText 批量 OCR 重新处理');
console.log('='.repeat(60));
console.log(`找到 ${docsToProcess.length} 个需要重新 OCR 的文档:\n`);
docsToProcess.forEach((doc, i) => {
  console.log(`  ${i+1}. ${doc.originalName}`);
});
console.log();

// 处理单个文档
async function processDocument(file) {
  const pdfPath = path.join(__dirname, 'pdf_files', file.fileName);
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ 文件不存在：${pdfPath}`);
    return null;
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 处理：${file.originalName}`);
  console.log(`   路径：${pdfPath}`);
  
  try {
    // 使用 OCR 提取
    const text = await extractTextWithOCR(pdfPath, file.originalName);
    
    if (text && text.length > 0) {
      console.log(`✅ 成功提取 ${text.length} 字符`);
      
      // 更新数据库
      file.content = text;
      file.contentExtractedAt = new Date().toISOString();
      file.ocrProcessed = true;
      file.ocrProcessedAt = new Date().toISOString();
      
      return {
        docId: file.id,
        fileName: file.originalName,
        chars: text.length
      };
    } else {
      console.error(`❌ 提取失败：无文本返回`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ 处理异常：${error.message}`);
    return null;
  }
}

// 主函数
async function main() {
  const results = [];
  
  for (const file of docsToProcess) {
    const result = await processDocument(file);
    if (result) {
      results.push(result);
    }
    
    // 保存进度
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    
    // 避免过热
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 批量处理完成！');
  console.log('='.repeat(60));
  console.log(`成功：${results.length}/${docsToProcess.length}`);
  console.log('\n处理结果:');
  results.forEach(r => {
    console.log(`  • ${r.fileName}: ${r.chars} 字符`);
  });
  
  // 保存最终结果
  const summaryPath = path.join(__dirname, 'reocr_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    processedAt: new Date().toISOString(),
    total: docsToProcess.length,
    success: results.length,
    results
  }, null, 2));
  console.log(`\n📁 摘要保存到：${summaryPath}`);
}

main().catch(console.error);
