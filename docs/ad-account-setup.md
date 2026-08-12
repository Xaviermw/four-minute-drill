# Ad account setup — owner runbook (July 2026)

Three accounts for the $100 smoke test ($40 Reddit / $40 Meta / $20 X, per
marketing-automation-plan.md §B). Use the brand mailbox everywhere. Create
accounts + payment only — **no campaigns**; paste-ready specs and creatives
come from Claude once accounts exist. All three platforms will email "boost
now!" nags forever — ignore them.

## 1. Reddit Ads (~10 min)

1. ads.reddit.com → Sign up. Fresh advertiser account under the brand email
   is fine (the ads profile is separate from organic Reddit).
2. Business details: name **Four Minute Drill**, site
   `https://www.fourminutedrill.com`, industry Gaming/Entertainment, USD.
3. Billing → add the card. (The $40 cap is enforced as a LIFETIME budget on
   the campaign itself — that's in the spec I'll send.)
4. Decline every onboarding upsell: automated/expanded targeting, Reddit
   Pixel (UTM + our own analytics cover attribution).
5. Stop when you reach the "create your first campaign" screen.

## 2. Meta / Facebook + Instagram (~20 min, the fiddly one)

1. You must start from your REAL personal Facebook account — Meta anchors
   business assets to a person, and a fresh throwaway "personal" account is
   the #1 cause of instant unappealable bans. Your personal profile is never
   shown on ads.
2. business.facebook.com → **Create a business portfolio**: name Four Minute
   Drill, brand email.
3. Create the **Facebook Page** (Business settings → Accounts → Pages → Add
   → Create): name **Four Minute Drill**, category Games/Gaming. Bio:
   "Draft 6 NFL players under a $25 cap. One drive to win it. New drill
   daily." Add the site link + logo (use `app/public/og.png` crop).
4. Ad account (Business settings → Accounts → Ad accounts → Add → **Create a
   new ad account**): currency USD, timezone America/New_York, attach your
   card.
5. **Set the hard cap**: Billing & payments → Payment settings → **Account
   spending limit → $40**. Meta honors this absolutely.
6. Skip pixel setup, WhatsApp linking, and Advantage+ prompts. Instagram
   placement works through the Page — no separate IG account needed.
7. Expect a short new-account review; ads may sit "in review" a day or two
   the first time. Normal.

**If Meta blocks the new business account** ("not allowed to advertise" —
hit 2026-08-07; newborn Business portfolios get auto-flagged): request
review at facebook.com/accountquality, then don't wait — take the
personal-profile path, which skips Business Manager entirely and is the
normal route at this scale:

1. Create the Page from your personal profile: **facebook.com/pages/create**
   (same name/category/bio as above).
2. Run ads from your personal Ads Manager: **adsmanager.facebook.com** —
   every profile gets an ad account; add the card there.
3. Set the hard cap there too: Billing → Payment settings → **Account
   spending limit → $40**.

## 3. X Ads (~5 min)

1. Log in to x.com AS @fourminutedrill, then go to ads.x.com.
2. First screen asks country + timezone — **these are permanent**: United
   States / Eastern.
3. Add the card under Payment methods. New X ads accounts sometimes take a
   few days of review before they'll serve — start this one early.
4. X has no account-level cap → the $20 lives in the campaign's total budget
   (in my spec). Ignore "Quick Promote" upsells.

## When done

Tell Claude which accounts exist. You'll get back, per platform: campaign
settings to paste (objective, targeting, bid, budget with the cap baked in),
UTM-tagged landing URLs, and finished creative images. You paste, approve,
and set it live ~Aug 25.
