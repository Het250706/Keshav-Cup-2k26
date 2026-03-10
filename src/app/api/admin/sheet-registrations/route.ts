
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const sheetId = '1zyokrUHFwtDuLqsxQXwPANm4ezK7ao81QfyWEnBv7Tk';
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;

        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            throw new Error(`Failed to fetch sheet: ${res.statusText}`);
        }

        const text = await res.text();

        // Parse the returned text because Google wraps the JSON in a callback-like structure
        // google.visualization.Query.setResponse({"version":"0.6", ...});
        const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
        if (!match) {
            throw new Error('Invalid response format from Google Sheets proxy');
        }

        const json = JSON.parse(match[1]);
        const rows = json.table.rows;

        // Map rows into objects using the sheet headers
        // Based on the sheet structure:
        // Index 0: Timestamp
        // Index 1: NAME Eng (First middle surname)
        // Index 6: Keshav Cup 3 (2025) માં હાજર હતા ?
        // Index 7: ક્રિકેટ માં આપની આવડત કઈ ?
        // Index 10: Please upload Your passport size photo for auction

        const players = rows.map((row: any, index: number) => {
            const c = row.c;

            const getValue = (i: number) => {
                if (!c || !c[i]) return '';
                const cell = c[i];
                // Use formatted value if available, otherwise raw value
                const val = cell.f || cell.v;
                if (val === null || val === undefined) return '';
                return String(val);
            };

            // Transform Google Drive links to direct image links for display
            let photoUrl = getValue(10);
            if (photoUrl && (photoUrl.includes('drive.google.com') || photoUrl.includes('docs.google.com/uc'))) {
                let driveId = '';
                if (photoUrl.includes('id=')) {
                    driveId = photoUrl.split('id=')[1].split('&')[0];
                } else if (photoUrl.includes('/d/')) {
                    driveId = photoUrl.split('/d/')[1].split('/')[0];
                }

                if (driveId) {
                    photoUrl = `https://lh3.googleusercontent.com/d/${driveId}`;
                }
            }

            return {
                id: `sheet-${index}`,
                timestamp: getValue(0),
                fullName: getValue(1),
                skill: getValue(7),
                participation: getValue(6),
                photo: photoUrl
            };
        });

        return NextResponse.json({ players });
    } catch (error: any) {
        console.error('Error in sheet-registrations API:', error);
        return NextResponse.json({
            players: [],
            error: 'Failed to fetch registration data',
            details: error.message
        }, { status: 500 });
    }
}
