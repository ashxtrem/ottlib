const preferredGenres = ['Action', 'Comedy', 'Drama', 'Thriller', 'Science Fiction', 'Animation', 'Crime', 'Horror', 'Romance', 'Adventure'];

/** A handful of familiar genre rows, falling back to whatever genres the library has. Mirrors HomeViewModel.homeGenres on Android. */
export function homeGenres(available: string[], count = 6): string[] {
  return [...new Set([...preferredGenres.filter((genre) => available.includes(genre)), ...[...available].sort()])].slice(0, count);
}
