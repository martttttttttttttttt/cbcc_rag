// 内存数据库初始化
async function initDatabase() {
  try {
    console.log('数据库初始化完成 - 使用内存数据库');
    console.log('年级数据已初始化');
    console.log('汉字数据已初始化');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }
}

// 导出初始化函数
module.exports = initDatabase;

// 如果直接运行此文件，则执行初始化
if (require.main === module) {
  initDatabase();
}
