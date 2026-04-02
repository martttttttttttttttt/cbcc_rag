const http = require('http');

const question = "What are the court's comments on disciplinary powers?";
const data = JSON.stringify({ message: question, selectedDocuments: [] });

console.log('🧪 快速测试：多文档分析');
console.log(`问题：${question}`);
console.log('...\n');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  },
  timeout: 60000 // 60 秒超时
};

const req = http.request(options, (res) => {
  let body = '';
  console.log(`HTTP 状态：${res.statusCode}`);
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(body);
      console.log('\n✅ 响应成功！');
      console.log(`\n📊 分析文档数：${result.sources ? result.sources.length : 0}`);
      console.log(`📚 文档列表:`);
      if (result.sources && result.sources.length > 0) {
        result.sources.forEach((s, i) => {
          console.log(`   ${i+1}. ${s.fileName} (${s.chunksUsed} 分块)`);
        });
      }
      console.log(`\n📝 答案预览 (前 200 字符):`);
      console.log(`   ${result.answer ? result.answer.substring(0, 200) + '...' : '无答案'}`);
    } catch (e) {
      console.log(`\n❌ 解析错误：${e.message}`);
      console.log(`原始响应：${body.substring(0, 500)}`);
    }
  });
});

req.on('error', (e) => {
  console.log(`\n❌ 请求错误：${e.message}`);
});

req.on('timeout', () => {
  console.log('\n⏰ 请求超时 (60 秒)');
  req.destroy();
});

req.write(data);
req.end();
