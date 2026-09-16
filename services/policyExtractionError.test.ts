import { describe, expect, it } from 'vitest';
import { policyExtractionError } from './policyExtractionError';
describe('public extraction error mapping (fake provider payloads)',()=>{
  it('explains the actual Google referrer refusal without provider identifiers',()=>{
    const message=policyExtractionError(new Error(JSON.stringify({error:{code:403,message:'secret-key project-123',details:[{reason:'API_KEY_HTTP_REFERRER_BLOCKED',metadata:{consumer:'projects/123'}}]}})));
    expect(message).toContain('does not allow this website address');expect(message).toContain('manual draft');expect(message).not.toMatch(/secret|123|403|\{/);
  });
  it.each([['PolicyNoApiKeyError','key is configured'],['PolicyRateLimitError','limit was reached']])('maps %s safely',(name,text)=>{const e=new Error('private');e.name=name;expect(policyExtractionError(e)).toContain(text);});
  it.each([['RESOURCE_EXHAUSTED 429','limit'],['SAFETY refusal','declined'],['Failed to fetch','could not be reached']])('maps provider/network category %s',(message,text)=>expect(policyExtractionError(new Error(message))).toContain(text));
  it('never returns an arbitrary provider error',()=>{expect(policyExtractionError(new Error('API key=secret project=private'))).toBe(policyExtractionError(null));});
  it('classifies a refused connection as unreachable, not as a provider refusal (review 2026-09-15)',()=>{
    expect(policyExtractionError(new TypeError('connect ECONNREFUSED 127.0.0.1:443'))).toContain('could not be reached');
    expect(policyExtractionError(new Error('fetch failed: connection refused by peer'))).toContain('could not be reached');
  });
  it('does not treat an incidental 429 or the word refuse as a rate limit or a safety refusal',()=>{
    const generic=policyExtractionError(null);
    expect(policyExtractionError(new Error('response id 94290 had an unexpected shape'))).toBe(generic);
    expect(policyExtractionError(new Error('the model refused to return JSON'))).toBe(generic);
    expect(policyExtractionError(new Error(JSON.stringify({error:{code:429,status:'RESOURCE_EXHAUSTED'}})))).toContain('limit');
    expect(policyExtractionError(new Error(JSON.stringify({promptFeedback:{blockReason:'SAFETY'}})))).toContain('declined');
  });
});

