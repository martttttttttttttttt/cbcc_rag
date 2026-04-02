const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// 找到位置并插入路由注册
const target = `// 确保存储目录存在
const storageDir = path.join(__dirname, 'pdf_files');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}`;

const replacement = `// 确保存储目录存在
const storageDir = path.join(__dirname, 'pdf_files');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// 注册 Interlocutory Applications 路由
const interlocutoryRoutes = require('./interlocutory-routes');
app.use('/api/interlocutory', interlocutoryRoutes);`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(serverPath, content);
  console.log('✅ Interlocutory routes registered successfully!');
} else {
  console.log('❌ Target not found in server.js');
}
