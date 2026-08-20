/**
 * Tiện ích xử lý ảnh — resize trước khi upload để tránh timeout
 */

/** Resize ảnh về base64 với maxWidth và quality cho trước */
export function resizeImage(file: File, maxWidth: number, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.onload = () => {
                let { width, height } = img;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
                resolve(base64);
            };
            img.onerror = () => {
                // Fallback: gửi nguyên gốc nếu resize thất bại
                resolve((e.target?.result as string).split(',')[1]);
            };
            img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
