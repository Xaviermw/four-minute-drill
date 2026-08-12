# Campaign paste-sheets

Everything needed to rebuild a campaign without chat archaeology. Creative
images live in `docs/ad-creatives/`.

## Trickle (Aug 13 – Sep 5) — continuous QA stream

Reddit Ads → Create Campaign (Max flow; Duplicate is disabled for Max
campaigns, build fresh):

- Name: `4md-trickle`
- Objective: Traffic · Bid: Lowest cost
- Destination URL:
  `https://www.fourminutedrill.com/?utm_source=reddit&utm_medium=cpc&utm_campaign=trickle`
- Communities: r/fantasyfootball, r/DynastyFF, r/nfl (+ r/SalaryCapFantasy
  optional) — pick from the dropdown so they become pills; estimates panel
  should read in the millions
- Interest groups: empty · Location: United States · Devices: all
- Budget: **$2/day DAILY** (not lifetime) · Schedule: **Aug 13 → Sep 5**
- Media: the three `*-1200x628.png` boards · Thumbnails: the three
  `thumb-*.png`
- CTA: Play Now

### The 15 headlines

1. `Test your NFL IQ in Four Minute Drill`
2. `Stop waiting for Sunday. Get your football fix with Four Minute Drill and put your salary cap skills to the test today.`
3. `Ditch the season-long grind. Test your NFL IQ with Four Minute Drill and compete for daily wins.`
4. `Draft 6 NFL players under $25. One drive to win it. Same board as everyone today.`
5. `Think you can call a better drive than your coach? Prove it in Four Minute Drill, the daily football strategy game.`
6. `You have $25 – draft a roster and score as time expires`
7. `Test your NFL IQ. Play now.`
8. `Down 3, 4 Minutes on the Clock. Draft your team and win`
9. `Have the Clutch gene? Draft the winning drive`
10. `Our robot coach scored 9 points today. Beat him or live with that.`
11. `$25 cap. Studs cost $10. Kickers cost $1. Choose your pain.`
12. `4th & 12, down 3, no timeouts. What's the call?`
13. `The all-$1 roster has never once been the right answer. Prove us wrong.`
14. `Everyone gets the same board at midnight. One drive. No do-overs.`
15. `Real players, a decade of real play-by-play. Two minutes a day.`

("daily fantasy" phrasing stays banned — reads as DFS gambling to reviewers.)

## Finding (Aug 13, smoke-test Assets tab): one combo took every impression

Reddit Max does NOT rotate assets at small budgets -- it elected one combo
immediately and served it 7,226/7,226: **coach-bot board + "Our robot coach
scored 9 points today. Beat him or live with that." + Play Now**. All other
headlines/images: zero impressions. So the 4.0% CTR belongs entirely to the
robot-coach taunt -- the cleanest possible single-creative result, and the
proven kickoff lead. Corollary: passive A/B doesn't happen in Max; to learn
a runner-up, test SEQUENTIALLY (pause the coach-bot headline in the trickle
for ~a week and let the algorithm elect #2).

## Kickoff burst (Sep 8–14) — TBD after the Meta test

Reddit ≥ $40 leading with the PROVEN combo (coach-bot board + robot-coach
taunt headline); runner-up creative from the trickle's sequential test.
Meta allocation decided by its $40 test. Benchmarks to beat: $0.14 CPC,
4.0% CTR, ~$0.25/player.
