<template>
  <div class="chat-container">
    <div class="chat-header">
      <h1>ClawText 对话 🔍</h1>
      <div class="info-bar">
        <span class="info-badge">✨ 术语权重检索</span>
        <span class="info-badge">📦 智能分块</span>
        <span class="info-badge">📁 文档级过滤</span>
        <label class="ai-toggle" title="启用 AI 大模型分析（千问）">
          <input type="checkbox" v-model="useAIEnhancement" />
          <span class="ai-badge" :class="{ active: useAIEnhancement }">🤖 AI 增强</span>
        </label>
      </div>
      <div class="document-filter-section" v-if="documents.length > 0">
        <span class="category-label">文档过滤：</span>
        <select v-model="selectedDocFilter" class="doc-filter-select" multiple>
          <option value="">全部文档</option>
          <option v-for="doc in documents" :key="doc.id" :value="doc.id">
            {{ doc.name }} ({{ doc.category }})
          </option>
        </select>
        <button @click="loadDocuments" class="refresh-btn" title="刷新文档列表">🔄</button>
      </div>
      <div class="upload-section">
        <input 
          type="file" 
          ref="fileInput"
          accept=".pdf"
          multiple
          @change="handleFileSelect"
          style="display: none;"
        />
        <button @click="triggerFileInput" class="upload-btn">
          📎 选择 PDF
        </button>
        <span v-if="selectedFiles.length > 0" class="file-name">
          已选择 {{ selectedFiles.length }} 个文件
        </span>
        <button 
          v-if="selectedFiles.length > 0" 
          @click="uploadPDFs" 
          class="upload-confirm-btn"
        >
          🚀 上传到服务器
        </button>
        <button @click="viewPDFList" class="list-btn">
          📋 查看 PDF 列表
        </button>
        <button @click="clearChatHistory" class="clear-history-btn" title="清除聊天记录">
          🗑️ 清除历史
        </button>
      </div>
    </div>
    <div class="chat-messages" ref="messagesContainer">
      <div 
        v-for="(message, index) in messages" 
        :key="index" 
        :class="['message', message.sender]"
      >
        <div class="message-content">{{ message.text }}</div>
        <div class="message-time">{{ message.time }}</div>
      </div>
    </div>
    <div class="chat-input">
      <input 
        v-model="inputMessage" 
        @keyup.enter="sendMessage" 
        placeholder="输入消息..."
        type="text"
      />
      <button @click="sendMessage">发送</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Chat',
  data() {
    return {
      messages: [],
      inputMessage: '',
      selectedFiles: [],
      selectedDocFilter: '',
      documents: [],
      useAIEnhancement: true, // 默认启用 AI 增强
      isLoading: false,       // 加载状态
      loadingStartTime: 0,    // 加载开始时间
      STORAGE_KEY: 'clawtext_chat_history'
    }
  },
  methods: {
    getCurrentTime() {
      const now = new Date();
      return now.getHours().toString().padStart(2, '0') + ':' + 
             now.getMinutes().toString().padStart(2, '0');
    },
    
    triggerFileInput() {
      this.$refs.fileInput.click();
    },
    
    handleFileSelect(event) {
      const files = Array.from(event.target.files);
      if (files.length === 0) return;
      
      // 验证所有文件
      const validFiles = [];
      for (const file of files) {
        // 验证文件类型
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          this.addBotMessage(`⚠️ 跳过非 PDF 文件：${file.name}`);
          continue;
        }
        
        // 无文件大小限制 - 由服务器决定
        validFiles.push(file);
      }
      
      if (validFiles.length > 0) {
        this.selectedFiles = validFiles;
        const fileNames = validFiles.map(f => f.name).join(', ');
        this.addUserMessage(`已选择 ${validFiles.length} 个文件：${fileNames}`);
      }
    },
    
    addUserMessage(text) {
      this.messages.push({
        sender: 'user',
        text: text,
        time: this.getCurrentTime()
      });
      this.saveToHistory();
      this.scrollToBottom();
    },
    
    addBotMessage(text) {
      this.messages.push({
        sender: 'bot',
        text: text,
        time: this.getCurrentTime()
      });
      this.saveToHistory();
      this.scrollToBottom();
    },
    
    saveToHistory() {
      try {
        // 只保存最近 100 条消息，避免 localStorage 过大
        const messagesToSave = this.messages.slice(-100);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(messagesToSave));
      } catch (e) {
        console.warn('保存聊天记录失败:', e);
      }
    },
    
    loadFromHistory() {
      try {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
          const history = JSON.parse(saved);
          if (Array.isArray(history) && history.length > 0) {
            this.messages = history;
            console.log(`📜 加载了 ${history.length} 条历史消息`);
            return true;
          }
        }
      } catch (e) {
        console.warn('加载聊天记录失败:', e);
      }
      return false;
    },
    
    clearHistory() {
      try {
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('聊天记录已清空');
      } catch (e) {
        console.warn('清空聊天记录失败:', e);
      }
    },
    
    async uploadPDFs() {
      if (this.selectedFiles.length === 0) {
        this.addBotMessage('请先选择 PDF 文件！');
        return;
      }
      
      // 显示选择类型的对话框 - 二选一
      const confirmMsg = `请选择这 ${this.selectedFiles.length} 个 PDF 文件的类型：\n\n点击"确定"选择 MMT\n点击"取消"选择 SFAT`;
      const isMMT = confirm(confirmMsg);
      
      const category = isMMT ? 'MMT' : 'SFAT';
      this.addBotMessage(`正在上传 ${this.selectedFiles.length} 个 PDF 文件到服务器（类型：${category}）...`);
      
      // 批量上传所有文件
      let successCount = 0;
      let failCount = 0;
      
      for (const file of this.selectedFiles) {
        const formData = new FormData();
        formData.append('pdfFiles', file);
        formData.append('category', category);
        
        try {
          const response = await fetch('http://localhost:3000/api/upload-pdf', {
            method: 'POST',
            body: formData
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            successCount++;
            console.log(`✅ 上传成功：${file.name}`);
          } else {
            failCount++;
            console.error(`❌ 上传失败：${file.name} - ${result.error}`);
          }
        } catch (error) {
          failCount++;
          console.error(`❌ 上传错误：${file.name} - ${error.message}`);
        }
      }
      
      // 播放音乐提醒
      if (successCount > 0) {
        this.playMusicReminder(`PDF 批量上传完成：${successCount} 个文件`);
      }
      
      this.addBotMessage(`📊 批量上传完成！\n✅ 成功：${successCount} 个\n❌ 失败：${failCount} 个\n类型：${category}`);
      
      // 清除已选择的文件
      this.selectedFiles = [];
      this.$refs.fileInput.value = '';
    },
    
    playMusicReminder(taskName) {
      // 使用 Windows 命令调用音乐提醒脚本
      try {
        const { exec } = require('child_process');
        const musicRemindPath = 'D:\\ClawWork\\music_reminder.bat';
        
        exec(`start cmd /c "${musicRemindPath}" "${taskName}"`, (error) => {
          if (error) {
            console.log('音乐提醒已关闭或未安装 Node.js');
          }
        });
      } catch (e) {
        console.log('音乐提醒未加载');
      }
    },
    
    viewPDFList() {
      // 使用 Vue Router 跳转到 PDF 列表页面
      this.$router.push('/pdf-list');
    },
    
    clearChatHistory() {
      if (confirm('确定要清除所有聊天记录吗？\n\n此操作不可恢复！')) {
        this.clearHistory();
        this.messages = [];
        this.addBotMessage('你好！我是 ClawText 助手 🤖\n\n✨ 增强功能：\n• 术语权重检索 - 法律核心术语（court comments, disciplinary powers 等）自动加权\n• 智能分块 - 保留法律文本结构（§、Section 等标号）\n• 文档级过滤 - 可指定搜索特定文档\n• 💾 聊天记录自动保存\n\n💡 使用顶部下拉框选择文档过滤，然后输入问题！');
      }
    },
    
    async sendMessage() {
      if (this.inputMessage.trim() === '') return;

      // 添加用户消息
      this.addUserMessage(this.inputMessage);

      const userMessage = this.inputMessage;
      this.inputMessage = '';

      // 检查是否是上传命令
      if (userMessage.toLowerCase().includes('上传') && userMessage.toLowerCase().includes('pdf')) {
        if (this.selectedFiles.length > 0) {
          this.uploadPDFs();
        } else {
          this.addBotMessage('请先选择一个 PDF 文件，然后点击"🚀 上传到服务器"按钮。');
        }
        return;
      }

      // 检查是否是要查看 PDF 列表
      if (userMessage.toLowerCase().includes('列表') || userMessage.toLowerCase().includes('查看 pdf')) {
        this.addBotMessage('点击上方的"📋 查看 PDF 列表"按钮可以查看所有已上传的 PDF 文件。');
        return;
      }

      // 智能问答 - 调用后端 API
      this.isLoading = true;
      this.loadingStartTime = Date.now();
      this.addBotMessage('🤔 正在搜索 PDF 内容...');

      try {
        const requestBody = {
          message: userMessage
        };

        // 添加文档过滤
        if (this.selectedDocFilter && this.selectedDocFilter !== '') {
          requestBody.docFilter = [this.selectedDocFilter];
        }

        // 构建 URL，如果启用 AI 增强则添加参数
        const chatUrl = this.useAIEnhancement
          ? 'http://localhost:3000/api/chat?ai=true'
          : 'http://localhost:3000/api/chat';

        const response = await fetch(chatUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        const result = await response.json();

        // 移除"正在搜索"消息
        this.messages.pop();

        // 计算响应时间
        const duration = Date.now() - this.loadingStartTime;
        this.isLoading = false;

        if (result.success) {
          // 如果是缓存命中的答案
          if (result.cached) {
            this.addBotMessage(`⚡ 缓存答案 (节省时间)\n\n${result.answer}`);
          } else {
            this.addBotMessage(`${result.answer}\n\n⏱️ 响应时间：${duration}ms`);
          }
          
          // 显示调试信息（如果有）
          if (result.debug) {
            let debugText = `\n🔍 **检索详情**:\n`;
            debugText += `   文档评分：${result.debug.queryTerms ? result.debug.queryTerms.map(t => `${t.term}(权重${t.weight})`).join(', ') : 'N/A'}\n`;
            debugText += `   匹配文档数：${result.totalDocuments || 0}\n`;
            this.addBotMessage(debugText);
          }

          // 显示来源信息
          if (result.sources && result.sources.length > 0) {
            let sourcesText = '\n📚 **来源文件**:\n';
            for (const src of result.sources) {
              sourcesText += `   • ${src.fileName} 【${src.category}】 - 相关性：${src.relevanceScore?.toFixed(0) || 'N/A'}\n`;
            }
            this.addBotMessage(sourcesText);
          }
        } else {
          this.addBotMessage(`❌ 回答失败：${result.error}`);
        }
      } catch (error) {
        // 移除"正在搜索"消息
        this.messages.pop();
        this.isLoading = false;
        console.error('Chat error:', error);
        this.addBotMessage('❌ 无法连接到后端服务器，请确保后端正在运行。\n错误详情：' + error.message);
      }
      
    },
    
    getBotResponse(message) {
      // 简单的响应逻辑
      const responses = [
        '这是一个很好的问题！',
        '让我想想...',
        '我理解你的意思了。',
        '谢谢你的消息！',
        '我会尽力帮助你。',
        '这是个有趣的观点！',
        '我收到了你的消息。'
      ];
      
      // 根据消息内容给出特定回复
      if (message.toLowerCase().includes('你好') || message.toLowerCase().includes('hello')) {
        return '你好！很高兴见到你！';
      }
      if (message.toLowerCase().includes('谢谢') || message.toLowerCase().includes('thank')) {
        return '不客气！随时为你效劳！';
      }
      if (message.toLowerCase().includes('再见') || message.toLowerCase().includes('bye')) {
        return '再见！期待下次聊天！';
      }
      if (message.toLowerCase().includes('pdf') || message.toLowerCase().includes('文件') || message.toLowerCase().includes('上传')) {
        return '你可以点击"选择 PDF"按钮来选择文件，然后点击"上传到服务器"按钮来上传 PDF 文件到后端数据库。\n也可以点击"📋 查看 PDF 列表"按钮查看所有已上传的文件。';
      }
      
      // 随机回复
      return responses[Math.floor(Math.random() * responses.length)];
    },
    
    scrollToBottom() {
      if (this.$refs.messagesContainer) {
        this.$refs.messagesContainer.scrollTop = this.$refs.messagesContainer.scrollHeight;
      }
    },
    
    // 加载文档列表
    async loadDocuments() {
      try {
        const response = await fetch('http://localhost:3000/api/documents');
        const result = await response.json();
        
        if (result.success) {
          this.documents = result.documents;
          console.log(`📄 加载了 ${this.documents.length} 个文档`);
        }
      } catch (error) {
        console.error('加载文档列表失败:', error);
      }
    }
  },
  
  mounted() {
    // 加载历史聊天记录
    const hasHistory = this.loadFromHistory();
    
    // 如果没有历史记录，显示欢迎消息
    if (!hasHistory) {
      this.addBotMessage('你好！我是 ClawText 助手 🤖\n\n✨ 增强功能：\n• 术语权重检索 - 法律核心术语（court comments, disciplinary powers 等）自动加权\n• 智能分块 - 保留法律文本结构（§、Section 等标号）\n• 文档级过滤 - 可指定搜索特定文档\n• 💾 聊天记录自动保存\n\n💡 使用顶部下拉框选择文档过滤，然后输入问题！');
    }
    
    // 从后端获取欢迎消息（可选）
    fetch('http://localhost:3000/api/hello')
      .then(response => response.json())
      .then(data => {
        console.log('Backend connected:', data);
      })
      .catch(error => {
        console.error('Error connecting to backend:', error);
      });
    
    // 加载文档列表
    this.loadDocuments();
    
    // 初始滚动到底部
    this.$nextTick(() => {
      this.scrollToBottom();
    });
  }
}
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: #f5f7fb;
  overflow: hidden;
}

