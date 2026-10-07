// 只复制公开资源，绝不发布房间存档、凭证、测试或源仓库。
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist', 'pages');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const body = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<meta name="bb-server" content="cloudflare">' +
  '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>' +
  '</head><body>' + body + '</body></html>';
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.cpSync(path.join(root, 'js'), path.join(out, 'js'), { recursive: true });
if (fs.existsSync(path.join(root, 'RULES.md'))) fs.copyFileSync(path.join(root, 'RULES.md'), path.join(out, 'RULES.md'));
fs.writeFileSync(path.join(out, '_routes.json'), JSON.stringify({ version: 1, include: ['/ws', '/healthz', '/audio/*'], exclude: [] }));
fs.writeFileSync(path.join(out, '_headers'), '/\n  Cache-Control: no-cache\n/js/*\n  Cache-Control: no-cache\n');
console.log('Pages 公开资源已生成：dist/pages');
