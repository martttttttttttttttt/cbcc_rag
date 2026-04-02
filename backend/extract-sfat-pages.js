const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const pdfPath = path.join(__dirname, 'pdf_files', '1772614487859-41957441.pdf');
const outDir = path.join(__dirname, 'temp_ocr_pages');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('转换前 5 页为图片...');

const cmd = `magick -density 150 "${pdfPath}[0-4]" -quality 90 "${outDir}\\page-%d.png"`;

exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
  if (error) {
    console.log('转换错误:', error.message);
  } else {
    console.log('转换完成');
    console.log('输出:', stdout);
    
    // 列出文件
    const files = fs.readdirSync(outDir);
    console.log('生成文件:', files);
  }
});
