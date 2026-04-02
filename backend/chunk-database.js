/**
 * ClawText 分块数据库管理模块
 * 
 * 功能：
 * 1. 分块数据存储
 * 2. 分块索引管理
 * 3. 元数据管理
 * 4. 缓存管理
 */

const fs = require('fs');
const path = require('path');

// ============================================
// 配置
// ============================================
const DB_CONFIG = {
  // 主数据库文件
  mainDbPath: path.join(__dirname, 'pdf_database.json'),
  // 分块数据库文件
  chunksDbPath: path.join(__dirname, 'chunks_database.json'),
  // 元数据数据库文件
  metadataDbPath: path.join(__dirname, 'metadata_database.json'),
  // 向量缓存目录
  vectorCacheDir: path.join(__dirname, 'vector_cache'),
  // 启用缓存
  enableCache: true
};

// 确保目录存在
[DB_CONFIG.vectorCacheDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============================================
// 数据库初始化
// ============================================

/**
 * 初始化分块数据库
 */
function initChunkDatabase() {
  if (!fs.existsSync(DB_CONFIG.chunksDbPath)) {
    const initialData = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalChunks: 0,
      totalDocs: 0,
      chunks: [],
      docIndex: {} // docId -> chunkIds 映射
    };
    fs.writeFileSync(DB_CONFIG.chunksDbPath, JSON.stringify(initialData, null, 2));
    console.log('✅ 分块数据库已初始化');
  }
}

/**
 * 初始化元数据数据库
 */
function initMetadataDatabase() {
  if (!fs.existsSync(DB_CONFIG.metadataDbPath)) {
    const initialData = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      documents: {} // docId -> metadata
    };
    fs.writeFileSync(DB_CONFIG.metadataDbPath, JSON.stringify(initialData, null, 2));
    console.log('✅ 元数据数据库已初始化');
  }
}

// ============================================
// 分块数据库操作
// ============================================

/**
 * 读取分块数据库
 * @returns {object} 分块数据库
 */
