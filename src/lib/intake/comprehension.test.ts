import { describe, expect, it } from 'vitest';
import { comprehensionAnswersSchema, scoreComprehension } from './comprehension';

describe('application comprehension', () => {
  it('requires all four explicit answers and only accepts approved choices', () => {
    expect(comprehensionAnswersSchema.safeParse({}).success).toBe(false);
    expect(comprehensionAnswersSchema.safeParse({ cost: '1200', activation: 'prc', choice: 'recipient', emergency: '143', extra: true }).success).toBe(false);
    expect(comprehensionAnswersSchema.safeParse({ cost: '1200', activation: 'prc', choice: 'recipient', emergency: '143' }).success).toBe(true);
  });

  it('blocks progress until every answer is correct', () => {
    expect(scoreComprehension({ cost: '1200', activation: 'prc', choice: 'recipient', emergency: '143' })).toMatchObject({ score: 4, passed: true });
    expect(scoreComprehension({ cost: '100', activation: 'prc', choice: 'recipient', emergency: '143' })).toMatchObject({ score: 3, passed: false });
  });
});
