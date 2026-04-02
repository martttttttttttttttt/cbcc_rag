# ClawText PDF 检索系统 - 智能问题分类优化报告

**日期：** 2026-03-05  
**优化目标：** 智能识别不同类型问题，针对性优化回答格式

---

## 🎯 问题描述

用户需要系统能够：
1. **智能识别问题类型**（法院评论、制裁查询、法律条款、比较分析等）
2. **针对性生成回答**（每种类型有专用格式）
3. **保持格式一致性**（同类问题回答格式统一）

---

## 🔧 优化措施

### 1. 智能问题分类系统

**位置：** `backend/server.js`

```javascript
const QUESTION_PATTERNS = {
  COURT_COMMENT: {
    keywords: ['court comment', 'tribunal comments', '法院评论', ...],
    weight: 5,
    strategy: 'COURT_COMMENT'
  },
  SANCTION: {
    keywords: ['sanction', 'penalty', '处罚', '制裁', ...],
    weight: 4,
    strategy: 'SANCTION'
  },
  LEGAL_PROVISION: {
    keywords: ['section', 'article', '条款', '释义', ...],
    weight: 4,
    strategy: 'LEGAL_PROVISION'
  },
  COMPARISON: {
    keywords: ['differ', 'compare', '区别', '比较', ...],
    weight: 4,
    strategy: 'COMPARISON'
  },
  FACT_QUERY: {
    keywords: ['what', 'when', 'where', '什么', '何时', ...],
    weight: 3,
    strategy: 'FACT_QUERY'
  },
  PROCEDURE: {
    keywords: ['procedure', 'how to', '程序', '流程', ...],
    weight: 4,
    strategy: 'PROCEDURE'
  },
  INTERLOCUTORY: {
    keywords: ['interlocutory', 'procedural', '程序', '临时', ...],
    weight: 4,
    strategy: 'INTERLOCUTORY'
  }
};

function classifyQuestion(question) {
  // 计算每种问题类型的得分
  // 返回得分最高的类型
}
```

**作用：** 根据关键词权重自动识别问题类型。

---

### 2. 针对性 Prompt 生成

```javascript
function buildPromptForQuestionType(question, context, questionType) {
  const typePrompts = {
    COURT_COMMENT: `【任务类型：法院评论识别】...`,
    SANCTION: `【任务类型：制裁/处罚查询】...`,
    LEGAL_PROVISION: `【任务类型：法律条款解释】...`,
    // ... 其他类型
  };
  
  return baseSystemPrompt + typePrompts[questionType.strategy] + constraints;
}
```

**每种类型的标准格式：**

| 类型 | 格式特点 |
|------|----------|
| COURT_COMMENT | `Based on the document:` + 5 要点 + `In summary` |
| SANCTION | 制裁类型 + 法律依据 + 原因 + 期限 |
| LEGAL_PROVISION | 条款原文 + 含义解释 + 适用情况 |
| COMPARISON | 相同点 + 不同点对比 |
| PROCEDURE | Step 1/2/3 + 注意事项 |
| FACT_QUERY | 直接回答 + 关键事实列表 |
| INTERLOCUTORY | 文档列表 + 程序事项描述 |

---

### 3. 上下文容量优化

**修改后配置：**
```javascript
const MAX_TOTAL_CHUNKS = 30;      // +50%
const MAX_TOTAL_CHARS = 80000;    // +60%
const MAX_CHARS_PER_DOC = 25000;  // +67%
```

---

## 📊 测试结果

### 测试 1：法院评论问题

**问题：**
```
Is there any comments from the court about the route by which 
we have exercised our disciplinary powers?
```

**分类结果：**
```
🧠 问题分类：COURT_COMMENT (得分：10, 策略：COURT_COMMENT)
```

**答案格式：** ✅ 完全符合标准
```
Based on the document: SFAT 2021-5 Determination (f).pdf
The court has commented extensively on the route by which disciplinary 
powers are exercised. Below are the relevant points:

**Identification of the Legal Route**: ... (§27)
**Clarity on the Trigger**: ... (§28)
**Distinct Routes for Misconduct**: ... (§30)
**Failure to Explain**: ... (§33)
**Criticism of "and/or" Usage**: ... (§39)

In summary, the court has emphasized the necessity for the SFC to 
clearly identify and explain the specific legal route...
```

---

## 🎉 优化总结

| 优化项 | 效果 |
|--------|------|
| 智能问题分类 | ✅ 7 种问题类型自动识别 |
| 针对性 Prompt | ✅ 每种类型专用格式 |
| 法院评论优化 | ✅ 5 要点 + 标准格式 |
| 上下文容量 | ✅ 80K 总字符 |
| 关键词权重 | ✅ 精准检索 |

---

## 📝 后续计划

1. ✅ 法院评论类 - 已完成
2. ⏳ 制裁查询类 - 待测试
3. ⏳ 法律条款类 - 待测试
4. ⏳ 比较分析类 - 待测试
5. ⏳ 程序流程类 - 待测试

---

**优化完成时间：** 2026-03-05 23:45  
**测试状态：** ✅ 法院评论类通过
