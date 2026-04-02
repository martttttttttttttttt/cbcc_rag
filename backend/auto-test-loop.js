// 自动化测试循环：调整直到答案正确
const axios = require('axios');

const API_BASE = 'http://localhost:3000';

// 测试问题
const TEST_QUESTION = 'Is there any comments from the court about the route by which we have exercised our disciplinary powers?';

// 期望答案的关键要素
const EXPECTED_KEY_POINTS = [
  { keyword: 'SFAT 2021-5', required: true, desc: '必须引用 SFAT 2021-5 Determination 文档' },
  { keyword: 'section 194', required: true, desc: '必须提到 section 194(1)' },
  { keyword: 'fit and proper', required: true, desc: '必须提到 "fit and proper person"' },
  { keyword: 'and/or', required: true, desc: '必须提到法院批评 "and/or" 用法' },
  { keyword: 'unacceptable', required: false, desc: '最好提到 "unacceptable"' },
  { keyword: 'section 193', required: false, desc: '最好提到 section 193(1)  misconduct 定义' },
  { keyword: 'transparency', required: false, desc: '最好提到透明度' },
  { keyword: 'explain', required: false, desc: '最好提到解释责任' }
];

// 评分函数
function scoreAnswer(answer, sources) {
  const score = {
    total: 0,
    maxScore: 0,
    details: [],
    missingCritical: []
  };
  
  const answerText = (answer || '').toLowerCase();
  
  for (const point of EXPECTED_KEY_POINTS) {
    const found = answerText.includes(point.keyword.toLowerCase());
    score.maxScore += point.required ? 2 : 1;
    
    if (found) {
      score.total += point.required ? 2 : 1;
      score.details.push(`✅ ${point.desc}`);
    } else {
      if (point.required) {
        score.missingCritical.push(point.desc);
      }
      score.details.push(`❌ ${point.desc}`);
    }
  }
  
  // 检查是否引用了正确文档
  const hasCorrectDoc = sources && sources.some(s => {
    const docName = (s.title || s.document || s.file?.originalName || '').toLowerCase();
    return docName.includes('sfat 2021-5') || docName.includes('2021-5');
  });
  
  if (hasCorrectDoc) {
    score.total += 3;
    score.maxScore += 3;
    score.details.push('✅ 引用了正确文档 (SFAT 2021-5)');
  } else {
    score.missingCritical.push('未引用正确文档 (SFAT 2021-5)');
    score.details.push('❌ 未引用正确文档 (SFAT 2021-5)');
  }
  
  return score;
}

async function testAndAdjust() {
  console.log('🤖 自动化测试循环开始\n');
  console.log('📝 测试问题:', TEST_QUESTION);
  console.log('🎯 期望答案关键点:', EXPECTED_KEY_POINTS.map(p => p.desc).join('\n   '));
  console.log('\n' + '='.repeat(70) + '\n');
  
  let iteration = 0;
  const maxIterations = 10;
  
  while (iteration < maxIterations) {
    iteration++;
    console.log(`\n🔄 第 ${iteration} 轮测试\n`);
    
    try {
      // 调用 API
      const startTime = Date.now();
      const res = await axios.post(`${API_BASE}/api/chat`, {
        message: TEST_QUESTION,
        ai: true
      });
      const endTime = Date.now();
      
      const data = res.data;
      const answer = data.response || data.answer || data.message || '';
      const sources = data.sources || [];
      
      console.log(`⏱️ 响应时间：${endTime - startTime}ms`);
      console.log(`📑 引用文档数：${sources.length}`);
      
      // 显示引用的文档
      if (sources.length > 0) {
        console.log('\n📚 引用文档:');
        sources.slice(0, 5).forEach((s, i) => {
          const docName = s.title || s.document || s.file?.originalName || '未知';
          console.log(`   ${i+1}. ${docName.substring(0, 60)}...`);
        });
      }
      
      // 评分
      const score = scoreAnswer(answer, sources);
      
      console.log('\n📊 评分结果:');
      console.log(`   得分：${score.total}/${score.maxScore} (${Math.round(score.total/score.maxScore*100)}%)`);
      
      score.details.forEach(d => console.log(`   ${d}`));
      
      if (score.missingCritical.length > 0) {
        console.log('\n❌ 缺失关键要素:');
        score.missingCritical.forEach(m => console.log(`   - ${m}`));
      }
      
      // 检查是否达到目标（80% 以上）
      const accuracy = score.total / score.maxScore;
      
      if (accuracy >= 0.8) {
        console.log('\n🎉 达到目标！答案质量 >= 80%');
        console.log('\n✅ 最终答案:');
        console.log('-'.repeat(70));
        console.log(answer.substring(0, 1500) + '...');
        console.log('-'.repeat(70));
        return { success: true, iteration, score, answer };
      }
      
      // 显示当前答案预览
      console.log('\n📝 当前答案预览:');
      console.log(answer.substring(0, 500) + '...\n');
      
      // 如果需要调整，分析原因
      console.log('🔍 分析需要调整的方面...');
      
      // 检查是否是文档检索问题
      if (!hasCorrectDoc(sources)) {
        console.log('⚠️ 问题：未检索到正确文档 (SFAT 2021-5)');
        console.log('🔧 建议：调整检索权重或关键词提取');
      }
      
      // 检查是否是 AI 理解问题
      if (answer.length < 200) {
        console.log('⚠️ 问题：答案太短，AI 可能未充分理解');
        console.log('🔧 建议：调整 AI 提示词，要求更详细回答');
      }
      
    } catch (error) {
      console.error('❌ API 调用失败:', error.message);
      if (error.response) {
        console.error('响应:', error.response.data);
      }
    }
    
    // 等待一下
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n⚠️ 达到最大迭代次数，未达到目标');
  return { success: false, iteration, score: null };
}

function hasCorrectDoc(sources) {
  return sources && sources.some(s => {
    const docName = (s.title || s.document || s.file?.originalName || '').toLowerCase();
    return docName.includes('sfat 2021-5') || docName.includes('2021-5');
  });
}

// 运行测试
testAndAdjust().then(result => {
  console.log('\n\n📊 最终结果:');
  console.log('迭代次数:', result.iteration);
  console.log('成功:', result.success ? '✅' : '❌');
  if (result.score) {
    console.log('最终得分:', `${result.score.total}/${result.score.maxScore}`);
  }
});
