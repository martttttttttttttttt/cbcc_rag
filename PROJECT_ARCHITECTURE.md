# 识字小程序项目架构

## 1. 技术栈选择

### 后端
- **语言**: Node.js
- **框架**: Express
- **数据库**: MySQL
- **ORM**: Sequelize
- **文件存储**: 本地文件系统
- **依赖**: 
  - express: 4.18.2
  - mysql2: 3.18.2
  - sequelize: 6.37.7
  - cors: 2.8.6
  - multer: 2.1.0
  - dotenv: 17.3.1

### 前端
- **平台**: 微信小程序
- **语言**: JavaScript
- **框架**: 微信小程序原生框架
- **UI组件**: 微信小程序内置组件 + 自定义组件

## 2. 项目结构

```
openclaw/
├── backend/            # 后端代码
│   ├── app/
│   │   ├── models/     # 数据库模型
│   │   │   ├── Character.js      # 汉字模型
│   │   │   └── Grade.js          # 年级模型
│   │   ├── routes/     # API路由
│   │   │   ├── characters.js     # 汉字相关API
│   │   │   └── grades.js         # 年级相关API
│   │   ├── controllers/ # 控制器
│   │   │   ├── characterController.js
│   │   │   └── gradeController.js
│   │   └── utils/      # 工具函数
│   │       └── audioUtils.js     # 音频处理工具
│   ├── public/         # 静态资源
│   │   ├── audio/      # 汉字读音
│   │   └── images/     # 汉字图片
│   ├── config/         # 配置文件
│   │   └── database.js # 数据库配置
│   ├── server.js       # 服务器入口
│   ├── package.json    # 依赖配置
│   └── .env            # 环境变量
├── frontend/           # 前端小程序
│   ├── pages/          # 页面
│   │   ├── index/      # 首页（年级选择）
│   │   ├── characters/ # 汉字列表
│   │   └── detail/     # 汉字详情
│   ├── components/     # 组件
│   │   ├── character-card/   # 汉字卡片
│   │   └── audio-player/     # 音频播放器
│   ├── utils/          # 工具函数
│   ├── app.js          # 小程序入口
│   ├── app.json        # 小程序配置
│   └── app.wxss        # 全局样式
└── README.md           # 项目说明
```

## 3. 数据库设计

### `characters` 表
| 字段名 | 数据类型 | 约束 | 描述 |
|--------|----------|------|------|
| `id` | `INT` | `PRIMARY KEY AUTO_INCREMENT` | 汉字ID |
| `character` | `VARCHAR(10)` | `NOT NULL UNIQUE` | 汉字 |
| `pinyin` | `VARCHAR(50)` | `NOT NULL` | 拼音 |
| `audio` | `VARCHAR(255)` | `NOT NULL` | 音频文件路径 |
| `image` | `VARCHAR(255)` | `NOT NULL` | 图片文件路径 |
| `description` | `TEXT` | `NOT NULL` | 汉字描述 |
| `grade_id` | `INT` | `NOT NULL` | 所属年级ID |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | 创建时间 |
| `updated_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | 更新时间 |

### `grades` 表
| 字段名 | 数据类型 | 约束 | 描述 |
|--------|----------|------|------|
| `id` | `INT` | `PRIMARY KEY AUTO_INCREMENT` | 年级ID |
| `name` | `VARCHAR(50)` | `NOT NULL UNIQUE` | 年级名称（如：一年级、二年级） |
| `level` | `INT` | `NOT NULL` | 难度级别 |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | 创建时间 |
| `updated_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | 更新时间 |

## 4. API设计

### 年级相关API
- `GET /api/grades` - 获取所有年级
- `GET /api/grades/:id` - 获取指定年级详情

### 汉字相关API
- `GET /api/characters` - 获取所有汉字（支持分页和筛选）
- `GET /api/characters/:id` - 获取指定汉字详情
- `GET /api/grades/:gradeId/characters` - 获取指定年级的汉字

## 5. 前端功能设计

### 页面
1. **首页**：展示年级列表，用户选择年级进入汉字学习
2. **汉字列表页**：展示当前年级的所有汉字，支持滑动浏览
3. **汉字详情页**：展示汉字详情，包括汉字、拼音、读音、图片和描述

### 功能
1. **分层学习**：按照年级分层，从简单到复杂
2. **读音功能**：点击汉字播放读音
3. **图片展示**：显示汉字对应的图片
4. **汉字描述**：提供汉字的详细介绍

## 6. 数据初始化

- 初始化年级数据（1-6年级）
- 导入常用三千汉字数据，包括拼音、读音、图片和描述
- 按年级分配汉字，确保从简单到复杂的顺序
