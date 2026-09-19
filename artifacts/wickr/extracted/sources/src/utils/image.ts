/**
 * Converts an SVG element to a base64-encoded PNG
 * @param svgElement The SVG element to convert
 * @param size The size of the output image (width and height)
 * @returns A Promise that resolves to the base64-encoded PNG data URL
 */
export const svgToBase64 = (svgElement: SVGElement, size: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(img, 0, 0);

        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error('Error loading SVG as image'));
      img.src = svgDataUrl;
    } catch (error) {
      reject(error);
    }
  });
};
