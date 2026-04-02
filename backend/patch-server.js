const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');
const lines = content.split('\n');

// 直接在第 1826-1834 行位置替换（0-indexed: 1825-1833）
const startIndex = 1825; // 第 1826 行
const endIndex = 1833;   // 第 1834 行

console.log(`正在替换第 ${startIndex + 1} 到 ${endIndex + 1} 行`);
console.log('原始内容:');
for (let i = startIndex; i <= endIndex; i++) {
  console.log(`  ${i + 1}: ${lines[i]}`);
}

// 替换内容
const newLines = [
  "    // 3. 使用 AI 生成回答",
  "    console.log('🤖 使用 AI 生成回答...');",
  "    ",
  "    // 准备所有文档（用于无匹配时的回退）",
  "    const allDocumentsForFallback = files.map(file => ({",
  "      originalName: file.originalName,",
  "      fileName: file.originalName,",
  "      content: file.content,",
  "      year: getJudgmentYear(file),",
  "      category: file.category",
  "    }));",
  "    ",
  "    // 如果搜索结果很少（<3 个），启用\"分析所有文档\"模式",
  "    const analyzeAllDocs = searchResults.totalMatches < 3 && files.length > 0;",
  "    ",
  "    if (analyzeAllDocs) {",
  "      console.log(`📚 匹配文档较少 (${searchResults.totalMatches})，将分析所有 ${files.length} 个文档`);",
  "    }",
  "    ",
  "    const aiResponse = await aiProcessor.generateAnswer(",
  "      query,",
  "      searchResults.documents,",
  "      `查询类型：${queryType}\\n查询分析：${JSON.stringify(queryAnalysis, null, 2)}`,",
  "      {",
  "        analyzeAllDocs: analyzeAllDocs,",
  "        allDocuments: allDocumentsForFallback",
  "      }",
  "    );",
  "    "
];

lines.splice(startIndex, endIndex - startIndex + 1, ...newLines);
content = lines.join('\n');
fs.writeFileSync(serverPath, content, 'utf8');

console.log('\n✅ 补丁应用成功！');
console.log('已修改：server.js - handleQueryWithAI 函数');
console.log('功能：当匹配文档少于 3 个时，自动分析所有上传的文档');
