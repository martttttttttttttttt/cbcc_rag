// 内存数据库模拟
class Grade {
  constructor() {
    this.grades = [
      { id: 1, name: '一年级', level: 1, created_at: new Date(), updated_at: new Date() },
      { id: 2, name: '二年级', level: 2, created_at: new Date(), updated_at: new Date() },
      { id: 3, name: '三年级', level: 3, created_at: new Date(), updated_at: new Date() },
      { id: 4, name: '四年级', level: 4, created_at: new Date(), updated_at: new Date() },
      { id: 5, name: '五年级', level: 5, created_at: new Date(), updated_at: new Date() },
      { id: 6, name: '六年级', level: 6, created_at: new Date(), updated_at: new Date() }
    ];
  }

  async findAll(options) {
    let result = [...this.grades];
    if (options && options.order) {
      const [field, direction] = options.order[0];
      result.sort((a, b) => {
        if (a[field] < b[field]) return direction === 'ASC' ? -1 : 1;
        if (a[field] > b[field]) return direction === 'ASC' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }

  async findByPk(id) {
    return this.grades.find(grade => grade.id === parseInt(id));
  }
}

module.exports = new Grade();
