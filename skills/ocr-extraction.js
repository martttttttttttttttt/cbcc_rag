const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');

class OCRExtraction {
  constructor(options = {}) {
    this.tempDir = options.tempDir || path.join(__dirname, '../backend/temp_quick_ocr');
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async extractTextWithOCR(pdfPath, fileName) {
    try {
      const { createWorker } = Tesseract;
      const worker = createWorker({ langPath: path.join(__dirname, '../backend') });
      
      await worker.load();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');

      const pdfBuffer = fs.readFileSync(pdfPath);
      const parser = new PDFParse({ data: pdfBuffer });
      const data = await parser.getText();
      
      let ocrText = '';
      let pageCount = data.numpages;

      for (let i = 1; i <= Math.min(pageCount, 50); i++) {
        try {
          const pageBuffer = await parser.getPageBuffer(i);
          const imagePath = path.join(this.tempDir, `page-${i.toString().padStart(2, '0')}.png`);
          
          // 保存页面为图片
          fs.writeFileSync(imagePath, pageBuffer);
          
          // 预处理图片以提高 OCR 准确率
          const processedImage = await sharp(imagePath)
            .threshold(128)
            .resize(1600, null, { fit: 'inside' })
            .toBuffer();
          
          // 执行 OCR
          const { data: { text } } = await worker.recognize(processedImage);
          ocrText += text + '\n';
          
          // 清理临时文件
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (pageError) {
          console.error(`处理第 ${i} 页时出错:`, pageError.message);
          continue;
        }
      }

      await worker.terminate();
      return ocrText.trim();
    } catch (error) {
      console.error('OCR 处理失败:', error.message);
      return '';
    }
  }

  async extract(params) {
    const { filePath } = params;
    
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('文件不存在');
    }

    try {
      const pdfBuffer = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: pdfBuffer });
      const data = await parser.getText();
      
      let text = data.text || '';
      const pageCount = data.numpages;
      
      // 检测是否为扫描版 PDF
      const isScannedPDF = text.length < 100 && fs.statSync(filePath).size > 500000;
      
      if (isScannedPDF) {
        console.log('检测到扫描版 PDF，尝试 OCR 处理...');
        const ocrText = await this.extractTextWithOCR(filePath, path.basename(filePath));
        if (ocrText.length > 0) {
          text = ocrText;
          console.log(`OCR 成功，提取了 ${text.length} 个字符`);
        }
      }

      return {
        success: true,
        text: text,
        pageCount: pageCount,
        isScanned: isScannedPDF,
        fileName: path.basename(filePath),
        filePath: filePath
      };
    } catch (error) {
      console.error('文本提取失败:', error.message);
      throw new Error(`文本提取失败: ${error.message}`);
    }
  }
}

module.exports = OCRExtraction;