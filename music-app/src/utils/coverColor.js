export const DEFAULT_PLAYER_COLOR = '#34d399';

const toHex = (value) => Math.round(value).toString(16).padStart(2, '0');

export function selectDominantColor(pixelData) {
  const buckets = new Map();

  for (let index = 0; index < pixelData.length; index += 4) {
    const alpha = pixelData[index + 3];
    if (alpha < 128) continue;

    const red = pixelData[index];
    const green = pixelData[index + 1];
    const blue = pixelData[index + 2];
    const key = `${red >> 4}-${green >> 4}-${blue >> 4}`;
    const bucket = buckets.get(key) || { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
  }

  let winner = null;
  let winnerScore = -1;
  buckets.forEach((bucket) => {
    const red = bucket.red / bucket.count;
    const green = bucket.green / bucket.count;
    const blue = bucket.blue / bucket.count;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const saturation = maximum ? (maximum - minimum) / maximum : 0;
    const luminance = (red * 0.299) + (green * 0.587) + (blue * 0.114);
    const usableBrightness = luminance > 18 && luminance < 242 ? 1 : 0.25;
    const score = bucket.count * (0.45 + saturation) * usableBrightness;
    if (score > winnerScore) {
      winner = { red, green, blue, luminance };
      winnerScore = score;
    }
  });

  if (!winner) return DEFAULT_PLAYER_COLOR;

  // Keep controls visible over the dark player without losing the cover hue.
  if (winner.luminance < 72) {
    const blend = (72 - winner.luminance) / 150;
    winner.red += (255 - winner.red) * blend;
    winner.green += (255 - winner.green) * blend;
    winner.blue += (255 - winner.blue) * blend;
  }

  return `#${toHex(winner.red)}${toHex(winner.green)}${toHex(winner.blue)}`;
}

export function colorWithAlpha(hexColor, alpha) {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hexColor);
  if (!match) return `rgba(52, 211, 153, ${alpha})`;
  return `rgba(${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}, ${alpha})`;
}

export function extractCoverColor(source) {
  if (!source || typeof window === 'undefined') return Promise.resolve(DEFAULT_PLAYER_COLOR);

  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 48;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
          resolve(DEFAULT_PLAYER_COLOR);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(selectDominantColor(context.getImageData(0, 0, canvas.width, canvas.height).data));
      } catch {
        resolve(DEFAULT_PLAYER_COLOR);
      }
    };
    image.onerror = () => resolve(DEFAULT_PLAYER_COLOR);
    image.src = source;
  });
}
