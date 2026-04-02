<template>
  <div class="pdf-list-container">
    <div class="list-header">
      <h1>📁 已上传的 PDF 文件</h1>
      <button @click="goBack" class="back-btn">← 返回聊天</button>
    </div>
    
    <div v-if="loading" class="loading">
      <p>正在加载文件列表...</p>
    </div>
    
    <div v-else-if="error" class="error">
      <p>❌ {{ error }}</p>
      <button @click="loadPDFFiles" class="retry-btn">重试</button>
    </div>
    
    <div v-else-if="pdfFiles.length === 0" class="empty-state">
      <p>📭 还没有上传任何 PDF 文件</p>
      <button @click="goBack" class="upload-hint-btn">去上传文件</button>
    </div>
    
    <div v-else class="pdf-list">
      <div 
        v-for="file in pdfFiles" 
        :key="file.id"
        class="pdf-item"
        :class="{ deleted: file.status === 'deleted' }"
      >
        <div class="file-info">
          <div class="file-name">
            <strong>{{ file.originalName }}</strong>
            <span v-if="file.status === 'deleted'" class="deleted-badge">已删除</span>
          </div>
          <div class="file-details">
            <span class="file-id">ID: {{ file.id }}</span>
            <span class="file-category">📁 {{ file.category || 'Other Type' }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
            <span class="upload-time">{{ formatDate(file.uploadTime) }}</span>
          </div>
          <div class="file-path">{{ file.filePath }}</div>
        </div>
        <div class="file-actions">
          <button 
            v-if="file.status !== 'deleted'"
            @click="deleteFile(file.id)" 
            class="delete-btn"
          >
            🗑️ 删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PDFList',
  data() {
    return {
      pdfFiles: [],
      loading: false,
      error: null
    }
  },
  methods: {
    async loadPDFFiles() {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await fetch('http://localhost:3000/api/pdf-files');
        const result = await response.json();
        
        if (response.ok && result.success) {
          this.pdfFiles = result.files || [];
        } else {
          this.error = result.error || '获取文件列表失败';
        }
      } catch (error) {
        console.error('Load PDF files error:', error);
        this.error = '网络错误：' + error.message;
      } finally {
        this.loading = false;
      }
    },
    
    goBack() {
      this.$router.push('/');
    },
    
    async deleteFile(fileId) {
      if (!confirm('确定要删除这个文件吗？此操作无法撤销。')) {
        return;
      }
      
      try {
        const response = await fetch(`http://localhost:3000/api/pdf-files/${fileId}`, {
          method: 'DELETE'
        });
        const result = await response.json();
        
        if (response.ok && result.success) {
          // 更新本地列表
          const index = this.pdfFiles.findIndex(f => f.id === fileId);
          if (index !== -1) {
            this.pdfFiles[index].status = 'deleted';
          }
          alert('文件已成功删除！');
        } else {
          alert('删除失败：' + (result.error || '未知错误'));
        }
      } catch (error) {
        console.error('Delete file error:', error);
        alert('删除过程中发生错误：' + error.message);
      }
    },
    
    formatFileSize(bytes) {
      if (!bytes && bytes !== 0) return 'Unknown';
      const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
      if (b === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(b) / Math.log(k));
      return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN');
    }
  },
  
  mounted() {
    this.loadPDFFiles();
  }
}
</script>

<style scoped>
.pdf-list-container {
  width: 100vw;
  height: 100vh;
  padding: 20px;
  background: white;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #eee;
}

.list-header h1 {
  font-size: 24px;
  color: #333;
  margin: 0;
}

.back-btn {
  padding: 8px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  transition: transform 0.2s ease;
}

.back-btn:hover {
  transform: translateY(-1px);
}

.loading, .error, .empty-state {
  text-align: center;
  padding: 40px 20px;
}

.loading p, .error p, .empty-state p {
  font-size: 18px;
  margin-bottom: 20px;
  color: #666;
}

.retry-btn, .upload-hint-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 24px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
}

.retry-btn:hover, .upload-hint-btn:hover {
  transform: translateY(-2px);
}

.pdf-list {
  flex: 1;
  overflow-y: auto;
}

.pdf-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  margin-bottom: 12px;
  background: #f9f9f9;
  border-radius: 12px;
  border-left: 4px solid #667eea;
  transition: all 0.3s ease;
}

.pdf-item:hover {
  background: #f0f0f0;
  transform: translateX(4px);
}

.pdf-item.deleted {
  opacity: 0.6;
  border-left-color: #ccc;
  background: #fafafa;
}

.file-info {
  flex: 1;
  margin-right: 16px;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.file-name strong {
  font-size: 16px;
  color: #333;
}

.deleted-badge {
  background: #ff6b6b;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.file-details {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
  flex-wrap: wrap;
}

.file-id, .file-size, .upload-time {
  white-space: nowrap;
}

.file-category {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  white-space: nowrap;
}

.file-path {
  font-size: 12px;
  color: #888;
  font-family: monospace;
  word-break: break-all;
}

.file-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.delete-btn {
  padding: 6px 12px;
  background: #ff6b6b;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
  transition: background 0.2s ease;
}

.delete-btn:hover {
  background: #ff5252;
}

/* 滚动条样式 */
.pdf-list::-webkit-scrollbar {
  width: 6px;
}

.pdf-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.pdf-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.pdf-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
