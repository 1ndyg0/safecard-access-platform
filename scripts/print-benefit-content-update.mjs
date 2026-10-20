// Prints the SQL that brings the published benefit content in the database in line with
// src/lib/benefit-storyboards.ts. It only touches the benefit row's body; it does not create
// users, roles, campaigns or consent text (unlike bootstrap-controlled-pilot.mjs).
//
//   node scripts/print-benefit-content-update.mjs > benefit-content-update.sql
//
// Review the SQL, then run it in the Supabase SQL editor for the production project.
// The row is updated in place (version 1), so APPROVED_CONTENT_VERSION does not change.
import { benefitStoryboards } from '../src/lib/benefit-storyboards.ts';

const body = JSON.stringify({ cards: benefitStoryboards });
if (body.includes('$benefit$')) throw new Error('Content contains the SQL delimiter.');

console.log(`-- Generated from src/lib/benefit-storyboards.ts
-- Rewords the benefit examples for production ("This is a sample scenario ..." instead of "Illustrative only ...").
begin;
update public.content_versions
set body = $benefit$${body}$benefit$
where content_type = 'benefit'
  and locale = 'en'
  and version = 1
  and approval_status = 'approved'
  and is_published = true;
-- Expect: UPDATE 1
commit;`);
