import { LIBRARY_SORT_OPTIONS } from '@/utils/constants';

export function getArtistName(artist) {
  return artist?.stageName || artist?.user?.displayName || 'هنرمند';
}

function normalizeQuery(query) {
  return String(query || '').trim().toLowerCase();
}

function sortBySelection(items, sortBy) {
  return [...items].sort((left, right) => {
    if (sortBy === LIBRARY_SORT_OPTIONS.LISTENERS) {
      return (Number(right.listeners) || 0) - (Number(left.listeners) || 0);
    }

    return new Date(right.releaseDate || 0) - new Date(left.releaseDate || 0);
  });
}

export function buildLibraryAlbums(albums, songs, artists) {
  const artistMap = new Map(artists.map((artist) => [artist.id, artist]));

  return albums.map((album) => {
    const albumSongs = songs.filter((song) => song.albumId === album.id);

    return {
      ...album,
      artist: artistMap.get(album.artistId),
      songs: albumSongs,
      listeners: albumSongs.reduce((sum, song) => sum + (Number(song.listeners) || 0), 0),
    };
  });
}

export function filterAndSortAlbums(albums, query, sortBy = LIBRARY_SORT_OPTIONS.RELEASE_DATE) {
  const normalizedQuery = normalizeQuery(query);
  const filtered = albums.filter((album) => {
    const haystack = [album.title, getArtistName(album.artist), album.genre].join(' ').toLowerCase();
    return !normalizedQuery || haystack.includes(normalizedQuery);
  });

  return sortBySelection(filtered, sortBy);
}

export function filterAndSortSingles(songs, query, sortBy = LIBRARY_SORT_OPTIONS.RELEASE_DATE) {
  const normalizedQuery = normalizeQuery(query);
  const filtered = songs.filter((song) => {
    const isSingle = song.isSingle || !song.albumId;
    const haystack = [song.title, getArtistName(song.artist), song.album?.title, song.genre].join(' ').toLowerCase();
    return isSingle && (!normalizedQuery || haystack.includes(normalizedQuery));
  });

  return sortBySelection(filtered, sortBy);
}
