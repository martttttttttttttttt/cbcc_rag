<template>
  <div v-if="visible" class="category-modal-overlay">
    <div class="category-modal">
      <div class="modal-header">
        <h2>选择PDF分类</h2>
        <button class="close-btn" @click="close">×</button>
      </div>
      
      <div class="modal-body">
        <p class="modal-hint">请选择此PDF文件的分类：</p>
        
        <div class="category-options">
          <div 
            v-for="category in categories" 
            :key="category.value"
            class="category-option"
            :class="{ selected: selectedCategory === category.value }"
            @click="selectCategory(category.value)"
          >
            <div class="category-icon">
              {{ category.icon }}
            </div>
            <div class="category-info">
              <div class="category-name">{{ category.name }}</div>
              <div class="category-desc">{{ category.description }}</div>
            </div>
          </div>
        </div>
        
        <div class="selected-info" v-if="selectedCategory">
          <p>已选择：<strong>{{ getCategoryName(selectedCategory) }}</strong></p>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="cancel-btn" @click="close">取消</button>
        <button 
          class="confirm-btn" 
          @click="confirm"
          :disabled="!selectedCategory"
        >
          确认上传
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CategoryModal',
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      selectedCategory: null,
      categories: [
        {
          value: 'MMT',
          name: 'MMT 管理',
          icon: '📋',
          description: '管理相关文档、报告和计划'
        },
        {
          value: 'SFAT',
          name: 'SFAT 技术',
          icon: '🔧',
          description: '技术文档、API文档和规范'
        }
      ]
    }
  },
  methods: {
    selectCategory(category) {
      this.selectedCategory = category;
    },
    
    getCategoryName(value) {
      const category = this.categories.find(c => c.value === value);
      return category ? category.name : value;
    },
    
    confirm() {
      if (this.selectedCategory) {
        this.$emit('confirm', this.selectedCategory);
        this.reset();
      }
    },
    
    close() {
      this.$emit('close');
      this.reset();
    },
    
    reset() {
      this.selectedCategory = null;
    }
  },
  
  watch: {
    visible(newVal) {
      if (!newVal) {
        this.reset();
      }
    }
  }
}
</script>

<style scoped>
.category-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.category-modal {
  width: 500px;
  max-width: 90%;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  animation: slideIn 0.3s ease-out;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h2 {
  margin: 0;
  color: #333;
  font-size: 20px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #999;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.close-btn:hover {
  background-color: #f5f5f5;
}

.modal-body {
  padding: 20px;
}

.modal-hint {
  margin: 0 0 20px 0;
  color: #666;
  font-size: 14px;
}

.category-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.category-option {
  display: flex;
  align-items: center;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.category-option:hover {
  border-color: #667eea;
  background-color: #f8f9ff;
}

.category-option.selected {
  border-color: #667eea;
  background-color: #f0f4ff;
}

.category-icon {
  font-size: 28px;
  margin-right: 16px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
}

.category-info {
  flex: 1;
}

.category-name {
  font-weight: 600;
  font-size: 16px;
  color: #333;
  margin-bottom: 4px;
}

.category-desc {
  font-size: 14px;
  color: #666;
  line-height: 1.4;
}

.selected-info {
  padding: 12px;
  background-color: #f8f9ff;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.selected-info p {
  margin: 0;
  color: #333;
  font-size: 14px;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.cancel-btn, .confirm-btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.cancel-btn {
  background-color: #f5f5f5;
  color: #666;
}

.cancel-btn:hover {
  background-color: #e0e0e0;
}

.confirm-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.confirm-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 600px) {
  .category-modal {
    max-width: 95%;
  }
  
  .category-option {
    flex-direction: column;
    text-align: center;
  }
  
  .category-icon {
    margin-right: 0;
    margin-bottom: 12px;
  }
  
  .modal-footer {
    flex-direction: column;
  }
  
  .cancel-btn, .confirm-btn {
    width: 100%;
  }
}
</style>