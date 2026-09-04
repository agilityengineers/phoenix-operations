-- Phoenix Operations — seed data
-- Mirrors src/lib/seed.ts: the Phoenix workspace with Joshua as Admin, the
-- Lack of Control funnel end-to-end (copy, blocks, weights, 2 A/B variants),
-- the sample pipelines/contacts from the design, CMS pages, sequences,
-- webhook events, sync log, and subscriptions.

-- ── Workspaces ──────────────────────────────────────────────────────────────
insert into workspaces (id, name, domain, type, status, plan, brand, guide, created_at) values
('ws_phoenix', 'Phoenix Operations', 'phoenixoperations.com', 'eos_implementer', 'live', 'network',
 '{"logoUrl":"/assets/logo.png","markUrl":"/assets/mark.png","primaryColor":"#D76C2C","inkColor":"#14263B","paperColor":"#F7F4EE","customDomain":"phoenixoperations.com"}',
 '{"photoUrl":"/assets/headshot.jpg","name":"Joshua Kornitsky","title":"Founder, Phoenix Operations","story":"I''ve built companies, led teams, worked inside Fortune 500 companies, and spent decades working with hundreds of small businesses. I''ve seen what happens when growth starts creating more complexity than the people and processes were built to handle.","showGuideBand":true}',
 '2026-01-05T00:00:00Z'),
('ws_bluecollar', 'Blue Collar Ops', 'ops.bluecollarsuccess.com', 'eos_implementer', 'live', 'practice',
 '{"logoUrl":"/assets/logo.png","markUrl":"/assets/mark.png","primaryColor":"#D76C2C","inkColor":"#14263B","paperColor":"#F7F4EE"}',
 '{"photoUrl":"/assets/headshot.jpg","name":"Chris Crew","title":"President, The Blue Collar Success Group","story":"","showGuideBand":true}',
 '2026-03-02T00:00:00Z'),
('ws_alcott', 'Alcott Operations', 'alcottops.com', 'consultant', 'onboarding', 'solo',
 '{"logoUrl":"/assets/logo.png","markUrl":"/assets/mark.png","primaryColor":"#D76C2C","inkColor":"#14263B","paperColor":"#F7F4EE"}',
 '{"photoUrl":"/assets/headshot.jpg","name":"Renee Alcott","title":"Owner, Alcott Operations","story":"","showGuideBand":true}',
 '2026-08-14T00:00:00Z');

-- ── Members (Joshua = Admin) ────────────────────────────────────────────────
insert into members (workspace_id, name, email, role, state) values
('ws_phoenix', 'Joshua Kornitsky', 'joshua@phoenixoperations.com', 'admin',   'active'),
('ws_phoenix', 'Dana Whitfield',   'dana@phoenixoperations.com',   'staff',   'active'),
('ws_phoenix', 'Chris Crew',       'chris@bluecollarsuccess.com',  'partner', 'active'),
('ws_phoenix', 'Renee Alcott',     'renee@alcottops.com',          'partner', 'invited');

