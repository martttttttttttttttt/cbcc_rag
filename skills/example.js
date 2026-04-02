// 技能包使用示例
const { ClawTextSkills } = require('./index');

// 初始化技能包
const skills = new ClawTextSkills({
  // 可选配置
  storageDir: './backend/pdf_files',
  dbPath: './backend/pdf_database.json',
  chunkDBPath: './backend/chunks_database.json'
});

// 示例 1: 上传 PDF 文件
async function uploadExample() {
  console.log('=== 示例 1: 上传 PDF 文件 ===');
  try {
    const result = await skills.uploadPDF([
      './backend/pdf_files/sample1.pdf',
      './backend/pdf_files/sample2.pdf'
    ], 'SFAT');
    console.log('上传结果:', result);
  } catch (error) {
    console.error('上传失败:', error.message);
  }
}

// 示例 2: 列出 PDF 文件
async function listExample() {
  console.log('\n=== 示例 2: 列出 PDF 文件 ===');
  try {
    const result = await skills.listPDFs('SFAT');
    console.log('文件列表:', result);
  } catch (error) {
    console.error('获取列表失败:', error.message);
  }
}

// 示例 3: 提取文本
async function extractExample() {
  console.log('\n=== 示例 3: 提取文本 ===');
  try {
    const result = await skills.extractText('./backend/pdf_files/sample1.pdf');
    console.log('提取结果:', {
      success: result.success,
      pageCount: result.pageCount,
      isScanned: result.isScanned,
      textLength: result.text.length
    });
  } catch (error) {
    console.error('提取失败:', error.message);
  }
}

// 示例 4: 文档分析
async function analyzeExample() {
  console.log('\n=== 示例 4: 文档分析 ===');
  try {
    const extractResult = await skills.extractText('./backend/pdf_files/sample1.pdf');
    const result = await skills.analyzeDocument(
      extractResult.text,
      'doc-123',
      'sample1.pdf'
    );
    console.log('分析结果:', {
      success: result.success,
      metadata: result.metadata,
      chunkCount: result.chunkCount,
      contentLength: result.contentLength
    });
  } catch (error) {
    console.error('分析失败:', error.message);
  }
}

// 示例 5: AI 问答
async function askExample() {
  console.log('\n=== 示例 5: AI 问答 ===');
  try {
    const result = await skills.askQuestion(
      'What is the court\'s comment on disciplinary powers?',
      'SFAT'
    );
    console.log('AI 回答:', result.answer);
    console.log('来源:', result.sources.map(s => s.name));
  } catch (error) {
    console.error('问答失败:', error.message);
  }
}

// 示例 6: 向量搜索
async function searchExample() {
  console.log('\n=== 示例 6: 向量搜索 ===');
  try {
    const result = await skills.search('disciplinary powers', 3);
    console.log('搜索结果:', result.results.map(r => ({
      docName: r.docName,
      similarity: r.similarity,
      content: r.content.substring(0, 100) + '...'
    })));
  } catch (error) {
    console.error('搜索失败:', error.message);
  }
}

// 示例 7: 法院评论分析
async function courtCommentsExample() {
  console.log('\n=== 示例 7: 法院评论分析 ===');
  try {
    const extractResult = await skills.extractText('./backend/pdf_files/sample1.pdf');
    const result = await skills.analyzeCourtComments(
      extractResult.text,
      'sample1.pdf'
    );
    console.log('评论分析:', {
      totalComments: result.totalComments,
      commentTypes: result.commentTypes,
      mainThemes: result.analysis.mainThemes
    });
  } catch (error) {
    console.error('分析失败:', error.message);
  }
}

// 运行所有示例
async function runAllExamples() {
  try {
    await uploadExample();
    await listExample();
    await extractExample();
    await analyzeExample();
    await askExample();
    await searchExample();
    await courtCommentsExample();
  } catch (error) {
    console.error('示例运行失败:', error.message);
  }
}

// 导出示例函数
module.exports = {
  runAllExamples,
  uploadExample,
  listExample,
  extractExample,
  analyzeExample,
  askExample,
  searchExample,
  courtCommentsExample
};

// 如果直接运行此文件，则执行所有示例
if (require.main === module) {
  runAllExamples();
}