
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    console.log('--- SHEET REGISTRATIONS API CALLED ---');
    try {
        const sheetId = '1zyokrUHFwtDuLqsxQXwPANm4ezK7ao81QfyWEnBv7Tk';
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;

        console.log('Fetching from URL:', url);
        const res = await fetch(url, { cache: 'no-store' });
        
        if (!res.ok) {
            console.error('Google Sheet fetch failed status:', res.status);
            throw new Error(`Failed to fetch sheet: ${res.statusText}`);
        }

        const text = await res.text();
        console.log('Response text length:', text.length);

        // Parse the returned text because Google wraps the JSON in a callback-like structure
        const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
        if (!match) {
            console.error('Regex match failed. Raw text starts with:', text.substring(0, 100));
            throw new Error('Invalid response format from Google Sheets proxy - check if sheet is public');
        }

        let json;
        try {
            json = JSON.parse(match[1]);
        } catch (parseErr: any) {
            console.error('JSON parse failed for match:', match[1].substring(0, 100));
            throw new Error('Failed to parse JSON from Google Sheets: ' + parseErr.message);
        }

        if (!json.table || !json.table.rows) {
            console.error('Unexpected JSON structure:', Object.keys(json));
            throw new Error('Unexpected JSON structure from Google Sheets');
        }

        const rows = json.table.rows;
        const players = rows.slice(1).map((row: any, index: number) => {
            const c = row.c;
            const getValue = (i: number) => {
                if (!c || !c[i]) return '';
                const cell = c[i];
                const val = cell.f || cell.v;
                return val === null || val === undefined ? '' : String(val);
            };

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
        }).filter((p: any) => p.fullName && p.fullName.trim() !== '');

        console.log(`Found ${players.length} valid players in sheet`);
        return NextResponse.json({ players });
    } catch (error: any) {
        console.error('Error in sheet-registrations API:', error);
        return NextResponse.json({
            players: [],
            error: error.message || 'Failed to fetch registration data',
            details: error.stack
        }, { status: 500 });
    }
}