-- ── Funnels ─────────────────────────────────────────────────────────────────
-- Shared block set (Conversation Guide question banks).
-- Lack of Control is the fully-seeded end-to-end funnel.
insert into funnels (id, workspace_id, name, slug, segment, offer, status, kicker, problem_copy, stakes, storybrand, variants, blocks, weights, stats) values
('control', 'ws_phoenix', 'Lack of Control', 'lack-of-control',
 'Lack of Control — founders whose business runs them',
 'Free 15-minute conversation — no pitch', 'live',
 'For founders who feel it: Lack of Control',
 'Every decision routes through you. Every fire finds you. You built this company to create freedom—and somewhere along the way, it started controlling you more than you control it.',
 '["You cancel time off because something always breaks while you’re gone.","Decisions your team should own still land on your desk every day.","You’ve delegated before — and quietly taken it all back."]',
 '{"hero":"A founder whose business controls them more than they control it","problem":"Every decision routes through you. Every fire finds you.","guide":"Joshua — \"I’ve sat in your seat.\"","plan":"A free 15-minute conversation. No prep, no pressure, no pitch.","success":"Clarity on the obstacles and what needs attention first"}',
 '[{"id":"A","label":"A","headline":"The business shouldn''t run you.","trafficPct":50,"cvr":"7.1%"},{"id":"B","label":"B","headline":"Take your business back.","trafficPct":50,"cvr":"5.4%"}]',
 '[{"id":"frustration","name":"Frustration deep-dive","desc":"3 questions · Conversation Guide: Lack of Control","required":true,"enabled":true,"order":0},{"id":"firmographics","name":"Business profile","desc":"Industry, revenue, team size, clients, years","required":true,"enabled":true,"order":1},{"id":"contact","name":"Contact info","desc":"Name, email, company, phone, role","required":true,"enabled":true,"order":2},{"id":"ownerJoin","name":"Owner attendance","desc":"Shown only when respondent is not the owner/CEO","required":false,"enabled":true,"order":3,"condition":"role ≠ Owner/Founder and role ≠ CEO/President"},{"id":"coachability","name":"Coachability self-assessment","desc":"2 Likert questions + \"what have you tried\"","required":true,"enabled":true,"order":4}]',
 '{"icpFit":40,"coachability":25,"authority":20,"urgency":15}',
 '{"visits":1284,"leads":86,"cvr":"6.7%"}'),
('profit', 'ws_phoenix', 'Lack of Profit', 'lack-of-profit',
 'Lack of Profit — working too hard for what the business produces',
 'Free 15-minute conversation — no pitch', 'live',
 'For founders who feel it: Lack of Profit',
 'You''re working too hard for what the business produces. The effort is real — the numbers don''t reflect it, and it''s hard to say exactly where it leaks.',
 '["Revenue grows, but the bottom line barely moves.","You quote from gut feel and hope the margin holds.","Payroll clears, and somehow there’s little left for you."]',
 '{"hero":"A founder working too hard for what the business produces","problem":"Working this hard should show up in the numbers.","guide":"Joshua — \"I’ve sat in your seat.\"","plan":"A free 15-minute conversation. No prep, no pressure, no pitch.","success":"Clarity on where the profit is leaking and what to fix first"}',
 '[{"id":"A","label":"A","headline":"Working this hard should show up in the numbers.","trafficPct":100}]',
 '[{"id":"frustration","name":"Frustration deep-dive","desc":"3 questions · Conversation Guide","required":true,"enabled":true,"order":0},{"id":"firmographics","name":"Business profile","desc":"Industry, revenue, team size, clients, years","required":true,"enabled":true,"order":1},{"id":"contact","name":"Contact info","desc":"Name, email, company, phone, role","required":true,"enabled":true,"order":2},{"id":"ownerJoin","name":"Owner attendance","desc":"Shown only when respondent is not the owner/CEO","required":false,"enabled":true,"order":3,"condition":"role ≠ Owner/Founder and role ≠ CEO/President"},{"id":"coachability","name":"Coachability self-assessment","desc":"2 Likert questions + \"what have you tried\"","required":true,"enabled":true,"order":4}]',
 '{"icpFit":40,"coachability":25,"authority":20,"urgency":15}',
 '{"visits":702,"leads":38,"cvr":"5.4%"}'),
