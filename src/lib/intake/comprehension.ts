import { z } from 'zod';

export const comprehensionAnswersSchema = z.strictObject({
  cost: z.enum(['1200', '100']),
  activation: z.enum(['prc', 'sponsor']),
  choice: z.enum(['recipient', 'payer']),
  emergency: z.enum(['143', 'sponsor']),
});

export type ComprehensionAnswers = z.infer<typeof comprehensionAnswersSchema>;

export function scoreComprehension(answers: ComprehensionAnswers) {
  const correct = {
    cost: answers.cost === '1200',
    activation: answers.activation === 'prc',
    choice: answers.choice === 'recipient',
    emergency: answers.emergency === '143',
  };
  const score = Object.values(correct).filter(Boolean).length;
  return { score, passed: score === 4, correct };
}
