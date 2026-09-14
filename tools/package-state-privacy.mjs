// Source-package guard only. Application repositories own their recording policy.
import { execFileSync } from 'node:child_process';

export function assertPackageStatePrivate(root) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
  const leaked = tracked.filter(file => file.split('/').some(part => part.toLowerCase() === '.agrimap-agent'));
  if (leaked.length) throw new Error(`PACKAGE_STATE_TRACKED: ${leaked.join(', ')}`);
  for (const probe of ['.agrimap-agent/privacy-probe', 'plugins/agrimap-agent-skills/.agrimap-agent/privacy-probe']) {
    try { git('check-ignore', '--no-index', '--quiet', '--', probe); }
    catch { throw new Error(`PACKAGE_STATE_NOT_IGNORED: ${probe}`); }
    const attribute = git('check-attr', '-z', 'export-ignore', '--', probe.split('/').slice(0, -1).join('/')).split('\0');
    if (attribute[2] !== 'set') throw new Error(`PACKAGE_STATE_NOT_EXPORT_IGNORED: ${probe}`);
  }
}