('people', 'ws_phoenix', 'People', 'people',
 'People — frustrated with people who aren''t meeting expectations',
 'Free 15-minute conversation — no pitch', 'draft',
 'For founders who feel it: People',
 'You''re frustrated with people who aren''t meeting your expectations — and tired of being the only one who cares as much as you do.',
 '["Expectations feel obvious to you and fuzzy to everyone else.","The same conversations keep getting avoided.","Your best people carry the ones who coast."]',
 '{"hero":"A leader whose people aren''t meeting expectations","problem":"Stop being the only one who cares as much as you do.","guide":"Joshua — \"I’ve sat in your seat.\"","plan":"A free 15-minute conversation. No prep, no pressure, no pitch.","success":"A clear read on the people issues and where to start"}',
 '[{"id":"A","label":"A","headline":"Stop being the only one who cares as much as you do.","trafficPct":100}]',
 '[{"id":"frustration","name":"Frustration deep-dive","desc":"3 questions · Conversation Guide","required":true,"enabled":true,"order":0},{"id":"firmographics","name":"Business profile","desc":"Industry, revenue, team size, clients, years","required":true,"enabled":true,"order":1},{"id":"contact","name":"Contact info","desc":"Name, email, company, phone, role","required":true,"enabled":true,"order":2},{"id":"ownerJoin","name":"Owner attendance","desc":"Shown only when respondent is not the owner/CEO","required":false,"enabled":true,"order":3,"condition":"role ≠ Owner/Founder and role ≠ CEO/President"},{"id":"coachability","name":"Coachability self-assessment","desc":"2 Likert questions + \"what have you tried\"","required":true,"enabled":true,"order":4}]',
 '{"icpFit":40,"coachability":25,"authority":20,"urgency":15}',
 '{"visits":0,"leads":0,"cvr":"—"}'),
('ceiling', 'ws_phoenix', 'Hitting the Ceiling', 'hitting-the-ceiling',
 'Hitting the Ceiling — what got you here won''t get you there',
 'Free 15-minute conversation — no pitch', 'live',
 'For founders who feel it: Hitting the Ceiling',
 'What got you here doesn''t seem capable of getting you to the next level. The company keeps bumping into the same ceiling — and pushing harder isn''t moving it.',
 '["Growth stalled at the same revenue line — again.","What used to work has quietly stopped working.","Everyone’s busy, but the company isn’t moving."]',
 '{"hero":"A founder whose company keeps hitting the same ceiling","problem":"What got you here won’t get you there.","guide":"Joshua — \"I’ve sat in your seat.\"","plan":"A free 15-minute conversation. No prep, no pressure, no pitch.","success":"Clarity on what''s capping growth and what needs attention first"}',
 '[{"id":"A","label":"A","headline":"What got you here won’t get you there.","trafficPct":50},{"id":"B","label":"B","headline":"Break through the ceiling.","trafficPct":50}]',
 '[{"id":"frustration","name":"Frustration deep-dive","desc":"3 questions · Conversation Guide","required":true,"enabled":true,"order":0},{"id":"firmographics","name":"Business profile","desc":"Industry, revenue, team size, clients, years","required":true,"enabled":true,"order":1},{"id":"contact","name":"Contact info","desc":"Name, email, company, phone, role","required":true,"enabled":true,"order":2},{"id":"ownerJoin","name":"Owner attendance","desc":"Shown only when respondent is not the owner/CEO","required":false,"enabled":true,"order":3,"condition":"role ≠ Owner/Founder and role ≠ CEO/President"},{"id":"coachability","name":"Coachability self-assessment","desc":"2 Likert questions + \"what have you tried\"","required":true,"enabled":true,"order":4}]',
 '{"icpFit":40,"coachability":25,"authority":20,"urgency":15}',
 '{"visits":449,"leads":21,"cvr":"4.7%"}'),
('nothing', 'ws_phoenix', 'Nothing Works', 'nothing-works',
 'Nothing Works — the same problems keep coming back',
 'Free 15-minute conversation — no pitch', 'paused',
 'For founders who feel it: Nothing Works',
 'You''ve tried fixing these things before — new hires, new software, new consultants — but the same problems keep coming back.',
 '["Every fix improved things for a month, then faded.","The issues list looks the same as it did last year.","You’re starting to wonder if it’s just how it is."]',
 '{"hero":"A founder who has tried everything and the problems keep returning","problem":"You’ve tried everything. The problems keep coming back.","guide":"Joshua — \"I’ve sat in your seat.\"","plan":"A free 15-minute conversation. No prep, no pressure, no pitch.","success":"An honest read on why fixes haven’t stuck — and what would"}',
 '[{"id":"A","label":"A","headline":"You’ve tried everything. The problems keep coming back.","trafficPct":100}]',
 '[{"id":"frustration","name":"Frustration deep-dive","desc":"3 questions · Conversation Guide","required":true,"enabled":true,"order":0},{"id":"firmographics","name":"Business profile","desc":"Industry, revenue, team size, clients, years","required":true,"enabled":true,"order":1},{"id":"contact","name":"Contact info","desc":"Name, email, company, phone, role","required":true,"enabled":true,"order":2},{"id":"ownerJoin","name":"Owner attendance","desc":"Shown only when respondent is not the owner/CEO","required":false,"enabled":true,"order":3,"condition":"role ≠ Owner/Founder and role ≠ CEO/President"},{"id":"coachability","name":"Coachability self-assessment","desc":"2 Likert questions + \"what have you tried\"","required":true,"enabled":true,"order":4}]',
 '{"icpFit":40,"coachability":25,"authority":20,"urgency":15}',
 '{"visits":188,"leads":6,"cvr":"3.2%"}');

