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
});