/* 头部样式 */
.chat-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 15px 20px;
  text-align: center;
  width: 100%;
}

.chat-header h1 {
  font-size: 28px;
  margin: 0 0 15px 0;
  font-weight: 700;
}

.category-selector {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.category-label {
  font-size: 14px;
  opacity: 0.9;
}

.category-btn {
  padding: 6px 16px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.category-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.8);
}

.category-btn.active {
  background: white;
  color: #667eea;
  border-color: white;
  font-weight: bold;
}

.info-bar {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.info-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  color: white;
  backdrop-filter: blur(5px);
}

.document-filter-section {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.doc-filter-select {
  padding: 6px 12px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  font-size: 13px;
  min-width: 200px;
  max-width: 300px;
  outline: none;
  transition: all 0.3s ease;
}

.doc-filter-select:focus {
  border-color: white;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
}

.refresh-btn {
  padding: 6px 12px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.4);
  transform: rotate(90deg);
}

/* AI 增强开关 */
.ai-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.ai-toggle input[type="checkbox"] {
  display: none;
}

.ai-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.ai-badge.active {
  background: rgba(76, 201, 240, 0.4);
  color: #fff;
  border-color: rgba(76, 201, 240, 0.6);
  box-shadow: 0 0 10px rgba(76, 201, 240, 0.5);
}

