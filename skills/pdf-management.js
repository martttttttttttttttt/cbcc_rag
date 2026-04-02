const fs = require('fs');
const path = require('path');
const multer = require('multer');
const express = require('express');

class PDFManagement {
  constructor(options = {}) {
    this.storageDir = options.storageDir || path.join(__dirname, '../backend/pdf_files');
    this.dbPath = options.dbPath || path.join(__dirname, '../backend/pdf_database.json');
    this.ensureDirectories();
    this.initDatabase();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  initDatabase() {
    if (!fs.existsSync(this.dbPath)) {
      const initialData = {
        uploadTime: new Date().toISOString(),
        files: []
      };
      fs.writeFileSync(this.dbPath, JSON.stringify(initialData, null, 2));
    }
  }

  readDB() {
    try {
      const data = fs.readFileSync(this.dbPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('读取数据库失败:', error.message);
      return { files: [] };
    }
  }

  writeDB(data) {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('写入数据库失败:', error.message);
      throw new Error('保存数据失败');
    }
  }

  async upload(params) {
    const { files, category = 'MMT' } = params;
    
    if (!files || files.length === 0) {
      throw new Error('没有收到上传的文件');
    }

    const uploadedFiles = [];
    const db = this.readDB();

    for (const filePath of files) {
      try {
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
          throw new Error(`文件不存在: ${filePath}`);
        }

        const originalName = path.basename(filePath);
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(originalName)}`;
        const destPath = path.join(this.storageDir, uniqueName);

        // 复制文件到存储目录
        fs.copyFileSync(filePath, destPath);

        // 检查是否已有同名文件
        const existingFile = db.files.find(f => f.originalName === originalName);
        if (existingFile) {
          // 删除旧文件记录
          db.files = db.files.filter(f => f.id !== existingFile.id);

          // 删除旧物理文件
          const oldFilePath = path.join(this.storageDir, existingFile.fileName);
          if (fs.existsSync(oldFilePath)) {
            try {
              fs.unlinkSync(oldFilePath);
            } catch (err) {
              console.error(`删除旧文件失败：${err.message}`);
            }
          }
        }

        const fileInfo = {
          id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
          originalName: originalName,
          fileName: uniqueName,
          filePath: path.join('/', 'pdf', uniqueName),
          mimeType: 'application/pdf',
          size: fs.statSync(filePath).size,
          category: category,
          uploadTime: new Date().toISOString(),
          uploadTimestamp: Date.now(),
          content: ''
        };

        db.files.unshift(fileInfo);

        uploadedFiles.push({
          success: true,
          fileId: fileInfo.id,
          originalName: fileInfo.originalName,
          category: fileInfo.category,
          size: fileInfo.size,
          overwritten: existingFile ? true : false,
          uploadTime: fileInfo.uploadTime,
          filePath: fileInfo.filePath
        });

      } catch (error) {
        uploadedFiles.push({
          success: false,
          error: error.message,
          filePath: filePath
        });
      }
    }

    db.uploadTime = new Date().toISOString();
    this.writeDB(db);

    return {
      success: uploadedFiles.every(f => f.success),
      total: uploadedFiles.length,
      files: uploadedFiles,
      category: category,
      message: `成功上传 ${uploadedFiles.filter(f => f.success).length} 个 PDF 文件！`
    };
  }

  list(params = {}) {
    const { category } = params;
    const db = this.readDB();

    let files = db.files || [];
    
    if (category) {
      files = files.filter(f => f.category === category);
    }

    return {
      success: true,
      total: files.length,
      files: files
    };
  }

  delete(params) {
    const { fileId } = params;
    let db = this.readDB();

    const fileIndex = db.files.findIndex(f => f.id === fileId);
    if (fileIndex === -1) {
      throw new Error('文件不存在');
    }

    const file = db.files[fileIndex];

    // 检查文件是否存在于文件系统
    const fullPath = path.join(this.storageDir, file.fileName);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // 从数据库中移除
    db.files[fileIndex].status = 'deleted';
    db.uploadTime = new Date().toISOString();

    this.writeDB(db);

    return {
      success: true,
      message: '文件已成功删除',
      fileId: fileId
    };
  }
}

module.exports = PDFManagement;