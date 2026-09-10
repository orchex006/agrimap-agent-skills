#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function checkPackagePr({base, head, sameRepository}) {
  if (base === 'main') return sameRepository && /^(release|hotfix)\/[^\s]+$/.test(head);
  if (base === 'develop') return /^(feature|fix|release|hotfix)\/[^\s]+$/.test(head);
  return true;
}
if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const [base, head, same] = process.argv.slice(2);
  if (!base || !head || !checkPackagePr({base,head,sameRepository:same === 'true'})) {
    console.error('PACKAGE_PR_ROUTE_FORBIDDEN'); process.exitCode = 1;
  }
}
