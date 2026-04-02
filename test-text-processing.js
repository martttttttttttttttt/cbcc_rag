/**
 * 文本处理流程测试脚本
 * 
 * 测试内容：
 * 1. 文本提取（模拟PDF提取）
 * 2. 文本清洗（降噪）
 * 3. 格式标准化
 * 4. 法律术语归一化
 */

const { preprocess } = require('./backend/text-preprocessor');

console.log('==========================================');
console.log('🧪 ClawText 文本处理流程测试');
console.log('==========================================\n');

// 模拟从PDF提取的原始文本（包含噪声）
const rawExtractedText = `
香港特别行政区高等法院原讼法庭
═══════════════════════════════════════

民事诉讼编号：HCA 2024/1234

原告：张三　　　　　　　　被告：李四

判决书

本席现对本案作出判决如下：

背景

本案涉及一宗合同纠纷。原告张三声称被告李四违反双方于2021/06/15签订的买卖合同。

争议焦点

1. 合同是否有效成立？
2. 被告是否违反§28条款？
3. SFC（Securities and Futures Commission）的监管要求是否适用？

法律依据

根据《合约（第三方权利）条例》（第623章）§4的规定...
参照SFAT 2021-5判例...

法院意见

本席认为，根据现有证据，合同已于2021年6月15日有效成立...
SFC的disciplinary powers在本案中具有重要参考价值。

判决

综上所述，本席裁定：
(a) 被告须向原告支付违约金HK$500,000；
(b) 被告须承担诉讼费用。

日期：2024/03/06

法官签名：______________

页码：1 / 10
`;

console.log('📋 测试 1: 原始文本分析');
console.log('----------------------------------------');
console.log(`原始文本长度：${rawExtractedText.length} 字符`);
console.log(`包含换行符：${(rawExtractedText.match(/\n/g) || []).length} 个`);
console.log(`包含特殊符号：${(rawExtractedText.match(/[§╔╗═]/g) || []).length} 个`);
console.log('\n原始文本预览（前200字符）：');
console.log(rawExtractedText.substring(0, 200));
console.log('...\n');

console.log('📋 测试 2: 文本预处理');
console.log('----------------------------------------');

// 执行预处理
const startTime = Date.now();
const processedText = preprocess(rawExtractedText, {
  cleaning: true,
  normalization: true,
  synonyms: true
});
const processingTime = Date.now() - startTime;

console.log('✅ 预处理完成');
console.log(`处理后长度：${processedText.length} 字符`);
console.log(`处理时间：${processingTime}ms`);
console.log('\n处理后文本预览（前400字符）：');
console.log(processedText.substring(0, 400));
console.log('...\n');

console.log('📋 测试 3: 处理效果对比');
console.log('----------------------------------------');

// 检查特定转换
const checks = [
  { name: '日期格式 2021/06/15 → 2021-06-15', pattern: /\d{4}\/\d{2}\/\d{2}/, expected: false },
  { name: '日期格式 2024/03/06 → 2024-03-06', pattern: /2024\/03\/06/, expected: false },
  { name: '条款格式 §28 → section 28', pattern: /§28/, expected: false },
  { name: 'SFC 扩展为全称', pattern: /Securities and Futures Commission/, expected: true },
  { name: 'SFAT 保留', pattern: /SFAT 2021-5/, expected: true },
  { name: 'HK$ 保留', pattern: /HK\$500,000/, expected: true }
];

checks.forEach(check => {
  const found = check.pattern.test(processedText);
  const status = found === check.expected ? '✅' : '❌';
  console.log(`${status} ${check.name}: ${found ? '已匹配' : '未匹配'}`);
});

console.log('\n📋 测试 4: 降噪效果');
console.log('----------------------------------------');
console.log(`原始换行符：${(rawExtractedText.match(/\n/g) || []).length} 个`);
console.log(`处理后换行符：${(processedText.match(/\n/g) || []).length} 个`);
console.log(`原始特殊符号：${(rawExtractedText.match(/[§╔╗═]/g) || []).length} 个`);
console.log(`处理后特殊符号：${(processedText.match(/[§╔╗═]/g) || []).length} 个`);

console.log('\n==========================================');
console.log('✅ 文本处理流程测试完成！');
console.log('==========================================');
