/**
 * Google Apps Script for Player Self-Registration Pipeline
 * 
 * Instructions:
 * 1. Open your Google Sheet connected to the Google Form.
 * 2. Go to Extensions > Apps Script.
 * 3. Replace the placeholder values with your Supabase URL and Service Role Key.
 * 4. Paste this code.
 * 5. Set up a trigger: Triggers (clock icon) > Add Trigger > onFormSubmit > From spreadsheet > On form submit.
 */

const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_SERVICE_KEY = 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

function onFormSubmit(e) {
    const responses = e.namedValues;

    // 1. Extract Data
    const playerData = {
        first_name: responses['First Name'] ? responses['First Name'][0] : '',
        last_name: responses['Last Name'] ? responses['Last Name'][0] : '',
        email: responses['Email Address'] ? responses['Email Address'][0] : '',
        phone: responses['Phone Number'] ? responses['Phone Number'][0] : '',
        batting_style: responses['Batting Style'] ? responses['Batting Style'][0] : 'RIGHT_HANDED',
        bowling_style: responses['Bowling Style'] ? responses['Bowling Style'][0] : 'RIGHT_ARM',
        auction_status: 'pending'
    };

    // 2. Handle Photo (Option B: Upload to Supabase Storage)
    const fileUrl = responses['Player Photo'] ? responses['Player Photo'][0] : '';
    if (fileUrl) {
        try {
            const fileId = fileUrl.match(/id=([a-zA-Z0-9_-]+)/)[1];
            const file = DriveApp.getFileById(fileId);
            const blob = file.getBlob();
            const fileName = `players/${Date.now()}_${playerData.email.replace(/[^a-z0-9]/gi, '_')}.jpg`;

            const storageUrl = `${SUPABASE_URL}/storage/v1/object/players/${fileName}`;
            const uploadOptions = {
                method: 'post',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': blob.getContentType()
                },
                payload: blob.getBytes(),
                muteHttpExceptions: true
            };

            const uploadRes = UrlFetchApp.fetch(storageUrl, uploadOptions);
            if (uploadRes.getResponseCode() === 200) {
                playerData.photo_url = `${SUPABASE_URL}/storage/v1/object/public/players/${fileName}`;
            } else {
                // Fallback to Drive Link if upload fails
                playerData.photo_url = fileUrl;
            }
        } catch (err) {
            Logger.log('Photo Upload Error: ' + err.toString());
            playerData.photo_url = fileUrl;
        }
    }

    // 3. Insert into PostgreSQL via REST API
    const dbOptions = {
        method: 'post',
        contentType: 'application/json',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=minimal'
        },
        payload: JSON.stringify(playerData),
        muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(`${SUPABASE_URL}/rest/v1/players`, dbOptions);
    Logger.log('Supabase Response: ' + response.getContentText());
}
