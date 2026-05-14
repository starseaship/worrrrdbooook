# Light Vocabulary Book - Static Vercel Version

这个版本是纯静态前端 + Vercel API config + Supabase。

它不使用 Vite，不需要 `npm install`，也不需要 `package.json`。这样可以绕开 Vercel 当前在 `npm install` 阶段报错的问题。

## 文件结构

```text
api/config.js              读取 Vercel 环境变量，返回给前端
src/main.js                主功能逻辑
src/supabaseClient.js      通过 CDN 加载 Supabase JS SDK
src/speech.js              浏览器发音功能
src/styles.css             页面样式
supabase/vocabulary_schema.sql  数据库初始化 SQL
index.html                 首页
vercel.json                跳过 npm install 和 build
```

## Vercel 环境变量

在 Vercel Project Settings → Environment Variables 添加：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

如果你已经添加过，不需要重复添加。

## Supabase

在 Supabase SQL Editor 执行：

```text
supabase/vocabulary_schema.sql
```

## GitHub 上传

上传本包里的全部文件即可。不要上传 `node_modules`、`dist`、`.env.local`。

这个版本没有 `package.json`，这是正常的。
