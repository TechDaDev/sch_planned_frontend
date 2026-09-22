import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Release hygiene scan.
 *
 * These are source-level assertions about the release candidate: what must not exist in
 * production source, and what must not be tracked in the repository. They are cheap and
 * they fail loudly if a later change reintroduces the pattern.
 */
const SRC = path.resolve(process.cwd(), 'src');
const ROOT = process.cwd();

function sourceFiles(): string[] {
  const files: string[] = [];
  walk(SRC, (file) => {
    if (!/\.(ts|tsx)$/.test(file)) {
      return;
    }
    if (/\.test\.tsx?$/.test(file) || file.includes(`${path.sep}test${path.sep}`)) {
      return;
    }
    files.push(file);
  });
  return files;
}

function walk(dir: string, visit: (file: string) => void): void {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, visit);
      continue;
    }
    visit(full);
  }
}

/**
 * Source with documentation removed.
 *
 * A comment that mentions `localStorage` or a log call is documentation, not a usage,
 * so the scans below run against executable code only. Block comments and whole comment
 * lines are removed; a line of code is never altered, so a real usage cannot hide behind
 * a comment.
 */
function executableSource(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

function executableFilesContaining(needle: string): string[] {
  return sourceFiles()
    .filter((file) => executableSource(readFileSync(file, 'utf8')).includes(needle))
    .map((file) => path.relative(SRC, file));
}

function filesContaining(needle: string): string[] {
  return sourceFiles()
    .filter((file) => readFileSync(file, 'utf8').includes(needle))
    .map((file) => path.relative(SRC, file));
}

describe('no browser-visible backend configuration', () => {
  it('never uses a NEXT_PUBLIC backend variable', () => {
    expect(filesContaining('NEXT_PUBLIC_BACKEND_API_URL')).toEqual([]);
    expect(filesContaining('NEXT_PUBLIC_BACKEND')).toEqual([]);
  });

  it('has no NEXT_PUBLIC token or secret variable', () => {
    const offenders = sourceFiles().filter((file) =>
      /NEXT_PUBLIC_[A-Z_]*(TOKEN|SECRET|PASSWORD|KEY)/.test(readFileSync(file, 'utf8')),
    );

    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([]);
  });

  it('never reads an environment value in browser code', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(file, 'utf8');
      // Route handlers and server-only modules may read the environment; a client
      // component may not.
      if (!source.startsWith("'use client'") && !source.includes("\n'use client'")) {
        continue;
      }
      if (/process\.env\./.test(source)) {
        offenders.push(path.relative(SRC, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('no token can reach browser storage', () => {
  for (const storage of ['localStorage', 'sessionStorage', 'indexedDB']) {
    it(`never touches ${storage}`, () => {
      expect(executableFilesContaining(storage)).toEqual([]);
    });
  }

  it('never writes to document.cookie', () => {
    const offenders = sourceFiles().filter((file) =>
      /document\.cookie/.test(executableSource(readFileSync(file, 'utf8'))),
    );

    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([]);
  });
});

describe('no dangerous HTML rendering', () => {
  it('contains no dangerouslySetInnerHTML', () => {
    expect(executableFilesContaining('dangerouslySetInnerHTML')).toEqual([]);
  });

  it('contains no innerHTML assignment', () => {
    const offenders = sourceFiles().filter((file) =>
      /\.innerHTML\s*=/.test(executableSource(readFileSync(file, 'utf8'))),
    );

    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([]);
  });
});

describe('client logging hygiene', () => {
  it('has no console.log, debug or info in production source', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = executableSource(readFileSync(file, 'utf8'));
      if (/console\.(log|debug|info)\s*\(/.test(source)) {
        offenders.push(path.relative(SRC, file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('logs only a correlation digest from an error boundary', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = executableSource(readFileSync(file, 'utf8'));
      for (const match of source.matchAll(/console\.(error|warn)\s*\(([\s\S]{0,120})/g)) {
        const args = match[2] ?? '';
        // Only a digest, a label or a variable name may be logged, never a value.
        if (/token|password|cookie|authorization|secret/i.test(args)) {
          offenders.push(`${path.relative(SRC, file)}: ${args.trim().slice(0, 60)}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('no test code can reach a production bundle', () => {
  it('never imports a test fixture or helper from application code', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = executableSource(readFileSync(file, 'utf8'));
      if (/from '@\/test\/|require\('@\/test\//.test(source)) {
        offenders.push(path.relative(SRC, file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps the production entry points free of test-only dependencies', () => {
    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };

    for (const name of ['vitest', 'jsdom', '@testing-library/react', '@testing-library/user-event']) {
      expect(Object.keys(manifest.dependencies)).not.toContain(name);
    }
  });
});

describe('no operational placeholder text', () => {
  it('has no stale phase reference in production source', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(file, 'utf8');
      // A comment may describe history, but user-visible copy must not promise a phase.
      for (const match of source.matchAll(/['"`][^'"`]*\b(in a later phase|Frontend F[0-9])\b[^'"`]*['"`]/gi)) {
        offenders.push(`${path.relative(SRC, file)}: ${match[0].slice(0, 70)}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('repository hygiene', () => {
  it('ignores build output, dependencies and local environment files', () => {
    const ignore = readFileSync(path.join(ROOT, '.gitignore'), 'utf8');

    for (const entry of ['.next', 'node_modules', '.env', '.env.local']) {
      expect(ignore, `.gitignore must cover ${entry}`).toContain(entry);
    }
  });

  it('keeps only placeholder values in the example environment file', () => {
    const example = readFileSync(path.join(ROOT, '.env.example'), 'utf8');

    expect(example).not.toMatch(/SECRET_KEY\s*=\s*\S{20,}/);
    expect(example).not.toMatch(/password\s*=\s*\S+/i);
    expect(example).not.toMatch(/Bearer\s+\S+/);
  });
});
