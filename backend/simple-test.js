// 简单测试：检查分块和搜索
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'pdf_database.json');

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
const doc = db.files.find(f => f.originalName.includes('SFAT 2021-5'));

if (!doc) {
  console.log('❌ 未找到文档');
  process.exit(1);
}

console.log('📄 文档:', doc.originalName);
console.log('📊 内容长度:', doc.content?.length || 0);
console.log('📦 分块数:', doc.chunks?.length || 0);

// 搜索包含 "route" 的分块
console.log('\n🔍 搜索 "route":');
const routeChunks = doc.chunks?.filter(c => c.content.toLowerCase().includes('route')) || [];
console.log(`   找到 ${routeChunks.length} 个分块`);
if (routeChunks.length > 0) {
  console.log('\n   第一个匹配:');
  console.log('   ' + routeChunks[0].content.substring(0, 300).replace(/\n/g, ' '));
}

// 搜索包含 "disciplinary" 的分块
console.log('\n🔍 搜索 "disciplinary":');
const discChunks = doc.chunks?.filter(c => c.content.toLowerCase().includes('disciplinary')) || [];
console.log(`   找到 ${discChunks.length} 个分块`);
if (discChunks.length > 0) {
  console.log('\n   第一个匹配:');
  console.log('   ' + discChunks[0].content.substring(0, 300).replace(/\n/g, ' '));
}

// 搜索包含 "powers" 的分块
console.log('\n🔍 搜索 "powers":');
const powChunks = doc.chunks?.filter(c => c.content.toLowerCase().includes('powers')) || [];
console.log(`   找到 ${powChunks.length} 个分块`);
if (powChunks.length > 0) {
  console.log('\n   第一个匹配:');
  console.log('   ' + powChunks[0].content.substring(0, 300).replace(/\n/g, ' '));
}
