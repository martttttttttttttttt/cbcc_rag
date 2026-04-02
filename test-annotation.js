/**
 * 结构化标注功能测试脚本
 */

const { annotateDocument, batchAnnotate } = require('./backend/pdf-annotator');

console.log('==========================================');
console.log('🏷️ ClawText 结构化标注测试');
console.log('==========================================\n');

// 模拟PDF文件名和内容
const testDocuments = [
  {
    fileName: 'SFAT_2021-5_Determination.pdf',
    content: `
      Securities and Futures Appeal Tribunal
      
      Case No.: SFAT 2021-5
      Date: 2021-06-02
      
      Appellant: Mr. Calvin Choi
      Respondent: Securities and Futures Commission (SFC)
      
      DETERMINATION
      
      This is an appeal against the decision of the SFC dated 2020-12-15.
      
      The Tribunal has considered section 194(1)(b) of the Securities and Futures Ordinance (Cap. 571).
      Section 204 provides for disciplinary powers.
      
      The appellant's conduct was found to be in breach of section 180(1).
      
      Dated this 2nd day of June 2021.
      
      Tribunal Members:
      - Mr. Justice Johnson Lam
      - Ms. Patricia Lau
      - Mr. David Poon
    `
  },
  {
    fileName: 'SFAT_2022-4_Ruling_Interlocutory.pdf',
    content: `
      IN THE SECURITIES AND FUTURES APPEAL TRIBUNAL
      
      INTERLOCUTORY RULING
      
      Case Reference: SFAT 2022/4
      Hearing Date: 15 March 2022
      
      BETWEEN:
      Pan Tianyu (Applicant)
      - and -
      Securities and Futures Commission (Respondent)
      
      This interlocutory application concerns the admission of evidence.
      
      The Tribunal refers to section 83 of the Evidence Ordinance (Cap. 8).
      Rule 12(3) of the Tribunal Rules applies.
      
      Ruling delivered on 2022-03-20.
      
      Presiding Officer: The Honourable Mr. Justice William Wong
    `
  },
  {
    fileName: 'SFAT_2021-2_Costs_Decision.pdf',
    content: `
      SECURITIES AND FUTURES APPEAL TRIBUNAL
      
      DECISION ON COSTS
      
      Case Number: SFAT 2021-2
      Date of Decision: 2021-09-15
      
      Parties:
      Applicant: Smartac International Holdings Limited
      Respondent: Securities and Futures Commission
      
      Costs Award:
      The respondent shall pay the applicant's costs, assessed if not agreed.
      
      Regulation 45 of the Securities and Futures (Costs) Rules applies.
      
      Dated: 15 September 2021
      
      Tribunal: Mr. John Lee (Chairman)
    `
  }
];

// 测试单个文档标注
console.log('📋 测试 1: 单个文档标注');
console.log('----------------------------------------');

const singleResult = annotateDocument(
  testDocuments[0].fileName,
  testDocuments[0].content
);

console.log('\n标注结果：');
console.log(JSON.stringify(singleResult, null, 2));

// 测试批量标注
console.log('\n\n📋 测试 2: 批量文档标注');
console.log('----------------------------------------');

const batchResults = batchAnnotate(testDocuments);

console.log('\n统计信息：');
console.log(JSON.stringify(batchResults.stats, null, 2));

// 显示每个文档的标注摘要
console.log('\n\n📋 各文档标注摘要：');
console.log('----------------------------------------');

batchResults.results.forEach((result, index) => {
  console.log(`\n${index + 1}. ${result.fileName}`);
  console.log(`   📋 案件编号: ${result.caseNumber || 'N/A'}`);
  console.log(`   📅 年份: ${result.year || 'N/A'}`);
  console.log(`   📄 类型: ${result.docType || 'N/A'}`);
  console.log(`   ⚖️ 法条: ${result.legalProvisions.slice(0, 3).join(', ')}${result.legalProvisions.length > 3 ? '...' : ''}`);
  console.log(`   👤 当事人: ${result.entities.persons.slice(0, 3).join(', ')}${result.entities.persons.length > 3 ? '...' : ''}`);
});

console.log('\n==========================================');
console.log('✅ 结构化标注测试完成！');
console.log('==========================================');
