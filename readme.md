# koishi-plugin-menu

[![npm](https://img.shields.io/npm/v/koishi-plugin-menu?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-menu)

可自定义的帮助菜单，提供美观的可视化命令帮助界面

## 功能特性

- 🎨 **美观的界面设计** - 现代化的卡片布局，支持自定义主题配色
- 📱 **响应式布局** - 自适应移动端和桌面端显示
- 🌐 **多语言支持** - 支持 Koishi 的国际化系统
- 🔧 **灵活的数据源** - 支持文件缓存和内存实时读取两种模式
- 🎯 **智能权限过滤** - 自动过滤用户无权限的命令和选项
- 📦 **自动布局生成** - 智能生成主菜单和命令详情页布局
- 🖼️ **图片渲染** - 基于 Puppeteer 的高质量图片输出

## 配置选项

### 数据源配置

- **cmdSrc**: 命令数据源
  - `file`: 本地文件缓存 (默认)
  - `inline`: 内存实时读取
- **layoutSrc**: 布局数据源
  - `file`: 本地文件缓存 (默认)
  - `inline`: 内存实时生成

### 布局配置

- **padding**: 内边距大小 (8-32px，默认 16px)
- **radius**: 圆角大小 (0-24px，默认 12px)

### 界面配置

- **background**: 背景图片文件名或完整 URL
- **fontUrl**: 自定义字体的 URL 链接
- **fontSize**: 基础字体大小 (10-20px，默认 14px)
- **titleSize**: 标题字体倍数 (1-3，默认 1.4)

### 页面内容

- **header**: 页头 HTML 内容
- **footer**: 页脚 HTML 内容

### 颜色配置

- **primary**: 主色调 (默认 #8b5cf6)
- **secondary**: 副色调 (默认 #38bdf8)
- **bgColor**: 背景色 (默认 #fefefe)
- **textColor**: 文本色 (默认 #64748b)
