const newsBlacklist = [
    "imdb",
    "MSN",
    "Yahoo",
    "critical role",
    /\b(?:play|serv|emphasiz|highlight|underlin|fill|form|perform)[a-z]*\s+(?:a\s+)?critical\s+role\b/gimu,
];

export default newsBlacklist;
