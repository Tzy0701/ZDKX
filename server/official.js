/* Node 适配器；规则、身份和私人视图由跨平台核心处理。 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const core = require('./official-core');
module.exports = function officialService(wss, storageDir) {
  const dir = storageDir || path.join(__dirname, '.official-data');
  const file = name => path.join(dir, name + '.json');
  return core(wss, {
    restart: true,
    token: () => crypto.randomBytes(24).toString('hex'),
    setTimeout, clearTimeout,
    interval: (fn, ms) => setInterval(fn, ms).unref(),
    store: {
      read: name => fs.existsSync(file(name)) ? fs.readFileSync(file(name), 'utf8') : null,
      write(name, json) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        const tmp = file(name) + '.' + process.pid + '.tmp';
        fs.writeFileSync(tmp, json, { mode: 0o600 });
        fs.renameSync(tmp, file(name));
      },
      names: () => fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => /^bb-[a-z0-9_.-]{1,45}\.json$/.test(n)).map(n => n.slice(0, -5)) : []
    }
  });
};
