const axios = require('axios');

async function extractAllContent() {
  try {
    console.log('🚀 开始提取所有 PDF 文档内容...');
    
    const response = await axios.post('http://localhost:3000/api/extract-all-content', {}, {
      timeout: 10 * 60 * 1000 // 10 分钟超时
    });
    
    console.log('\n✅ 提取完成！');
    console.log('📊 结果:', response.data);
    
  } catch (error) {
    console.error('❌ 提取失败:', error.message);
    if (error.response) {
      console.error('响应:', error.response.data);
    }
  }
}

extractAllContent();