-- ── Pipelines ───────────────────────────────────────────────────────────────
insert into pipelines (id, workspace_id, name, description, stages) values
('prospects', 'ws_phoenix', 'Prospects', 'Potential clients moving from intake to engagement',
 '["New","Qualified","Call scheduled","In conversation"]'),
('clients', 'ws_phoenix', 'Client journey', 'Active clients — tracking the coaching experience end to end',
 '["Onboarding","Foundation","Traction","Graduated"]');

-- ── Contacts ────────────────────────────────────────────────────────────────
insert into contacts (id, workspace_id, pipeline_id, name, company, role, email, funnel, source, score, stage, position, owner, created_at) values
('1',  'ws_phoenix', 'prospects', 'Marcus Webb',     'Webb Mechanical',               'Owner / Founder',  'marcus@webbmech.com',          'Lack of Control',     'google / cpc',       88, 1, 0, 'Joshua', '2026-09-01T13:14:02Z'),
('2',  'ws_phoenix', 'prospects', 'Sarah Delgado',   'Delgado Electric',              'CEO / President',  'sarah@delgadoelectric.com',    'Lack of Control',     'linkedin / organic', 76, 2, 0, 'Joshua', '2026-08-30T10:00:00Z'),
('3',  'ws_phoenix', 'prospects', 'Tom Brantley',    'Brantley HVAC',                 'Owner / Founder',  'tom@brantleyhvac.com',         'Lack of Profit',      'referral',           91, 2, 1, 'Joshua', '2026-08-29T15:20:00Z'),
('4',  'ws_phoenix', 'prospects', 'Priya Nair',      'Nair Consulting',               'COO / Operations', 'priya@nairconsulting.com',     'People',              'newsletter',         54, 0, 0, '—',      '2026-08-28T09:00:00Z'),
('5',  'ws_phoenix', 'prospects', 'Dale Hutchins',   'Hutchins Plumbing Co.',         'Owner / Founder',  'dale@hutchinsplumbing.com',    'Lack of Control',     'google / cpc',       83, 3, 0, 'Joshua', '2026-08-26T11:45:00Z'),
('6',  'ws_phoenix', 'prospects', 'Renee Alcott',    'Alcott Landscapes',             'Owner / Founder',  'renee@alcottlandscapes.com',   'Hitting the Ceiling', 'facebook / paid',    67, 1, 1, 'Joshua', '2026-08-25T16:30:00Z'),
('7',  'ws_phoenix', 'prospects', 'Gene Park',       'Park Manufacturing',            'Other leadership', 'gene@parkmfg.com',             'Nothing Works',       'referral',           41, 0, 1, '—',      '2026-08-24T14:00:00Z'),
('8',  'ws_phoenix', 'clients',   'Chris Crew',      'The Blue Collar Success Group', 'President',        'chris@bluecollarsuccess.com',  'Referral',            'referral',           91, 2, 0, 'Joshua', '2026-05-01T09:00:00Z'),
('9',  'ws_phoenix', 'clients',   'Danielle Putnam', 'The New Flat Rate',             'CEO / President',  'danielle@newflatrate.com',     'Referral',            'referral',           88, 2, 1, 'Joshua', '2026-04-12T09:00:00Z'),
('10', 'ws_phoenix', 'clients',   'Lincoln Higdon',  'Centerpoint IT',                'CEO / President',  'lincoln@centerpointit.com',    'Lack of Control',     'google / cpc',       84, 1, 0, 'Joshua', '2026-06-20T09:00:00Z'),
('11', 'ws_phoenix', 'clients',   'Teresa Vance',    'Vance Roofing',                 'Owner / Founder',  'teresa@vanceroofing.com',      'Hitting the Ceiling', 'referral',           79, 0, 0, 'Joshua', '2026-08-18T09:00:00Z');

