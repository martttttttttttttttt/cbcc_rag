// 内存数据库模拟
class Character {
  constructor() {
    this.characters = [
      // 一年级汉字（简单基础字）
      { id: 1, character: '一', pinyin: 'yī', audio: 'audio/yi.mp3', image: 'images/yi.png', description: '数字1，最小的正整数', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 2, character: '人', pinyin: 'rén', audio: 'audio/ren.mp3', image: 'images/ren.png', description: '人类，指能制造工具并使用工具进行劳动的高等动物', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 3, character: '口', pinyin: 'kǒu', audio: 'audio/kou.mp3', image: 'images/kou.png', description: '嘴巴，人和动物吃东西和发声的器官', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 4, character: '日', pinyin: 'rì', audio: 'audio/ri.mp3', image: 'images/ri.png', description: '太阳，太阳系的中心天体', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 5, character: '月', pinyin: 'yuè', audio: 'audio/yue.mp3', image: 'images/yue.png', description: '月亮，地球的天然卫星', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 6, character: '水', pinyin: 'shuǐ', audio: 'audio/shui.mp3', image: 'images/shui.png', description: '水流，无色无味的透明液体', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 7, character: '火', pinyin: 'huǒ', audio: 'audio/huo.mp3', image: 'images/huo.png', description: '火焰，燃烧时产生的光和热', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 8, character: '土', pinyin: 'tǔ', audio: 'audio/tu.mp3', image: 'images/tu.png', description: '土地，地面的土壤', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 9, character: '木', pinyin: 'mù', audio: 'audio/mu.mp3', image: 'images/mu.png', description: '树木，植物的一种', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 10, character: '金', pinyin: 'jīn', audio: 'audio/jin.mp3', image: 'images/jin.png', description: '金属，一种有光泽、有延展性的物质', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 11, character: '田', pinyin: 'tián', audio: 'audio/tian.mp3', image: 'images/tian.png', description: '田地，种植农作物的土地', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 12, character: '禾', pinyin: 'hé', audio: 'audio/he.mp3', image: 'images/he.png', description: '禾苗，谷类植物的幼苗', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 13, character: '竹', pinyin: 'zhú', audio: 'audio/zhu.mp3', image: 'images/zhu.png', description: '竹子，一种多年生常绿植物', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 14, character: '山', pinyin: 'shān', audio: 'audio/shan.mp3', image: 'images/shan.png', description: '山峰，地面上由土石构成的隆起部分', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 15, character: '石', pinyin: 'shí', audio: 'audio/shi.mp3', image: 'images/shi.png', description: '石头，构成地壳的坚硬物质', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 16, character: '虫', pinyin: 'chóng', audio: 'audio/chong.mp3', image: 'images/chong.png', description: '昆虫，节肢动物的一类', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 17, character: '鱼', pinyin: 'yú', audio: 'audio/yu.mp3', image: 'images/yu.png', description: '鱼类，生活在水中的脊椎动物', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 18, character: '鸟', pinyin: 'niǎo', audio: 'audio/niao.mp3', image: 'images/niao.png', description: '鸟类，有羽毛和翅膀的脊椎动物', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 19, character: '马', pinyin: 'mǎ', audio: 'audio/ma.mp3', image: 'images/ma.png', description: '马匹，一种哺乳动物', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      { id: 20, character: '牛', pinyin: 'niú', audio: 'audio/niu.mp3', image: 'images/niu.png', description: '牛，一种哺乳动物，用于耕地或产奶', grade_id: 1, created_at: new Date(), updated_at: new Date() },
      
      // 二年级汉字（基础常用字）
      { id: 21, character: '天', pinyin: 'tiān', audio: 'audio/tian.mp3', image: 'images/tian.png', description: '天空，地球周围的广大空间', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 22, character: '地', pinyin: 'dì', audio: 'audio/di.mp3', image: 'images/di.png', description: '地面，地球的表面', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 23, character: '上', pinyin: 'shàng', audio: 'audio/shang.mp3', image: 'images/shang.png', description: '上面，位置在高处的', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 24, character: '下', pinyin: 'xià', audio: 'audio/xia.mp3', image: 'images/xia.png', description: '下面，位置在低处的', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 25, character: '大', pinyin: 'dà', audio: 'audio/da.mp3', image: 'images/da.png', description: '大小，面积、体积、容量等方面超过一般的', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 26, character: '小', pinyin: 'xiǎo', audio: 'audio/xiao.mp3', image: 'images/xiao.png', description: '大小，面积、体积、容量等方面小于一般的', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 27, character: '多', pinyin: 'duō', audio: 'audio/duo.mp3', image: 'images/duo.png', description: '多少，数量大的', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 28, character: '少', pinyin: 'shǎo', audio: 'audio/shao.mp3', image: 'images/shao.png', description: '多少，数量小的', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 29, character: '中', pinyin: 'zhōng', audio: 'audio/zhong.mp3', image: 'images/zhong.png', description: '中间，中心的位置', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 30, character: '国', pinyin: 'guó', audio: 'audio/guo.mp3', image: 'images/guo.png', description: '国家，一个国家的领土', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 31, character: '家', pinyin: 'jiā', audio: 'audio/jia.mp3', image: 'images/jia.png', description: '家庭，共同生活的亲属团体', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 32, character: '学', pinyin: 'xué', audio: 'audio/xue.mp3', image: 'images/xue.png', description: '学习，获取知识和技能的过程', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 33, character: '校', pinyin: 'xiào', audio: 'audio/xiao.mp3', image: 'images/xiao.png', description: '学校，进行教育的机构', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 34, character: '朋', pinyin: 'péng', audio: 'audio/peng.mp3', image: 'images/peng.png', description: '朋友，彼此有交情的人', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 35, character: '友', pinyin: 'yǒu', audio: 'audio/you.mp3', image: 'images/you.png', description: '朋友，彼此有交情的人', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 36, character: '父', pinyin: 'fù', audio: 'audio/fu.mp3', image: 'images/fu.png', description: '父亲，子女对爸爸的称呼', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 37, character: '母', pinyin: 'mǔ', audio: 'audio/mu.mp3', image: 'images/mu.png', description: '母亲，子女对妈妈的称呼', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 38, character: '儿', pinyin: 'ér', audio: 'audio/er.mp3', image: 'images/er.png', description: '儿子，男孩子', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 39, character: '女', pinyin: 'nǚ', audio: 'audio/nv.mp3', image: 'images/nv.png', description: '女儿，女孩子', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      { id: 40, character: '哥', pinyin: 'gē', audio: 'audio/ge.mp3', image: 'images/ge.png', description: '哥哥，年长的兄弟', grade_id: 2, created_at: new Date(), updated_at: new Date() },
      
      // 三年级汉字（常用字）
      { id: 41, character: '学', pinyin: 'xué', audio: 'audio/xue.mp3', image: 'images/xue.png', description: '学习，获取知识和技能的过程', grade_id: 3, created_at: new Date(), updated_at: new Date() },
      { id: 42, character: '习', pinyin: 'xí', audio: 'audio/xi.mp3', image: 'images/xi.png', description: '学习，反复练习', grade_id: 3, created_at: new Date(), updated_at: new Date() },
      { id: 43, character: '知', pinyin: 'zhī', audio: 'audio/zhi.mp3', image: 'images/zhi.png', description: '知识，知道的信息', grade_id: 3, created_at: new Date(), updated_at: new Date() },
      { id: 44, character: '识', pinyin: 'shí', audio: 'audio/shi.mp3', image: 'images/shi.png', description: '认识，识别', grade_id: 3, created_at: new Date(), updated_at: new Date() },
      { id: 45, character: '文', pinyin: 'wén', audio: 'audio/wen.mp3', image: 'images/wen.png', description: '文化，文字', grade_id: 3, created_at: new Date(), updated_at: new Date() },
      { id: 46, character: '字', pinyin: 'zì', audio: 'audio/zi.mp3', image: 'images/zi.png', description: '汉字，文字', grade_id: 3, created_at: new Date(), updated_at: new Date() },
      { id: 47, character: '读', pinyin: 'dú', audio: 'audio/du.mp3', image: 'images/du.png', description: '阅读，朗读', grade_id: 3, created_at: new Date(), updated_at: new Date() },
      { id: 48, character: '写', pinyin: 'xiě', audio: 'audio/xie.mp3', image: 'images/xie.png', description: '写字，书写', grade_id: 3, created_at: new Date(), updated_at: new Date() },
      { id: 49, character: '算', pinyin: 'suàn', audio: 'audio/suan.mp3', image: 'images/suan.png', description: '计算，算术', grade_id: 3, created_at: new Date(), updated_at: new Date() },
      { id: 50, character: '数', pinyin: 'shù', audio: 'audio/shu.mp3', image: 'images/shu.png', description: '数学，数字', grade_id: 3, created_at: new Date(), updated_at: new Date() },
      
      // 四年级汉字（较复杂常用字）
      { id: 51, character: '语', pinyin: 'yǔ', audio: 'audio/yu.mp3', image: 'images/yu.png', description: '语言，语文', grade_id: 4, created_at: new Date(), updated_at: new Date() },
      { id: 52, character: '文', pinyin: 'wén', audio: 'audio/wen.mp3', image: 'images/wen.png', description: '文化，文学', grade_id: 4, created_at: new Date(), updated_at: new Date() },
      { id: 53, character: '数', pinyin: 'shù', audio: 'audio/shu.mp3', image: 'images/shu.png', description: '数学，数量', grade_id: 4, created_at: new Date(), updated_at: new Date() },
      { id: 54, character: '学', pinyin: 'xué', audio: 'audio/xue.mp3', image: 'images/xue.png', description: '学习，学问', grade_id: 4, created_at: new Date(), updated_at: new Date() },
      { id: 55, character: '英', pinyin: 'yīng', audio: 'audio/ying.mp3', image: 'images/ying.png', description: '英语，英国', grade_id: 4, created_at: new Date(), updated_at: new Date() },
      { id: 56, character: '语', pinyin: 'yǔ', audio: 'audio/yu.mp3', image: 'images/yu.png', description: '语言，外语', grade_id: 4, created_at: new Date(), updated_at: new Date() },
      { id: 57, character: '物', pinyin: 'wù', audio: 'audio/wu.mp3', image: 'images/wu.png', description: '物理，物体', grade_id: 4, created_at: new Date(), updated_at: new Date() },
      { id: 58, character: '理', pinyin: 'lǐ', audio: 'audio/li.mp3', image: 'images/li.png', description: '道理，理科', grade_id: 4, created_at: new Date(), updated_at: new Date() },
      { id: 59, character: '化', pinyin: 'huà', audio: 'audio/hua.mp3', image: 'images/hua.png', description: '化学，变化', grade_id: 4, created_at: new Date(), updated_at: new Date() },
      { id: 60, character: '学', pinyin: 'xué', audio: 'audio/xue.mp3', image: 'images/xue.png', description: '学习，学科', grade_id: 4, created_at: new Date(), updated_at: new Date() },
      
      // 五年级汉字（复杂常用字）
      { id: 61, character: '历', pinyin: 'lì', audio: 'audio/li.mp3', image: 'images/li.png', description: '历史，经历', grade_id: 5, created_at: new Date(), updated_at: new Date() },
      { id: 62, character: '史', pinyin: 'shǐ', audio: 'audio/shi.mp3', image: 'images/shi.png', description: '历史，史实', grade_id: 5, created_at: new Date(), updated_at: new Date() },
      { id: 63, character: '地', pinyin: 'dì', audio: 'audio/di.mp3', image: 'images/di.png', description: '地理，地球', grade_id: 5, created_at: new Date(), updated_at: new Date() },
      { id: 64, character: '理', pinyin: 'lǐ', audio: 'audio/li.mp3', image: 'images/li.png', description: '地理，道理', grade_id: 5, created_at: new Date(), updated_at: new Date() },
      { id: 65, character: '生', pinyin: 'shēng', audio: 'audio/sheng.mp3', image: 'images/sheng.png', description: '生物，生命', grade_id: 5, created_at: new Date(), updated_at: new Date() },
      { id: 66, character: '物', pinyin: 'wù', audio: 'audio/wu.mp3', image: 'images/wu.png', description: '生物，物体', grade_id: 5, created_at: new Date(), updated_at: new Date() },
      { id: 67, character: '政', pinyin: 'zhèng', audio: 'audio/zheng.mp3', image: 'images/zheng.png', description: '政治，政策', grade_id: 5, created_at: new Date(), updated_at: new Date() },
      { id: 68, character: '治', pinyin: 'zhì', audio: 'audio/zhi.mp3', image: 'images/zhi.png', description: '政治，治理', grade_id: 5, created_at: new Date(), updated_at: new Date() },
      { id: 69, character: '经', pinyin: 'jīng', audio: 'audio/jing.mp3', image: 'images/jing.png', description: '经济，经历', grade_id: 5, created_at: new Date(), updated_at: new Date() },
      { id: 70, character: '济', pinyin: 'jì', audio: 'audio/ji.mp3', image: 'images/ji.png', description: '经济，救济', grade_id: 5, created_at: new Date(), updated_at: new Date() },
      
      // 六年级汉字（高级常用字）
      { id: 71, character: '哲', pinyin: 'zhé', audio: 'audio/zhe.mp3', image: 'images/zhe.png', description: '哲学，哲理', grade_id: 6, created_at: new Date(), updated_at: new Date() },
      { id: 72, character: '学', pinyin: 'xué', audio: 'audio/xue.mp3', image: 'images/xue.png', description: '哲学，学习', grade_id: 6, created_at: new Date(), updated_at: new Date() },
      { id: 73, character: '伦', pinyin: 'lún', audio: 'audio/lun.mp3', image: 'images/lun.png', description: '伦理，伦常', grade_id: 6, created_at: new Date(), updated_at: new Date() },
      { id: 74, character: '理', pinyin: 'lǐ', audio: 'audio/li.mp3', image: 'images/li.png', description: '伦理，道理', grade_id: 6, created_at: new Date(), updated_at: new Date() },
      { id: 75, character: '美', pinyin: 'měi', audio: 'audio/mei.mp3', image: 'images/mei.png', description: '美学，美丽', grade_id: 6, created_at: new Date(), updated_at: new Date() },
      { id: 76, character: '术', pinyin: 'shù', audio: 'audio/shu.mp3', image: 'images/shu.png', description: '美术，技术', grade_id: 6, created_at: new Date(), updated_at: new Date() },
      { id: 77, character: '音', pinyin: 'yīn', audio: 'audio/yin.mp3', image: 'images/yin.png', description: '音乐，声音', grade_id: 6, created_at: new Date(), updated_at: new Date() },
      { id: 78, character: '乐', pinyin: 'yuè', audio: 'audio/yue.mp3', image: 'images/yue.png', description: '音乐，快乐', grade_id: 6, created_at: new Date(), updated_at: new Date() },
      { id: 79, character: '体', pinyin: 'tǐ', audio: 'audio/ti.mp3', image: 'images/ti.png', description: '体育，身体', grade_id: 6, created_at: new Date(), updated_at: new Date() },
      { id: 80, character: '育', pinyin: 'yù', audio: 'audio/yu.mp3', image: 'images/yu.png', description: '体育，教育', grade_id: 6, created_at: new Date(), updated_at: new Date() }
    ];
  }

  async findAndCountAll(options) {
    let result = [...this.characters];
    if (options && options.where) {
      if (options.where.grade_id) {
        result = result.filter(char => char.grade_id === parseInt(options.where.grade_id));
      }
    }
    const count = result.length;
    if (options && options.limit && options.offset) {
      result = result.slice(options.offset, options.offset + options.limit);
    }
    return { count, rows: result };
  }

  async findByPk(id) {
    return this.characters.find(char => char.id === parseInt(id));
  }

  async findAll(options) {
    let result = [...this.characters];
    if (options && options.where) {
      if (options.where.grade_id) {
        result = result.filter(char => char.grade_id === parseInt(options.where.grade_id));
      }
    }
    return result;
  }
}

module.exports = new Character();
