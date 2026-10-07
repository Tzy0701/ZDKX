/* Install two independent user services; never modify an existing Cloudflare tunnel. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const state = path.join(os.homedir(), '.local/state/bomb-busters');
const units = path.join(os.homedir(), '.config/systemd/user');
const cloudflared = execFileSync('which', ['cloudflared'], { encoding: 'utf8' }).trim();
const port = process.env.PORT || '8081';
if (!/^\d+$/.test(port) || +port < 1024 || +port > 65535) throw new Error('PORT must be 1024–65535');
// systemd expands % specifiers even inside quotes.
const quote = value => '"' + value.replace(/%/g, '%%').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
fs.mkdirSync(state, { recursive: true, mode: 0o700 });
fs.mkdirSync(units, { recursive: true });
const directory = root.replace(/%/g, '%%').replace(/\\/g, '\\x5c').replace(/\s/g, c => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'));
const common = `WorkingDirectory=${directory}
Environment=${quote('PORT=' + port)}
Environment=${quote('BB_DATA_DIR=' + state)}
Restart=always
RestartSec=5
TimeoutStopSec=15
UMask=0077
StandardOutput=journal
StandardError=journal
`;
fs.writeFileSync(path.join(units, 'bomb-busters.service'), `[Unit]
Description=Bomb Busters game and WebSocket server
After=network.target

[Service]
Type=simple
${common}Environment=HOST=127.0.0.1
ExecStart=${quote(process.execPath)} ${quote(path.join(root, 'server/server.js'))}

[Install]
WantedBy=default.target
`);
fs.writeFileSync(path.join(units, 'bomb-busters-tunnel.service'), `[Unit]
Description=Bomb Busters free public Cloudflare tunnel
Wants=bomb-busters.service
After=network-online.target bomb-busters.service

[Service]
Type=simple
${common}Environment=${quote('BB_CLOUDFLARED=' + cloudflared)}
ExecStart=/bin/bash ${quote(path.join(root, 'scripts/run-public-tunnel.sh'))}

[Install]
WantedBy=default.target
`);
execFileSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'inherit' });
execFileSync('systemctl', ['--user', 'enable', '--now', 'bomb-busters.service', 'bomb-busters-tunnel.service'], { stdio: 'inherit' });
console.log('Services enabled. Public address file: ' + path.join(state, 'public-url'));
console.log('Enable startup before login with: sudo loginctl enable-linger ' + os.userInfo().username);