-- ── Activities (timeline seeds for each contact) ────────────────────────────
insert into activities (workspace_id, contact_id, type, title, body, at)
select 'ws_phoenix', c.id, a.type, a.title, a.body, a.at::timestamptz
from contacts c
cross join lateral (values
  ('email',            'Confirmation email sent',                    'SendGrid · intake-confirmation template · delivered',                                                                              '2026-09-01T13:15:00Z'),
  ('intake_completed', 'Intake completed — scored ' || c.score,      'Least control: scheduling, team accountability. "Every pricing call still comes to me." Coachability 4/5 and 5/5.',                '2026-09-01T13:14:00Z'),
  ('intake_started',   'Intake started',                             'Landed on /lack-of-control (variant A) · ' || c.source,                                                                            '2026-09-01T13:08:00Z'),
  ('view',             'Page view',                                  'utm_campaign=founders-q3 · first visit',                                                                                           '2026-09-01T13:06:00Z')
) as a(type, title, body, at)
where c.workspace_id = 'ws_phoenix';

-- ── CMS pages ───────────────────────────────────────────────────────────────
insert into cms_pages (workspace_id, id, name, meta, sections, sort) values
('ws_phoenix', 'home', 'Homepage', '6 sections · Published',
 '[{"id":"hero","name":"Hero","desc":"Headline, frustration selector, primary CTA","enabled":true},{"id":"howwho","name":"How It Works + Who We Help","desc":"Two-column: 4 steps, 4 traits, inline testimonial","enabled":true},{"id":"guideband","name":"Guide band","desc":"Compact intro linking to the guide page","enabled":true},{"id":"results","name":"Client Perspectives","desc":"3 testimonial cards","enabled":true},{"id":"faq","name":"FAQ","desc":"4 questions, accordion","enabled":true},{"id":"footer","name":"Footer CTA","desc":"Ready to take the first step + schedule button","enabled":true}]', 0),
('ws_phoenix', 'guide', 'Meet Your Guide', '4 sections · Published',
 '[{"id":"ghero","name":"Guide hero","desc":"Circular photo, story, CTA — pulls from Guide identity","enabled":true},{"id":"gpillars","name":"Experience pillars","desc":"3 columns of background","enabled":true},{"id":"gquotes","name":"Guide testimonials","desc":"2 attributed quotes","enabled":true},{"id":"gfooter","name":"Footer CTA","desc":"Shared footer module","enabled":true}]', 1),
('ws_phoenix', 'results', 'Results (private)', '5 sections · Link-only',
 '[{"id":"rhero","name":"Results hero","desc":"EOS framing statement","enabled":true},{"id":"rstats","name":"Headline metrics","desc":"2.8× study, 100K+ adoption, six components","enabled":true},{"id":"rcomponents","name":"Six Key Components","desc":"V/P/D/I/Pr/T cards with results","enabled":true},{"id":"rtimeline","name":"What owners see, and when","desc":"90 days / year one / year two+","enabled":true},{"id":"rproof","name":"Client proof","desc":"4 quotes + trademark attribution","enabled":true}]', 2),
('ws_phoenix', 'funnelTpl', 'Funnel template', 'StoryBrand · 5 blocks',
 '[{"id":"fhero","name":"StoryBrand hero","desc":"Hero/problem/guide/plan/success — per-funnel copy","enabled":true},{"id":"fstakes","name":"Sound familiar card","desc":"3 stakes + guide credibility note","enabled":true},{"id":"fintake","name":"Intake form","desc":"Modular blocks — managed per funnel","enabled":true},{"id":"fschedule","name":"Scheduler","desc":"Post-submit booking step","enabled":true}]', 3);

