/**
 * 验证多文档分析 - 简化版
 * 只检查 sources 字段，不等待完整 AI 响应
 */

const http = require('http');
const fs = require('fs');

const question = "What are the court's comments on disciplinary powers?";
const data = JSON.stringify({ message: question, selectedDocuments: [] });

console.log('🧪 验证多文档分析功能');
console.log(`问题：${question}`);
console.log('等待后端处理...\n');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  },
  timeout: 180000 // 3 分钟超时
};

const startTime = Date.now();
const req = http.request(options, (res) => {
  let body = '';
  console.log(`HTTP 状态：${res.statusCode}`);
  res.on('data', chunk => {
    body += chunk;
    process.stdout.write('.'); // 进度指示
  });
  res.on('end', () => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n✅ 响应成功！耗时：${elapsed}秒`);
    
    try {
      const result = JSON.parse(body);
      
      console.log(`\n📊 结果分析:`);
      console.log(`   分析文档数：${result.sources ? result.sources.length : 0}`);
      console.log(`   AI 使用：${result.aiUsed ? '✅ 是' : '❌ 否'}`);
      console.log(`   AI 模型：${result.aiModel || 'N/A'}`);
      
      if (result.sources && result.sources.length > 0) {
        console.log(`\n📚 分析的文档列表:`);
        result.sources.forEach((s, i) => {
          console.log(`   ${i+1}. ${s.fileName}`);
          console.log(`      类别：${s.category} | 分块：${s.chunksUsed} | 相关性：${s.relevanceScore?.toFixed(2) || 'N/A'}`);
        });
        
        console.log(`\n✅ 验证通过：系统分析了 ${result.sources.length} 个文档！`);
        
        // 保存结果
        const logFile = 'multi-doc-verification.log';
        const logContent = `[${new Date().toISOString()}] 验证结果\n` +
          `问题：${question}\n` +
          `文档数：${result.sources.length}\n` +
          `文档列表:\n${result.sources.map(s => `  - ${s.fileName} (${s.chunksUsed} 分块)`).join('\n')}\n\n` +
          `答案预览:\n${result.answer ? result.answer.substring(0, 500) : 'N/A'}\n`;
        
        fs.writeFileSync(logFile, logContent);
        console.log(`\n📁 详细结果已保存到：${logFile}`);
        
      } else {
        console.log(`\n❌ 验证失败：没有文档来源`);
        console.log(`响应：${JSON.stringify(result, null, 2).substring(0, 500)}`);
      }
      
    } catch (e) {
      console.log(`\n❌ 解析错误：${e.message}`);
      console.log(`原始响应：${body.substring(0, 500)}`);
    }
  });
});

req.on('error', (e) => {
  console.log(`\n\n❌ 请求错误：${e.message}`);
});

req.on('timeout', () => {
  console.log('\n\n⏰ 请求超时 (180 秒)');
  req.destroy();
});

req.write(data);
req.end();
