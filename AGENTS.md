# 主线看板

- 主逻辑在 `app/page.tsx`，样式在 `app/globals.css`。
- 任务数据仅保存在浏览器本地；修改数据结构时保留 `restoreBoard` 的兼容处理。
- 删除岔路必须连同所有下级任务删除，并保留确认步骤。
- 验证命令：`npm test`、`npm run lint`。
- 公开网址：`https://mainline-board-onna.q2354334260.chatgpt.site`。