-- ── Sequences ───────────────────────────────────────────────────────────────
insert into sequences (id, workspace_id, name, trigger, active, stat, stat_label, steps) values
('seq1', 'ws_phoenix', 'Booked call — reminders', 'intake.completed + slot booked', true, '94%', 'show rate',
 '[{"kind":"Email","label":"Confirmation (immediate)"},{"kind":"Email","label":"Reminder — 24h before"},{"kind":"Email","label":"Reminder — 1h before"},{"kind":"CRM","label":"Stage → Call scheduled"}]'),
('seq2', 'ws_phoenix', 'No-show recovery', 'call marked no-show', true, '41%', 'rebook rate',
 '[{"kind":"Email","label":"\"We missed you\" + rebook link (1h)"},{"kind":"Task","label":"Owner: personal follow-up (day 2)"},{"kind":"Email","label":"Last nudge (day 5)"},{"kind":"CRM","label":"No response → stage Dormant"}]'),
('seq3', 'ws_phoenix', 'Post-call follow-through', 'call logged as completed', true, '2.4d', 'avg. next step',
 '[{"kind":"Task","label":"Owner: send recap notes (same day)"},{"kind":"Email","label":"Recap + proposed next step"},{"kind":"CRM","label":"Stage → In conversation"},{"kind":"Zap","label":"stage.changed webhook"}]'),
('seq4', 'ws_phoenix', 'Abandoned intake', 'intake started, idle 24h', false, '18%', 'resume rate',
 '[{"kind":"Email","label":"\"Pick up where you left off\" (24h)"},{"kind":"Email","label":"Value nudge: results page link (day 3)"}]');

-- ── Webhook endpoints ───────────────────────────────────────────────────────
insert into webhook_endpoints (id, workspace_id, event, description, active) values
('wh1', 'ws_phoenix', 'lead.created',     'New intake submission',          true),
('wh2', 'ws_phoenix', 'intake.completed', 'All steps finished',             true),
('wh3', 'ws_phoenix', 'lead.qualified',   'Score crosses threshold (70)',   true),
('wh4', 'ws_phoenix', 'stage.changed',    'Pipeline stage moved',           false);

-- ── Sync log ────────────────────────────────────────────────────────────────
insert into sync_log (workspace_id, at_label, msg, state) values
('ws_phoenix', '09:41', 'Contacts batch → HubSpot (12 records)', 'ok'),
('ws_phoenix', '09:41', 'Deals pull ← HubSpot (3 updated)', 'ok'),
('ws_phoenix', '09:12', 'Contact update → HubSpot (marcus@webbmech.com)', 'ok'),
('ws_phoenix', '08:55', 'Companies batch → HubSpot (429 rate limit)', 'retried'),
('ws_phoenix', '08:55', 'Retry succeeded after backoff (2.1s)', 'ok'),
('ws_phoenix', '08:20', 'Field mapping validated (14 fields, 2-way)', 'ok');

-- ── Subscriptions ───────────────────────────────────────────────────────────
insert into subscriptions (id, workspace_id, workspace_name, domain, plan, since, amount_monthly, state, trial_days_left) values
('sub1', 'ws_phoenix',    'Phoenix Operations', 'phoenixoperations.com',      'network',  'Jan 2026', 399, 'active', null),
('sub2', 'ws_bluecollar', 'Blue Collar Ops',    'ops.bluecollarsuccess.com',  'practice', 'Mar 2026', 179, 'active', null),
('sub3', 'ws_alcott',     'Alcott Operations',  'alcottops.com',              'solo',     'Aug 2026', 79,  'trial',  9);

-- ── Scoring defaults ────────────────────────────────────────────────────────
insert into scoring_rules (workspace_id, weights, threshold) values
('ws_phoenix', '{"icpFit":40,"coachability":25,"authority":20,"urgency":15}', 70);
