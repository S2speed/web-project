import { LIBRARY_SORT_OPTIONS } from '@/utils/constants';
import { buildLibraryAlbums, filterAndSortAlbums, filterAndSortSingles } from '@/utils/library';

const artists = [
  { id: 'artist-1', stageName: 'Aurora Lane' },
  { id: 'artist-2', stageName: 'Midnight Echo' },
];

const albums = [
  { id: 'album-1', title: 'Northern Lights', artistId: 'artist-1', genre: 'pop', releaseDate: '2024-01-01' },
  { id: 'album-2', title: 'Static Hearts', artistId: 'artist-2', genre: 'rock', releaseDate: '2025-01-01' },
];

const songs = [
  { id: 'track-1', title: 'Glow', artistId: 'artist-1', albumId: 'album-1', listeners: 40 },
  { id: 'track-2', title: 'Sky', artistId: 'artist-1', albumId: 'album-1', listeners: 60 },
  { id: 'single-1', title: 'Quiet Night', artistId: 'artist-2', isSingle: true, listeners: 200, releaseDate: '2023-01-01', genre: 'rock', artist: artists[1] },
  { id: 'single-2', title: 'New Dawn', artistId: 'artist-1', isSingle: true, listeners: 50, releaseDate: '2025-02-01', genre: 'pop', artist: artists[0] },
];

describe('library utilities', () => {
  test('enriches albums with their artist, tracks, and combined listener count', () => {
    const result = buildLibraryAlbums(albums, songs, artists);

    expect(result[0]).toMatchObject({
      id: 'album-1',
      artist: artists[0],
      listeners: 100,
      songs: [songs[0], songs[1]],
    });
  });

  test('searches albums by artist or genre and sorts matches by listeners', () => {
    const enriched = buildLibraryAlbums(albums, songs, artists);
    const artistMatch = filterAndSortAlbums(enriched, 'aurora', LIBRARY_SORT_OPTIONS.LISTENERS);
    const genreMatch = filterAndSortAlbums(enriched, 'rock', LIBRARY_SORT_OPTIONS.RELEASE_DATE);

    expect(artistMatch.map((album) => album.id)).toEqual(['album-1']);
    expect(genreMatch.map((album) => album.id)).toEqual(['album-2']);
  });

  test('returns only matching singles in the selected sort order', () => {
    const byListeners = filterAndSortSingles(songs, '', LIBRARY_SORT_OPTIONS.LISTENERS);
    const searched = filterAndSortSingles(songs, 'aurora', LIBRARY_SORT_OPTIONS.RELEASE_DATE);

    expect(byListeners.map((song) => song.id)).toEqual(['single-1', 'single-2']);
    expect(searched.map((song) => song.id)).toEqual(['single-2']);
  });
});
