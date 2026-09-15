import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative, dirname, extname } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { canonicalJson } from '../src/policy/hash';
/** Static local import closure, plus locked dependency declarations. Dynamic input values are
 * separately bound by the actual scenario signature; this is not an installed-package-byte audit. */
export const SOURCE_ENTRYPOINTS = [
    'simulation/conditionalWorld.ts', 'simulation/run.ts', 'simulation/qualification.ts',
    'validation/conditionalProfile.ts', 'validation/responseProfile.ts',
    'scripts/response-profile.ts', 'scripts/qualification-source-check.ts',
    'vite.config.ts', 'build/qualificationSourcePlugin.ts', 'package.json', 'package-lock.json',
];
const AUTHORITY_FILES = new Set([
    'data/qualification/world-conditional-v1.json',
    'data/qualification/world-conditional-v1-evidence.json',
    'data/qualification/world-conditional-v1-structure.json',
]);
export interface SourceManifest {
    hash: string;
    sources: Record<string, string>;
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function sourceManifest(root: string, entrypoints = SOURCE_ENTRYPOINTS): SourceManifest {
    const sources: Record<string, string> = {};
    function visit(path: string): void {
        const absolute = resolve(root, path), name = relative(root, absolute).replaceAll('\\', '/');
        if (name.startsWith('../'))
            throw new Error(`Local source escapes project: ${name}`);
        if (AUTHORITY_FILES.has(name) || name in sources)
            return;
        const text = readFileSync(absolute, 'utf8');
        sources[name] = digest(text);
        if (!['.ts', '.tsx', '.js', '.mjs'].includes(extname(name)))
            return;
        const ast = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
        const dependencies: string[] = [];
        function collect(node: ts.Node): void {
            if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
                dependencies.push(node.moduleSpecifier.text);
            if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0]))
                dependencies.push(node.arguments[0].text);
            ts.forEachChild(node, collect);
        }
        collect(ast);
        for (const dependency of dependencies.filter(id => id.startsWith('.'))) {
            const base = resolve(dirname(absolute), dependency);
            const resolved = [base, base + '.ts', base + '.tsx', base + '.js', base + '.json', resolve(base, 'index.ts')].find(p => existsSync(p) && extname(p));
            if (!resolved)
                throw new Error(`Unresolved local import ${dependency} from ${name}`);
            visit(relative(root, resolved));
        }
    }
    entrypoints.forEach(visit);
    const sorted = Object.fromEntries(Object.entries(sources).sort(([a], [b]) => a.localeCompare(b)));
    return { hash: digest(canonicalJson(sorted)), sources: sorted };
}
export function assertFreshSources(root: string, pinned: SourceManifest, entrypoints = SOURCE_ENTRYPOINTS): SourceManifest {
    const actual = sourceManifest(root, entrypoints);
    if (actual.hash !== pinned.hash || digest(canonicalJson(pinned.sources)) !== pinned.hash)
        throw new Error('Qualification source manifest is stale. Regenerate evidence and obtain scoped review; refreshing a hash alone is not acceptance.');
    return actual;
}
export function currentSourceStatus(root: string): {
    hash: string | null;
    actualHash: string | null;
    reason?: string;
} {
    let actualHash: string | null = null;
    try {
        const actual = sourceManifest(root);
        actualHash = actual.hash;
        const pinned = JSON.parse(readFileSync(resolve(root, 'data/qualification/world-conditional-v1-structure.json'), 'utf8')) as SourceManifest;
        if (actual.hash !== pinned.hash || digest(canonicalJson(pinned.sources)) !== pinned.hash)
            throw new Error('Qualification source manifest is stale.');
        const evidence = JSON.parse(readFileSync(resolve(root, 'data/qualification/world-conditional-v1-evidence.json'), 'utf8'));
        if (evidence.structureHash !== actual.hash || evidence.audit?.pass !== true)
            throw new Error('Qualification evidence does not match the current source manifest.');
        return { hash: actual.hash, actualHash };
    }
    catch (error) {
        return { hash: null, actualHash, reason: String(error) };
    }
}
export function assertCurrentSourceStatus(root: string): string {
    const status = currentSourceStatus(root);
    if (!status.hash)
        throw new Error(status.reason);
    return status.hash;
}
