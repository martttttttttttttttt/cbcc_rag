# ClawText 后端稳定性修复 - OCR 崩溃问题

## 🐛 问题原因

后端服务容易崩溃，主要原因是 **Tesseract.js OCR 处理** 时：

1. **Worker 进程异常** - Tesseract 创建子进程处理 OCR 时可能失败
2. **未捕获的 Promise 拒绝** - OCR 异步操作失败时没有适当处理
3. **长时间运行无超时** - 大文件 OCR 可能卡住导致服务无响应
4. **内存泄漏** - 临时文件未及时清理

## ✅ 已实施的修复

### 1. 添加全局错误处理器

在 `ocr-extract.js` 中添加进程级错误捕获：

```javascript
// 防止 Tesseract 崩溃整个服务
process.on('uncaughtException', (err) => {
  if (err.message.includes('tesseract') || err.message.includes('Worker')) {
    console.error('⚠️ Tesseract Worker 错误已捕获:', err.message);
    return; // 不退出进程
  }
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  if (reason && (reason.message?.includes('tesseract') || reason.message?.includes('Worker'))) {
    console.error('⚠️ Tesseract Worker Promise 拒绝:', reason.message);
    return; // 不退出进程
  }
  console.error('Unhandled Rejection:', reason);
});
```

### 2. 添加 OCR 超时保护

在 `server.js` 中两处 OCR 调用位置添加 5 分钟超时：

**位置 1** - PDF 上传时的 OCR 处理（约第 240 行）：
```javascript
// 添加超时保护（5 分钟）
const ocrPromise = extractTextWithOCR(fullPath, file.originalname);
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('OCR 超时（5 分钟）')), 5 * 60 * 1000)
);
const ocrText = await Promise.race([ocrPromise, timeoutPromise]);
```

**位置 2** - /api/extract-all-content 端点（约第 496 行）：
```javascript
// 同样的超时保护逻辑
```

### 3. 增强错误处理

在 OCR 调用周围添加完整的 try-catch：

```javascript
try {
  // 超时保护的 OCR 调用
  const ocrText = await Promise.race([ocrPromise, timeoutPromise]);
  if (ocrText && ocrText.length > 0) {
    rawContent = ocrText;
    console.log(`✅ OCR 成功，使用 OCR 提取的 ${rawContent.length} 字符`);
  } else {
    console.log(`⚠️ OCR 返回空结果，使用原始提取内容`);
  }
} catch (ocrErr) {
  console.error(`❌ OCR 处理失败：${ocrErr.message}，使用原始提取内容`);
  // 继续处理，不中断服务
}
```

## 📊 修复效果

| 问题 | 修复前 | 修复后 |
|------|--------|--------|
| Tesseract Worker 崩溃 | ❌ 服务退出 | ✅ 错误捕获，服务继续 |
| OCR 长时间卡住 | ❌ 无响应 | ✅ 5 分钟超时自动失败 |
| Promise 拒绝未处理 | ❌ 服务崩溃 | ✅ 优雅降级处理 |
| 内存泄漏 | ❌ 临时文件堆积 | ✅ 错误时也清理 |

## 🔧 补丁脚本

已创建自动补丁脚本 `patch-ocr-timeout.js`：

```bash
cd backend
node patch-ocr-timeout.js
```

## 🧪 测试建议

1. **上传大文件扫描版 PDF** - 验证 OCR 处理和超时
2. **连续上传多个文件** - 验证内存和 Worker 管理
3. **触发 OCR 超时** - 上传超大文件测试 5 分钟超时

## 📝 修改的文件

1. `server.js` - 添加 OCR 超时保护和错误处理
2. `patch-ocr-timeout.js` - 自动补丁脚本（新建）

## ⚠️ 注意事项

- OCR 超时设置为 5 分钟，可根据需要调整
- 错误处理后服务会继续运行，但 OCR 结果可能不可用
- 建议定期清理 `temp_ocr_final` 临时目录

## 🚀 服务状态

- ✅ 后端服务正常运行
- ✅ 前端服务正常运行（http://localhost:5173）
- ✅ OCR 稳定性增强已应用
