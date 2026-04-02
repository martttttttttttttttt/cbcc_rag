/**
 * 批量重新 OCR 处理有问题的文档
 * 使用增强的 OCR 配置重新提取文本
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const pdf = require('pdf-poppler');

// 需要重新 OCR 的文档列表（根据用户反馈）
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

// OCR 配置 - 增强版
const OCR_CONFIG = {
  dpi: 600,
  scale: 1.5,
  format: 'png',
  out_dir: path.join(__dirname, 'temp_ocr_enhanced'),
};

const TESSERACT_CONFIG = {
  lang: 'eng',
  oem: 3,  // OCR Engine Mode: Default, based on what's available
  psm: 3,  // Page segmentation mode: Fully automatic page segmentation, but no OSD
};

// 确保输出目录存在
if (!fs.existsSync(OCR_CONFIG.out_dir)) {
  fs.mkdirSync(OCR_CONFIG.out_dir, { recursive: true });
}

// 加载数据库
const dbPath = path.join(__dirname, 'pdf_database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

// 查找需要处理的文档
const docsToProcess = db.files.filter(file => 
  NEEDS_REOCR.includes(file.originalName)
);

console.log(`📋 找到 ${docsToProcess.length} 个需要重新 OCR 的文档:\n`);
docsToProcess.forEach((doc, i) => {
  console.log(`  ${i+1}. ${doc.originalName}`);
});
console.log();

// 处理单个 PDF 文件
async function processPDF(file) {
  const pdfPath = path.join(__dirname, 'pdf_files', file.fileName);
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ 文件不存在：${pdfPath}`);
    return null;
  }
  
  console.log(`\n📄 处理：${file.originalName}`);
  console.log(`   路径：${pdfPath}`);
  
  try {
    // 使用 pdf-poppler 转换为图片
    const convertOpts = {
      ...OCR_CONFIG,
      out_prefix: `ocr_${file.id}_`,
    };
    
    console.log(`   🔄 转换为图片...`);
    const result = await pdf.convert(pdfPath, convertOpts);
    
    console.log(`   📊 生成 ${result.pages} 页图片`);
    
    // 对每页进行 OCR
    let fullText = '';
    const tempDir = OCR_CONFIG.out_dir;
    
    for (let page = 1; page <= result.pages; page++) {
      const imagePath = path.join(tempDir, `ocr_${file.id}_page_${page}.png`);
      
      if (fs.existsSync(imagePath)) {
        console.log(`   🔍 OCR 第 ${page}/${result.pages} 页...`);
        
        // 使用 Tesseract OCR
        const tesseractCmd = `tesseract "${imagePath}" stdout --psm ${TESSERACT_CONFIG.psm} --oem ${TESSERACT_CONFIG.oem} -l ${TESSERACT_CONFIG.lang}`;
        
        const text = await new Promise((resolve, reject) => {
          exec(tesseractCmd, { timeout: 60000 }, (error, stdout, stderr) => {
            if (error) {
              console.error(`   ⚠️ OCR 错误：${error.message}`);
              resolve('');
            } else {
              resolve(stdout);
            }
          });
        });
        
        fullText += `\n--- 第 ${page} 页 ---\n${text}\n`;
        
        // 清理临时图片
        fs.unlinkSync(imagePath);
      }
    }
    
    console.log(`   ✅ 提取 ${fullText.length} 字符`);
    
    return {
      docId: file.id,
      fileName: file.originalName,
      text: fullText,
      pages: result.pages,
    };
    
  } catch (error) {
    console.error(`❌ 处理失败：${error.message}`);
    return null;
  }
}

// 主函数
async function main() {
  const results = [];
  
  for (const file of docsToProcess) {
    const result = await processPDF(file);
    if (result) {
      results.push(result);
    }
    
    // 避免过快处理
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n========================================');
  console.log(`✅ 完成！成功处理 ${results.length}/${docsToProcess.length} 个文档`);
  
  // 保存结果
  const outputPath = path.join(__dirname, 'reocr_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`📁 结果保存到：${outputPath}`);
}

main().catch(console.error);
