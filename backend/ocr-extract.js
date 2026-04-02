/**
 * ClawText OCR最终优化方案
 * 结合增强版OCR的最佳实践
 */

const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');
const sharp = require('sharp');

class FinalOCRProcessor {
  constructor(options = {}) {
    this.options = {
      languages: ['eng'],           // 默认英语
      dpi: 600,                     // 高DPI转换
      maxPages: 50,                 // 最大处理页数
      tempDir: path.join(__dirname, 'temp_ocr_final'),
      imageScale: 1.5,              // 图像放大倍数（优化速度）
      sharpen: true,                // 锐化处理
      threshold: 150,               // 二值化阈值（优化对比度）
      ...options
    };
    
    this.worker = null;
  }
  
  async initialize() {
    if (!this.worker) {
      console.log('🚀 初始化Tesseract OCR...');
      this.worker = await createWorker(this.options.languages);
      
      // 优化OCR参数 - 针对扫描文档优化
      await this.worker.setParameters({
        tessedit_pageseg_mode: '6',      // 假设为统一文本块
        preserve_interword_spaces: '1',  // 保留单词间空格
        textord_min_linesize: '2.5',     // 最小行尺寸
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?()[]{}-_=+*/\\\'"@#$%& ',
      });
    }
    return this.worker;
  }
  
  async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
  
  async enhanceImage(imagePath) {
    /** 图像增强处理 - 优化版本 */
    try {
      const outputPath = imagePath.replace('.png', '_enhanced.png');
      
      await sharp(imagePath)
        .resize({ 
          width: Math.round(1600 * this.options.imageScale),
          kernel: sharp.kernel.lanczos3  // 高质量缩放
        })
        .sharpen(this.options.sharpen ? { 
          sigma: 1.2,
          m1: 0.5,
          m2: 0.5
        } : false)
        .threshold(this.options.threshold)
        .normalise()  // 增强对比度
        .toFile(outputPath);
      
      return outputPath;
    } catch (error) {
      console.log(`  图像增强失败，使用原图: ${error.message}`);
      return imagePath;
    }
  }
  
  async extractFromPDF(pdfPath, pdfName) {
    console.log(`🔍 ClawText OCR处理：${pdfName}`);
    console.log(`📁 文件路径：${pdfPath}`);
    console.log(`⚙️ 配置：${this.options.dpi} DPI，图像增强：${this.options.imageScale}x`);
    
    try {
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`文件不存在：${pdfPath}`);
      }
      
