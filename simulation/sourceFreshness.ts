/** Fail closed outside the supported Vite build/dev pipeline. The source gate transforms this
 * module into a verified current source hash. Imported files cannot supply this authority. */
export function executingSourceHash(): string | null {
    return null;
}
