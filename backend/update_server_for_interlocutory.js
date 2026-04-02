/**
 * 更新 server.js 添加 Interlocutory 路由支持
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// 1. 在 pdfAnnotator 导入后添加 Interlocutory 路由导入
const importMarker = "const pdfAnnotator = require('./pdf-annotator');";
const importAddition = `const pdfAnnotator = require('./pdf-annotator');
const interlocutoryRoutes = require('./interlocutory-routes');`;

if (!content.includes('interlocutory-routes')) {
  content = content.replace(importMarker, importAddition);
  console.log('✅ Added interlocutory routes import');
}

// 2. 在 app.use('/pdf'... 之后添加路由注册
const routeMarker = "app.use('/pdf', express.static(path.join(__dirname, 'pdf_files')));";
const routeAddition = `app.use('/pdf', express.static(path.join(__dirname, 'pdf_files')));

// 注册 Interlocutory Applications 路由
app.use('/api/interlocutory', interlocutoryRoutes);`;

if (!content.includes("app.use('/api/interlocutory'")) {
  content = content.replace(routeMarker, routeAddition);
  console.log('✅ Added interlocutory routes registration');
}

// 3. 更新 API 端点列表
const apiListMarker = `console.log('  POST /api/vector/search - 向量语义搜索');
  console.log('  POST /api/vector/generate - 生成向量缓存');
  console.log('==========================================');`;

const apiListAddition = `console.log('  POST /api/vector/search - 向量语义搜索');
  console.log('  POST /api/vector/generate - 生成向量缓存');
  console.log('  Interlocutory Applications:');
  console.log('    POST /api/interlocutory/index - 索引案例到向量库');
  console.log('    POST /api/interlocutory/search - 语义/关键词搜索');
  console.log('    POST /api/interlocutory/query - AI问答查询');
  console.log('    GET  /api/interlocutory/stats - 统计信息');
  console.log('    GET  /api/interlocutory/cases - 所有案例列表');
  console.log('    POST /api/interlocutory/analyze-directory - 分析目录');
  console.log('==========================================');`;

if (!content.includes('Interlocutory Applications:')) {
  content = content.replace(apiListMarker, apiListAddition);
  console.log('✅ Updated API endpoint list');
}

// 保存文件
fs.writeFileSync(serverPath, content);
console.log('\n🎉 Server.js updated successfully!');
console.log('\nNew endpoints available:');
console.log('  POST /api/interlocutory/index - 索引案例');
console.log('  POST /api/interlocutory/search - 搜索案例');
console.log('  POST /api/interlocutory/query - AI问答（调用大模型）');
console.log('  GET  /api/interlocutory/stats - 统计信息');
console.log('  GET  /api/interlocutory/cases - 所有案例');
console.log('  POST /api/interlocutory/analyze-directory - 分析目录');
