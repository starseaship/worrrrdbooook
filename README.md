# Light Vocabulary Book - Static Vercel Version

这个版本是纯静态前端 + Vercel API config + Supabase。

它不使用 Vite，不需要 `npm install`，也不需要 `package.json`。这样可以绕开 Vercel 当前在 `npm install` 阶段报错的问题。

## 文件结构

```text
api/config.js              读取 Vercel 环境变量，返回给前端
index.html                 首页
vercel.json                跳过 npm install 和 build

src/main.js                应用入口、渲染分发、事件绑定
src/api.js                 Supabase 数据读写
src/constants.js           tab、掌握程度等固定配置
src/practice.js            解释配对练习逻辑
src/state.js               全局状态与消息状态
src/supabaseClient.js      通过 CDN 加载 Supabase JS SDK
src/speech.js              浏览器发音功能
src/styles.css             页面样式
src/utils.js               转义、标签、掌握程度、随机打乱等工具函数
src/views.js               页面渲染模板
```

## Vercel 环境变量

在 Vercel Project Settings → Environment Variables 添加：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

如果你已经添加过，不需要重复添加。

## Supabase

需要在 Supabase 中准备以下表：

```text
courses
vocabulary_items
vocabulary_reviews
```

这三个表都应该启用 RLS，并限制用户只能读写自己的 `user_id` 数据。

## GitHub 上传

上传本包里的全部文件即可。不要上传 `node_modules`、`dist`、`.env.local`。

这个版本没有 `package.json`，这是正常的。
