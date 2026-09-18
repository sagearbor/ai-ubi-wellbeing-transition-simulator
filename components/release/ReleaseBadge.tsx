import React from 'react';
import identity from 'virtual:release-identity';

/** Read the identity embedded with these exact UI assets, not a potentially newer server. */
export default function ReleaseBadge() {
  const known = identity && identity.commit !== 'unknown';
  const label = known ? `${identity.commit.slice(0, 8)}${identity.dirty ? ' · modified' : ''}` : 'unknown';
  const title = identity ? `Source: ${identity.commit}; ${identity.dirty === null ? 'clean status unknown' : identity.dirty ? 'uncommitted changes' : 'committed source'}; built ${identity.builtAt}; version ${identity.version}` : 'Build identity unavailable';
  return <a href="/release.json" target="_blank" rel="noopener noreferrer" title={title} aria-label={`Build ${label}`} style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>Build {label}</a>;
}