function readChunkDB() {
  try {
    const data = fs.readFileSync(DB_CONFIG.chunksDbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ 读取分块数据库失败:', error.message);
    return { chunks: [], docIndex: {} };
  }
}

/**
 * 写入分块数据库
 * @param {object} data - 数据
 */
function writeChunkDB(data) {
  try {
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_CONFIG.chunksDbPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('❌ 写入分块数据库失败:', error.message);
    throw new Error('保存分块数据失败');
  }
}

/**
 * 读取元数据数据库
 * @returns {object} 元数据数据库
 */
function readMetadataDB() {
  try {
    const data = fs.readFileSync(DB_CONFIG.metadataDbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ 读取元数据数据库失败:', error.message);
    return { documents: {} };
  }
}

/**
 * 写入元数据数据库
 * @param {object} data - 数据
 */
function writeMetadataDB(data) {
  try {
    fs.writeFileSync(DB_CONFIG.metadataDbPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('❌ 写入元数据数据库失败:', error.message);
    throw new Error('保存元数据失败');
  }
}

// ============================================
// 分块操作
// ============================================

/**
 * 存储文档分块
 * @param {string} docId - 文档 ID
 * @param {Array} chunks - 分块数组
 * @param {object} metadata - 元数据
 * @returns {object} 存储结果
 */
function storeChunks(docId, chunks, metadata = {}) {
  const db = readChunkDB();
  const metaDb = readMetadataDB();
  
  // 删除旧分块（如果存在）
  const existingChunkIds = db.docIndex[docId] || [];
  db.chunks = db.chunks.filter(c => !existingChunkIds.includes(c.chunkId));
  
  // 添加新分块
  chunks.forEach(chunk => {
    chunk.storedAt = new Date().toISOString();
    db.chunks.push(chunk);
  });
  
  // 更新文档索引
  const newChunkIds = chunks.map(c => c.chunkId);
  db.docIndex[docId] = newChunkIds;
  
  // 更新统计
  db.totalChunks = db.chunks.length;
  db.totalDocs = Object.keys(db.docIndex).length;
  
  // 存储元数据
  metaDb.documents[docId] = {
    ...metadata,
    chunkCount: chunks.length,
    chunkIds: newChunkIds,
    updatedAt: new Date().toISOString()
  };
  
  // 写入数据库
  writeChunkDB(db);
  writeMetadataDB(metaDb);
  
  console.log(`✅ 存储 ${chunks.length} 个分块，文档：${docId}`);
  
  return {
    success: true,
    docId,
    chunkCount: chunks.length,
    chunkIds: newChunkIds
  };
}

/**
 * 获取文档的所有分块
 * @param {string} docId - 文档 ID
 * @returns {Array} 分块数组
 */
function getChunksByDoc(docId) {
  const db = readChunkDB();
  const chunkIds = db.docIndex[docId] || [];
  return db.chunks.filter(c => chunkIds.includes(c.chunkId));
}

/**
 * 获取单个分块
 * @param {string} chunkId - 分块 ID
 * @returns {object|null} 分块
 */
function getChunk(chunkId) {
  const db = readChunkDB();
  return db.chunks.find(c => c.chunkId === chunkId) || null;
}

/**
 * 获取所有分块
 * @returns {Array} 所有分块
 */
function getAllChunks() {
  const db = readChunkDB();
  return db.chunks;
}

/**
 * 删除文档分块
 * @param {string} docId - 文档 ID
 * @returns {object} 删除结果
 */
function deleteChunks(docId) {
  const db = readChunkDB();
  const metaDb = readMetadataDB();
  
  const chunkIds = db.docIndex[docId] || [];
  const deletedCount = db.chunks.filter(c => chunkIds.includes(c.chunkId)).length;
  
  db.chunks = db.chunks.filter(c => !chunkIds.includes(c.chunkId));
  delete db.docIndex[docId];
  delete metaDb.documents[docId];
  
  db.totalChunks = db.chunks.length;
  db.totalDocs = Object.keys(db.docIndex).length;
  
  writeChunkDB(db);
  writeMetadataDB(metaDb);
  
  console.log(`✅ 删除 ${deletedCount} 个分块，文档：${docId}`);
  
  return {
    success: true,
    docId,
    deletedCount
  };
}

// ============================================
// 元数据操作
// ============================================

/**
 * 获取文档元数据
 * @param {string} docId - 文档 ID
 * @returns {object|null} 元数据
 */
function getMetadata(docId) {
  const metaDb = readMetadataDB();
  return metaDb.documents[docId] || null;
}

/**
 * 更新文档元数据
 * @param {string} docId - 文档 ID
 * @param {object} metadata - 元数据
 * @returns {object} 更新结果
 */
function updateMetadata(docId, metadata) {
  const metaDb = readMetadataDB();
  
  if (!metaDb.documents[docId]) {
    metaDb.documents[docId] = {};
  }
  
  metaDb.documents[docId] = {
    ...metaDb.documents[docId],
    ...metadata,
    updatedAt: new Date().toISOString()
  };
  
  writeMetadataDB(metaDb);
  
  return { success: true, docId };
}

/**
 * 获取所有文档元数据
 * @returns {object} 所有文档元数据
 */
function getAllMetadata() {
  const metaDb = readMetadataDB();
  return metaDb.documents;
}

// ============================================
// 搜索和查询
// ============================================

/**
 * 按关键词搜索分块
 * @param {string} keyword - 关键词
 * @param {number} limit - 限制数量
 * @returns {Array} 匹配的分块
 */
function searchChunksByKeyword(keyword, limit = 20) {
  const db = readChunkDB();
  const regex = new RegExp(keyword, 'gi');
  
  const matches = db.chunks
    .filter(c => regex.test(c.content))
    .sort((a, b) => {
      // 按关键词出现次数排序
      const countA = (c.content.match(regex) || []).length;
      const countB = (b.content.match(regex) || []).length;
      return countB - countA;
    })
    .slice(0, limit);
  
  return matches;
}

/**
 * 按类别筛选分块
 * @param {string} category - 类别
 * @returns {Array} 分块数组
 */
function getChunksByCategory(category) {
  const db = readChunkDB();
  return db.chunks.filter(c => c.category === category);
}

/**
 * 获取统计信息
 * @returns {object} 统计信息
 */
function getStats() {
  const db = readChunkDB();
  const metaDb = readMetadataDB();
  
  const categoryStats = {};
  db.chunks.forEach(chunk => {
    const cat = chunk.category || 'unknown';
    categoryStats[cat] = (categoryStats[cat] || 0) + 1;
  });
  
  return {
    totalChunks: db.totalChunks,
    totalDocs: db.totalDocs,
    categoryStats,
    avgChunksPerDoc: db.totalDocs > 0 ? (db.totalChunks / db.totalDocs).toFixed(2) : 0,
    updatedAt: db.updatedAt
  };
}

// ============================================
// 缓存管理
// ============================================

/**
 * 清除过期缓存
 */
function clearExpiredCache() {
  const cacheDir = DB_CONFIG.vectorCacheDir;
  const expiryMs = 24 * 60 * 60 * 1000; // 24 小时
  const now = Date.now();
  
  if (!fs.existsSync(cacheDir)) return;
  
  const files = fs.readdirSync(cacheDir);
  let cleared = 0;
  
  files.forEach(file => {
    if (file.endsWith('.json')) {
      const filePath = path.join(cacheDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtimeMs > expiryMs) {
        fs.unlinkSync(filePath);
        cleared++;
      }
    }
  });
  
  if (cleared > 0) {
    console.log(`🧹 清除 ${cleared} 个过期缓存文件`);
  }
}

/**
 * 清除所有缓存
 */
function clearAllCache() {
  const cacheDir = DB_CONFIG.vectorCacheDir;
  
  if (!fs.existsSync(cacheDir)) return 0;
  
  const files = fs.readdirSync(cacheDir);
  let cleared = 0;
  
  files.forEach(file => {
    if (file.endsWith('.json')) {
      fs.unlinkSync(path.join(cacheDir, file));
      cleared++;
    }
  });
  
  console.log(`🧹 清除 ${cleared} 个缓存文件`);
  return cleared;
}

// ============================================
// 导出
// ============================================

// 初始化数据库
initChunkDatabase();
initMetadataDatabase();

module.exports = {
  DB_CONFIG,
  // 分块操作
  storeChunks,
  getChunksByDoc,
  getChunk,
  getAllChunks,
  deleteChunks,
  // 元数据操作
  getMetadata,
  updateMetadata,
  getAllMetadata,
  // 搜索
  searchChunksByKeyword,
  getChunksByCategory,
  // 统计
  getStats,
  // 缓存
  clearExpiredCache,
  clearAllCache,
  // 数据库读写
  readChunkDB,
  writeChunkDB,
  readMetadataDB,
  writeMetadataDB
};
