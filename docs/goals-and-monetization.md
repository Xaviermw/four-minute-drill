# What the advertising is for, and where money could come from

Written Aug 28, before the kickoff burst, because "get traffic" is not a
goal — it's an activity. Roughly $155 has gone into ads so far (smoke $39,
trickle ~$75, Meta $40). Revenue is $0 and will stay $0 for a while. That
asymmetry has to shape every decision below.

## 1. What ads can and cannot do here

Every ad dollar is pure cost — there is no revenue to recoup it, so paid
traffic can never be the growth engine. What it CAN do is buy **critical
mass for mechanics that only work with a crowd**:

- A daily leaderboard with 5 names is a list. With 50 it is a competition.
- A season table nobody is climbing is furniture. With 100 players, rank
  movement is the reason to come back tomorrow.
- Ghost links only spread if the sender believes a friend will care.

So the real purpose of the spend is: **seed enough simultaneous players that
the social layer switches on, then find out whether the game holds them
without paying.** Ads buy the first cohort; the product has to buy the rest.

## 2. Goals for kickoff (numbers, not vibes)

Baseline on Aug 28: 4–11 daily players, 79 named all-time, 33% of named
players multi-day, ~$0.27 per acquired playing device.

| Horizon | Goal | Why this number |
|---|---|---|
| **Sep 17** (burst +1wk) | **40+ daily players** | Enough that the daily board and season table feel populated; ~5x today |
| **Sep 17** | **≥10% of burst devices play 2+ separate days** | Today's equivalent is ~4–5% of devices; the season table should move it |
| **Sep 30** | **25+ daily players with ads OFF** | The only honest test of whether the habit is real |
| **Sep 30** | **≥25% of new players arrive un-tagged (organic/shared)** | Proves the loop spreads without spend |
| **Oct 31** | **100+ daily players** | The floor where monetization is even discussable |

The one that matters most is **Sep 30 with ads off**. Everything else can be
bought; that one can't.

## 3. The monetization ladder

Each rung has an audience size that unlocks it. Attempting a rung early
costs more in product quality than it earns.

**Rung 0 — now to ~1,000 daily players: monetize nothing.**
Costs are near-zero (Supabase + Vercel free tiers, ~$10/yr domain, pennies
of X API). There is no revenue model that pays better at this scale than
the damage a first ad slot does to a 90-second game.

**Rung 1 — ~1,000+ daily: a premium tier ("Drill Pass", $2–3/mo).**
The natural unlocks, all of which already exist as deferred specs: play any
past daily from the archive, unlimited free-play, deeper post-drive stats
(the counterfactual coach's note), custom scenarios. Requires accounts —
this is the moment Google SSO earns its friction, not before. Expect 1–3%
conversion: 1,000 daily → $20–90/mo. Small, but it is real revenue from
people who love the thing, and it doesn't degrade the free game.

**Rung 2 — ~5,000+ daily: sponsorship of the daily drill.**
"Today's drill presented by X" reads as natural in sports, unlike banner
ads. Fantasy tools and podcast networks are the honest buyers. One
mid-sized sponsor at $200–500/mo beats any display-ad setup at that scale
and costs the player nothing.

**Rung 3 — opportunistic at ANY size: white-label / B2B.**
The genuinely valuable asset is not the audience — it is the engine and
the data pipeline. A fantasy site, a podcast, or a team's media arm could
want a branded version with their own board (the "theme day" idea already
scaffolded in `capForChallenge`). One deal at $2–5k dwarfs years of the
other rungs. This is worth pursuing whenever an inbound appears, and it is
the strongest reason to keep the code clean and the engine framework-free.

**Deliberately rejected:** display ads (needs ~50k sessions/mo to pay
meaningfully, and wrecks a 90-second game), and sportsbook/DFS affiliate
money (lucrative, but it would poison the "this is not gambling"
positioning that makes the game shareable in the first place).

## 4. The honest checkpoint

If, by **Sep 30 with ads off**, daily players sit under ~15, the truthful
read is that this is an excellent portfolio piece and a fun hobby, not a
business — and the right move is to stop spending, keep the bot running,
and let it exist. That is a legitimate outcome, and deciding it in advance
is what keeps it from becoming an expensive slow discovery.
