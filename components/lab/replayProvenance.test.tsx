import React from 'react';
import { renderToString } from 'react-dom/server';
import { expect, it } from 'vitest';
import LabTab from './LabTab';
import { buildModelExport, curatedMatch } from './importState';
import { buildBundle, reopenBundle } from '../../src/policy/bundle';
import { scenarioProvenance } from '../../src/policy/provenance';
import { findFixture } from '../../src/core/fixtures';
import { splitScenarioOverlays } from './policyState';
import { pairedRun } from '../../src/policy/draft';
import { training, threeStatusDraft } from '../../src/policy/testDrafts';

it('keeps custom-overlay scenarios experimental across restoration and next export', () => {
  const overlays = [{id: 'external-edit', parameters: [{id: training.parameters[0].id, value: training.parameters[0].value + 1}]}];
  const draft = threeStatusDraft();
  const bundle = buildBundle(training, overlays, draft, pairedRun(training, overlays, draft, {runs: 2}));
  const rep = reopenBundle(JSON.parse(JSON.stringify(bundle)), () => training);
  expect(rep.status).toBe('reproduced');
  expect(curatedMatch(rep.model!)).toBeDefined();
  const restored = splitScenarioOverlays(curatedMatch(rep.model!)!, rep.overlays!);
  const provenance = scenarioProvenance(rep.model!, rep.overlays!, bundle.provenance);
  const html = renderToString(<LabTab initialModelId={rep.model!.id} initialCustomOverlays={restored.custom} initialOverlayIds={restored.overlayIds} initialProvenance={provenance} />);
  expect(html).toContain('Experimental scenario — not curated');
  expect(html).toContain('Base model: <!-- -->known fixture');
  const next = buildModelExport(rep.model!, rep.overlays!, 'curated', undefined, [], provenance);
  expect(next.status).toContain('experimental');
  const exportedAgain = buildBundle(rep.model!, rep.overlays!, rep.draft!, rep.rerun!, {provenance});
  expect(exportedAgain.provenance).toEqual({kind: 'experimental'});
  expect(reopenBundle(JSON.parse(JSON.stringify(exportedAgain)), () => training).status).toBe('reproduced');
});

it('requires exact overlay content and cannot certify an edited fixture overlay', () => {
  const fixture = findFixture('cohort-flow')!;
  const known = fixture.overlays[0];
  expect(scenarioProvenance(fixture.model, [known])).toEqual({kind: 'fixture'});
  const edited = {...known, description: 'changed content, same id'};
  expect(scenarioProvenance(fixture.model, [edited], {kind: 'fixture'})).toEqual({kind: 'experimental'});
  expect(splitScenarioOverlays(fixture, [edited]).custom).toEqual([edited]);
});
it('keeps structured source provenance without interpreting English warnings', () => {
  const provenance = {kind: 'source-import' as const, reason: 'Earlier numerical contract'};
  const modelExport = buildModelExport(training, [], 'curated', undefined, [], provenance);
  expect(modelExport.status).toContain('experimental');
  expect(scenarioProvenance(training, [], modelExport.provenance)).toEqual(provenance);
  const draft = threeStatusDraft();
  const bundle = buildBundle(training, [], draft, pairedRun(training, [], draft, {runs: 2}), {provenance});
  const reopened = JSON.parse(JSON.stringify(bundle));
  expect(reopenBundle(reopened, () => training).status).toBe('reproduced');
  expect(reopened.provenance).toEqual(provenance);
});
