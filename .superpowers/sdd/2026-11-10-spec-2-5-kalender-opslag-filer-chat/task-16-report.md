# Task 16 report: satire v2

Changed: lib/satire-posts.json replaced with v2 (30 posts; inspiration/sources still stripped on load); components/icons.tsx (old `maske` icon removed, new own inline-SVG `klovn`: 3-point jester hat, 3 bells, face; Icon now emits data-icon={name}); SatireCard uses `klovn`, and splits body on single newlines (v2 bodies use \n between lines); lib/satire.ts comment only. Labelling/isolation untouched.
Tests: tests/satire.test.ts rewritten for the new rules (30 ids, body 40-300, title <=60, "(fiktiv)", 6 important, 10 with comments, comments 10-120, no http/@/6+ digits, no inspiration/sources); pickSatire clamp test uses satirePosts.length. tests/satire-card.test.ts: added joker-icon assertion (aria-hidden span + svg aria-hidden + data-icon="klovn"); existing assertions kept.
RED/GREEN: after swapping the JSON the data tests were already green (content-only change, copied before running). The card test was RED (icon assertion failed) then GREEN after the icon change.
De-hardcoded counts: tests/satire.test.ts (24 -> satirePosts.length), lib/satire.ts comment. No UI text mentioned a number. Mask only used in SatireCard.
Verification: npm test 35 files / 646 passed; typecheck clean; build OK (tsconfig.json unchanged); curl / -> 307.
Not verified visually: the joker icon's look at 26px (never viewed in browser); no new colours, contrast untouched.
