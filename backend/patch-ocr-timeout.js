const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// 替换 OCR 调用，添加超时保护
const oldPattern = 'const ocrText = await extractTextWithOCR(fullPath, file.originalName);';
const newCode = `// 添加超时保护（5 分钟）
const ocrPromise = extractTextWithOCR(fullPath, file.originalName);
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('OCR 超时（5 分钟）')), 5 * 60 * 1000)
);
const ocrText = await Promise.race([ocrPromise, timeoutPromise]);`;

const count = content.split(oldPattern).length - 1;
content = content.replace(new RegExp(oldPattern.replace(/\(/g, '\\(').replace(/\)/g, '\\)'), 'g'), newCode);

fs.writeFileSync(serverPath, content, 'utf8');
console.log(`✅ 已更新 ${count} 处 OCR 调用，添加超时保护`);
