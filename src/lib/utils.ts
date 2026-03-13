export function fixPhotoUrl(url: string | null | undefined, name: string = 'player'): string {
    if (!url || url.trim() === '') {
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
    }

    const lowerUrl = url.toLowerCase();

    // 1. Handle Supabase Storage URLs (return as is)
    if (lowerUrl.includes('.supabase.co')) {
        return url;
    }

    // 2. Handle Google Drive URLs
    if (lowerUrl.includes('drive.google.com') ||
        lowerUrl.includes('docs.google.com/uc') ||
        lowerUrl.includes('lh3.googleusercontent.com') ||
        lowerUrl.includes('googleusercontent.com/d/')) {

        let driveId = '';

        // Pattern match for ID
        if (url.includes('id=')) {
            driveId = url.split('id=')[1].split('&')[0];
        } else if (url.includes('/d/')) {
            const parts = url.split('/d/');
            if (parts.length > 1) {
                driveId = parts[1].split('/')[0].split('?')[0].split('=')[0];
            }
        } else if (url.includes('open?id=')) {
            driveId = url.split('open?id=')[1].split('&')[0];
        }

        if (driveId) {
            // The /uc?export=view&id= format is the most widely supported for direct embedding
            return `https://docs.google.com/uc?export=view&id=${driveId}`;
        }
    }

    // 3. Fallback for mixed protocols or direct images
    return url;
}
