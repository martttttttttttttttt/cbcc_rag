// 测试：所有文档分析（不是 Top 10）
const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function testAllDocsAnalysis() {
  console.log('🧪 测试：所有文档分析功能\n');
  
  try {
    // 1. 获取文档列表
    console.log('📋 获取文档列表...');
    const docRes = await axios.get(`${API_BASE}/api/documents`);
    const docs = docRes.data.documents || [];
    console.log(`✅ 系统共有 ${docs.length} 个文档\n`);
    
    if (docs.length === 0) {
      console.log('❌ 没有文档可测试，请先上传 PDF');
      return;
    }
    
    // 2. 发送查询请求
    const query = '小额钱债审裁处 管辖权';
    console.log(`🔍 查询："${query}"`);
    console.log(`📊 预期：分析所有 ${docs.length} 个文档（不是 Top 10）\n`);
    
    const chatRes = await axios.post(`${API_BASE}/api/chat`, {
      message: query,
      ai: true
    });
    
    const data = chatRes.data;
    
    // 3. 分析结果
    console.log('📊 结果分析:');
    console.log('=' .repeat(60));
    
    if (data.sources && data.sources.length > 0) {
      const uniqueDocs = new Set(data.sources.map(s => s.docId || s.fileId || s.id));
      console.log(`✅ 引用文档数：${uniqueDocs.size} / ${docs.length}`);
      
      if (uniqueDocs.size === docs.length) {
        console.log('🎉 成功：分析了所有文档！');
      } else if (uniqueDocs.size > 10) {
        console.log('✅ 成功：分析了超过 10 个文档（之前限制）');
      } else {
        console.log('⚠️ 注意：只分析了部分文档');
      }
      
      console.log(`\n📑 来源文档:`);
      data.sources.forEach((source, i) => {
        const docName = source.title || source.document || '未知文档';
        console.log(`   ${i+1}. ${docName.substring(0, 50)}...`);
      });
    } else {
      console.log('⚠️ 没有来源信息');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🤖 AI 回答预览:');
    console.log(data.response?.substring(0, 300) + '...\n');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行测试
testAllDocsAnalysis();
