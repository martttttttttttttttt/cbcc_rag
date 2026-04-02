const fs = require('fs');
const db = JSON.parse(fs.readFileSync('C:\\Users\\Administrator\\Desktop\\clawtext\\backend\\pdf_database.json', 'utf-8'));
const withContent = db.files.filter(f => f.content && f.content.length > 0);
console.log('总文件数:', db.files.length);
console.log('有内容的文件:', withContent.length);
console.log('\n前 5 个文件:');
withContent.slice(0, 5).forEach(f => {
  console.log('  - ' + f.originalName + ': ' + f.content.length + ' 字符，' + (f.chunkCount || 0) + ' 个分块');
});
