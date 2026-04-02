// 调用后端 OCR API
const http = require('http');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'pdf_database.json');

async function callOCRAPI() {
  console.log('📞 调用后端 OCR API...\n');
  
  // 读取数据库找到 SFAT 2021-5
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const doc = db.files.find(f => f.originalName.includes('SFAT 2021-5'));
  
  if (!doc) {
    console.log('❌ 未找到 SFAT 2021-5 文档');
    return;
  }
  
  console.log('📄 文档:', doc.originalName);
  console.log('📁 文件:', doc.fileName);
  console.log('🔑 ID:', doc.id);
  
  // 构建请求
  const postData = JSON.stringify({
    fileId: doc.id,
    forceOCR: true
  });
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/ocr-extract',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('\n✅ API 响应状态:', res.statusCode);
        try {
          const result = JSON.parse(data);
          console.log('📊 响应:', JSON.stringify(result, null, 2).substring(0, 2000));
          resolve(result);
        } catch (e) {
          console.log('📝 响应内容:', data.substring(0, 2000));
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
    
    console.log('⏳ 发送请求...');
  });
}

callOCRAPI().catch(console.error);
