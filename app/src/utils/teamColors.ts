export interface TeamColor {
  primary: string;
  secondary: string;
  name: string;
}

// Canonical 32-team palette (primary / secondary / short name).
const TEAMS: Record<string, TeamColor> = {
  ARI: { primary: "#97233F", secondary: "#FFB612", name: "Cardinals" },
  ATL: { primary: "#A71930", secondary: "#000000", name: "Falcons" },
  BAL: { primary: "#241773", secondary: "#9E7C0C", name: "Ravens" },
  BUF: { primary: "#00338D", secondary: "#C60C30", name: "Bills" },
  CAR: { primary: "#0085CA", secondary: "#101820", name: "Panthers" },
  CHI: { primary: "#0B162A", secondary: "#C83803", name: "Bears" },
  CIN: { primary: "#FB4F14", secondary: "#000000", name: "Bengals" },
  CLE: { primary: "#311D00", secondary: "#FF3C00", name: "Browns" },
  DAL: { primary: "#003594", secondary: "#869397", name: "Cowboys" },
  DEN: { primary: "#FB4F14", secondary: "#002244", name: "Broncos" },
  DET: { primary: "#0076B6", secondary: "#B0B7BC", name: "Lions" },
  GB: { primary: "#203731", secondary: "#FFB612", name: "Packers" },
  HOU: { primary: "#03202F", secondary: "#A71930", name: "Texans" },
  IND: { primary: "#002C5F", secondary: "#A2AAAD", name: "Colts" },
  JAX: { primary: "#006778", secondary: "#D7A22A", name: "Jaguars" },
  KC: { primary: "#E31837", secondary: "#FFB81C", name: "Chiefs" },
  LAC: { primary: "#0080C6", secondary: "#FFC20E", name: "Chargers" },
  LAR: { primary: "#003594", secondary: "#FFA300", name: "Rams" },
  LV: { primary: "#101820", secondary: "#A5ACAF", name: "Raiders" },
  MIA: { primary: "#008E97", secondary: "#FC4C02", name: "Dolphins" },
  MIN: { primary: "#4F2683", secondary: "#FFC62F", name: "Vikings" },
  NE: { primary: "#002244", secondary: "#C60C30", name: "Patriots" },
  NO: { primary: "#101820", secondary: "#D3BC8D", name: "Saints" },
  NYG: { primary: "#0B2265", secondary: "#A71930", name: "Giants" },
  NYJ: { primary: "#125740", secondary: "#C4C8CB", name: "Jets" },
  PHI: { primary: "#004C54", secondary: "#A5ACAF", name: "Eagles" },
  PIT: { primary: "#101820", secondary: "#FFB612", name: "Steelers" },
  SEA: { primary: "#002244", secondary: "#69BE28", name: "Seahawks" },
  SF: { primary: "#AA0000", secondary: "#B3995D", name: "49ers" },
  TB: { primary: "#D50A0A", secondary: "#FF7900", name: "Buccaneers" },
  TEN: { primary: "#0C2340", secondary: "#4B92DB", name: "Titans" },
  WAS: { primary: "#5A1414", secondary: "#FFB612", name: "Commanders" },
};

// Older abbreviations for players whose last season predates a relocation.
const ALIASES: Record<string, string> = {
  SD: "LAC",
  OAK: "LV",
  STL: "LAR",
  LA: "LAR",
  JAC: "JAX",
  WSH: "WAS",
};

const NEUTRAL: TeamColor = { primary: "#3a4356", secondary: "#8c99ad", name: "" };

/** Resolve a team abbreviation (incl. relocation aliases) to its colors; falls
 * back to a neutral slate for null/unknown. */
export function teamColors(team: string | null | undefined): TeamColor {
  if (!team) return NEUTRAL;
  const key = ALIASES[team] ?? team;
  return TEAMS[key] ?? { ...NEUTRAL, name: team };
}
