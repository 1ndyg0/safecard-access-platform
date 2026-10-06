import { z } from 'zod';

export const dataModeSchema = z.enum(['synthetic', 'live']);
export type DataMode = z.infer<typeof dataModeSchema>;
