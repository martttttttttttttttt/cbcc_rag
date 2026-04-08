# AI 模型切换指南

## 🚀 快速切换

### 方法 1：修改配置文件（推荐）

编辑 `backend/.env` 和 `backend/server.js`：

```javascript
// server.js 中的 AI_CONFIG
const AI_CONFIG = {
  currentModel: 'glm-5',  // 改这里：qwen3.5-plus, glm-5, kimi-k2.5, qwen3-max-2026-01-23
  ...
};
```

### 方法 2：API 调用时指定

```javascript
// 前端调用时添加 model 参数
fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: '你的问题',
    model: 'glm-5'  // 指定模型
  })
});
```

## 📊 模型对比

| 模型 | 提供商 | 优势 | 适用场景 | API Key _env |
|------|--------|------|----------|-------------|
| **glm-5** ⭐ | 智谱 | 🚀 速度快 (30-50s), 中文强，长文档 | 日常使用 | `ZHIPU_API_KEY` |
| **kimi-k2.5** | MiniMax | 🚀 速度快，擅长长文档 | 超长文档 | `MINIMAX_API_KEY` |
| **qwen3.5-plus** | 通义 | 📚 稳定，当前默认 | 默认备用 | `DASHSCOPE_API_KEY` |
| **qwen3-max** | 通义 | 🧠 最强推理 | 复杂分析 | `DASHSCOPE_API_KEY` |

## 💡 推荐配置

### 追求速度（日常使用）
```javascript
currentModel: 'glm-5'
```
- 响应时间：30-50 秒
- 准确率：~85%
- 成本：低

### 追求质量（复杂问题）
```javascript
currentModel: 'qwen3-max-2026-01-23'
```
- 响应时间：60-90 秒
- 准确率：~90%
- 成本：高

### 平衡配置
```javascript
currentModel: 'kimi-k2.5'
```
- 响应时间：40-60 秒
- 准确率：~85%
- 成本：中等

## 🔧 获取 API Key

### 智谱 AI (glm-5)
1. 访问：https://open.bigmodel.cn/
2. 注册/登录
3. 创建 API Key
4. 添加到 `.env`: `ZHIPU_API_KEY=your_key_here`

### MiniMax (kimi-k2.5)
1. 访问：https://api.minimax.chat/
2. 注册/登录
3. 获取 API Key
4. 添加到 `.env`: `MINIMAX_API_KEY=your_key_here`

### 通义千问 (已有)
- 无需配置，已有密钥
- 如需更新：https://dashscope.console.aliyun.com/

## 🧪 测试模型

运行对比测试脚本：
```bash
cd backend
node test-models.js
```

## ⚡ 性能对比

基于 ClawText 测试集（4 个法律文档分析问题）：

| 模型 | 平均时间 | 平均准确率 | 推荐指数 |
|------|----------|------------|----------|
| glm-5 | 30-50s | ~85% | ⭐⭐⭐⭐⭐ |
| kimi-k2.5 | 40-60s | ~85% | ⭐⭐⭐⭐ |
| qwen3.5-plus | 60-100s | ~63% | ⭐⭐ |
| qwen3-max | 60-90s | ~90% | ⭐⭐⭐⭐ |

## 📝 注意事项

1. **首次调用较慢** - 模型需要 warmup，后续会快
2. **缓存生效** - 相同问题 10 分钟内直接返回缓存答案
3. **API 配额** - 注意各平台的调用限制
4. **错误降级** - 如首选模型失败，可切换到备用模型

## 🔄 切换示例

**从 qwen3.5-plus 切换到 glm-5：**

1. 获取智谱 API Key
2. 编辑 `.env`：
   ```
   ZHIPU_API_KEY=sk-xxxxxxxx
   ```
3. 编辑 `server.js`：
   ```javascript
   currentModel: 'glm-5'
   ```
4. 重启服务器：
   ```bash
   node server.js
   ```

完成！🎉