.ai-badge:hover {
  transform: translateY(-1px);
}

.upload-section {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.upload-btn, .upload-confirm-btn, .list-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-btn {
  background: rgba(255, 255, 255, 0.3);
  color: white;
  backdrop-filter: blur(10px);
}

.upload-btn:hover {
  background: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
}

.upload-confirm-btn {
  background: white;
  color: #667eea;
}

.upload-confirm-btn:hover {
  background: #f8f9fa;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.list-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.list-btn:hover {
  background: rgba(255, 255, 255, 0.4);
  transform: translateY(-2px);
}

.clear-history-btn {
  background: rgba(255, 100, 100, 0.3);
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.clear-history-btn:hover {
  background: rgba(255, 100, 100, 0.6);
  transform: translateY(-2px);
}

.file-name {
  background: rgba(255, 255, 255, 0.2);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  color: white;
}

/* 消息区域 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: white;
  margin: 0;
  border-radius: 0;
  box-shadow: none;
}

.message {
  margin-bottom: 20px;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message.user {
  text-align: right;
}

.message.user .message-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 20px 20px 0 20px;
  padding: 12px 18px;
  display: inline-block;
  max-width: 70%;
  box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
}

.message.bot {
  text-align: left;
}

.message.bot .message-content {
  background: #f0f0f0;
  color: #333;
  border-radius: 20px 20px 20px 0;
  padding: 12px 18px;
  display: inline-block;
  max-width: 70%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.message-content {
  word-wrap: break-word;
  line-height: 1.6;
  white-space: pre-line;
  font-size: 15px;
}

.message-time {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

/* 输入区域 */
.chat-input {
  display: flex;
  gap: 10px;
  padding: 15px 20px;
  background: white;
  width: 100%;
  border-top: 1px solid #e0e0e0;
}

.chat-input input {
  flex: 1;
  padding: 12px 18px;
  border: 2px solid #e0e0e0;
  border-radius: 24px;
  font-size: 15px;
  outline: none;
  transition: border-color 0.3s ease;
}

.chat-input input:focus {
  border-color: #667eea;
}

.chat-input button {
  padding: 12px 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 24px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.chat-input button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
