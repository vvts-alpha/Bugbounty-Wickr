// Cat mode utility - replaces profile photos with random cat images
export const getCatImageUrl = (userId: string): string => {
  // Use userId as seed for consistent cat per user
  const seed = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const catId = (seed % 100) + 1; // 100 different cats
  return `/imgs/cats/cat-${catId}.jpg`;
};
