/** Describe the final, filtered tool set, never a product-wide capability claim. */
export function toolCapabilityPrompt(tools: ReadonlyArray<{name: string}>): string {
  const names = [...new Set(tools.map(t => t.name))];
  const has = (...values: string[]) => values.some(n => names.includes(n));
  return [
    '【本次实际工具能力】',
    names.length ? `可调用工具（仅此清单）：${names.join('、')}。` : '本次没有执行工具，只能提供文字分析和建议，不能读取本机文件、保存文件或执行命令。',
    `文件内容读取：${has('fs_read','file_read','fs_read_text_file')?'可用':'未接入'}；文件写入：${has('fs_write','file_write','fs_write_file')?'可用':'未接入'}；命令执行：${has('run','exec','run_command','pty_spawn')?'可请求，仍受执行入口的权限与批准规则约束':'未接入'}。`,
    '不得依据预设、历史回复或产品介绍声称拥有清单外的能力。权限拒绝、预览或生成代码均不代表已执行；仅根据成功的工具结果报告完成。工具参数不能自行授予权限或放宽白名单。',
  ].join('\n');
}