      const fileSize = fs.statSync(pdfPath).size;
      console.log(`📊 文件大小：${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      
      // 检查pdf-poppler
      let poppler;
      try {
        poppler = require('pdf-poppler');
      } catch (e) {
        console.error('❌ 需要安装pdf-poppler: npm install pdf-poppler');
        throw e;
      }
      
      // 创建临时目录
      const tempDir = this.options.tempDir;
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // 转换PDF为图片（高DPI）
      console.log(`⏳ 正在转换PDF为图片（${this.options.dpi} DPI）...`);
      
      const opts = {
        format: 'png',
        out_dir: tempDir,
        out_prefix: 'page',
        scale: this.options.dpi,
        first_page: 1,
        last_page: this.options.maxPages
      };
      
      const convertStart = Date.now();
      await poppler.convert(pdfPath, opts);
      const convertTime = ((Date.now() - convertStart) / 1000).toFixed(1);
      console.log(`✅ PDF转换完成，耗时 ${convertTime} 秒`);
      
      // 获取图片文件
      const files = fs.readdirSync(tempDir)
        .filter(f => f.startsWith('page') && f.endsWith('.png'))
        .sort((a, b) => {
          const matchA = a.match(/page-(\d+)\.png/);
          const matchB = b.match(/page-(\d+)\.png/);
          
          if (!matchA || !matchB) {
            return a.localeCompare(b); // 如果匹配失败，按字符串排序
          }
          
          const numA = parseInt(matchA[1]);
          const numB = parseInt(matchB[1]);
          return numA - numB;
        });
      
      console.log(`📄 生成了 ${files.length} 张图片`);
      
      // 初始化OCR
      await this.initialize();
      
      let fullText = '';
      let pageCount = 0;
      let totalChars = 0;
      
      // 逐页OCR - 优化处理
      for (const file of files) {
        const pageNum = pageCount + 1;
        
        try {
          const imagePath = path.join(tempDir, file);
          
          // 图像增强（可选，根据文件大小决定）
          let processPath = imagePath;
          if (fileSize > 2 * 1024 * 1024) { // 大于2MB的文件进行增强
            processPath = await this.enhanceImage(imagePath);
          }
          
          // OCR识别
          const { data: { text, confidence } } = await this.worker.recognize(processPath);
          
          if (text && text.trim().length > 0) {
            const cleanText = this.cleanText(text);
            fullText += cleanText + '\n\n';
            pageCount++;
            totalChars += cleanText.length;
            
            // 每10页显示一次进度
            if (pageNum % 10 === 0 || pageNum === files.length) {
              console.log(`   📄 已处理 ${pageNum}/${files.length} 页，提取 ${totalChars} 字符`);
            }
          }
          
          // 删除临时图片
          fs.unlinkSync(imagePath);
          if (processPath !== imagePath) {
            fs.unlinkSync(processPath);
          }
          
        } catch (pageError) {
          console.error(`   ❌ 第 ${pageNum} 页处理失败：${pageError.message}`);
        }
      }
      
      // 清理临时目录
      try {
        fs.rmdirSync(tempDir);
      } catch (e) {
        // 忽略清理错误
      }
      
      if (fullText.trim().length > 0) {
        const totalTime = ((Date.now() - convertStart) / 1000).toFixed(1);
        console.log(`\n🎉 ClawText OCR处理完成！`);
        console.log(`📊 总页数：${pageCount}`);
        console.log(`📝 总字符数：${totalChars}`);
        console.log(`⏱️ 总耗时：${totalTime} 秒`);
        console.log(`📈 平均速度：${(totalChars / totalTime).toFixed(0)} 字符/秒`);
        
        return {
          success: true,
          text: fullText,
          pageCount,
          totalChars,
          processingTime: totalTime
        };
      } else {
        console.log(`⚠️ 未能提取到有效文本`);
        return {
          success: false,
          error: 'No text extracted',
          text: ''
        };
      }
      
    } catch (error) {
      console.error(`❌ OCR处理失败：${error.message}`);
      return {
        success: false,
        error: error.message,
        text: ''
      };
    }
  }
  
  cleanText(text) {
    /** 清理OCR文本 - 优化版本 */
    return text
      .replace(/\n{3,}/g, '\n\n')                    // 减少多余空行
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')           // 清理非ASCII字符
      .replace(/\s+/g, ' ')                          // 合并多余空格
      .replace(/([a-z])([A-Z])/g, '$1 $2')           // 修复大小写粘连
      .replace(/(\d)([A-Za-z])/g, '$1 $2')           // 数字字母间加空格
      .replace(/([A-Za-z])(\d)/g, '$1 $2')           // 字母数字间加空格
      .trim();
  }
}

// ClawText OCR接口函数 - 保持与原模块相同的API
async function extractTextWithOCR(pdfPath, originalName) {
  console.log(`[ClawText OCR] 开始处理：${originalName}`);
  
  const processor = new FinalOCRProcessor({
    languages: ['eng'],
    dpi: 600,
    maxPages: 50,
    imageScale: 1.5,
    sharpen: true,
    threshold: 150
  });
  
  try {
    const result = await processor.extractFromPDF(pdfPath, originalName);
    await processor.cleanup();
    
    if (result.success) {
      console.log(`[ClawText OCR] 处理成功：提取 ${result.totalChars} 字符`);
      return result.text.substring(0, 100000); // 限制长度
    } else {
      console.log(`[ClawText OCR] 处理失败：${result.error}`);
      return '';
    }
  } catch (error) {
    await processor.cleanup();
    console.error(`[ClawText OCR] 异常：${error.message}`);
    return '';
  }
}

// 快速测试函数
async function quickTest() {
  console.log('🧪 ClawText OCR快速测试...');
  
  // 测试文件
  const testPdf = 'C:\\Users\\Administrator\\Desktop\\clawtext\\backend\\pdf_files\\1772531015195-524828469.pdf';
  
  if (!fs.existsSync(testPdf)) {
    console.log(`找不到测试文件：${testPdf}`);
    return;
  }
  
  // 只测试前5页以节省时间
  const testProcessor = new FinalOCRProcessor({
    languages: ['eng'],
    dpi: 600,
    maxPages: 5,  // 只测试5页
    imageScale: 1.5,
    sharpen: true,
    threshold: 150
  });
  
  try {
    const result = await testProcessor.extractFromPDF(testPdf, '测试文件.pdf');
    await testProcessor.cleanup();
    
    if (result.success) {
      console.log('\n' + '='.repeat(50));
      console.log('✅ ClawText OCR测试成功！');
      console.log('='.repeat(50));
      console.log(`📊 测试页数：${result.pageCount}`);
      console.log(`📝 提取字符：${result.totalChars}`);
      console.log(`⏱️ 处理时间：${result.processingTime} 秒`);
      
      // 显示样本
      const sample = result.text.substring(0, 500);
      console.log('\n📖 内容样本：');
      console.log(sample + (result.text.length > 500 ? '...' : ''));
    }
  } catch (error) {
    console.error('测试失败：', error);
  }
}

// 命令行接口
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('ClawText OCR最终优化方案');
    console.log('='.repeat(50));
    console.log('使用方法：');
    console.log('  1. 快速测试：node ocr-extract.js test');
    console.log('  2. 处理文件：node ocr-extract.js <PDF文件路径>');
    console.log('');
    console.log('此模块已集成到ClawText系统中');
    console.log('接口函数：extractTextWithOCR(pdfPath, originalName)');
    
    // 运行快速测试
    quickTest().catch(console.error);
  } else if (args[0] === 'test') {
    quickTest().catch(console.error);
  } else {
    const pdfPath = args[0];
    extractTextWithOCR(pdfPath, path.basename(pdfPath))
      .then(text => {
        if (text) {
          console.log('\n' + '='.repeat(50));
          console.log('OCR提取完成！');
          console.log('='.repeat(50));
          console.log(`总字符数：${text.length}`);
          
          // 保存结果
          const outputDir = path.dirname(pdfPath);
          const baseName = path.basename(pdfPath, '.pdf');
          const outputPath = path.join(outputDir, `${baseName}_clawtext_ocr.txt`);
          fs.writeFileSync(outputPath, text, 'utf8');
          console.log(`结果已保存：${outputPath}`);
        }
      })
      .catch(err => {
        console.error('处理失败：', err);
      });
  }
}

// 导出ClawText需要的函数
module.exports = {
  extractTextWithOCR
};