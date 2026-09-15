/** Clean-checkout gate: source + committed evidence metadata, no local 500MB raw artifact needed. */
import { assertCurrentSourceStatus } from '../build/qualificationSources';
console.log(`Qualification source verified: ${assertCurrentSourceStatus(process.cwd())}`);
