const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN;

if (!TMDB_READ_TOKEN) {
  throw new Error(
    "TMDB_READ_TOKEN is not set. Copy server/.env.example to server/.env and fill in the missing token"
  );
}

export const config = {
  tmdb: {
    readToken: TMDB_READ_TOKEN,
    baseUrl: "https://api.themoviedb.org/3",
    imageBaseUrl: "https://image.tmdb.org/t/p",
  },
} as const;