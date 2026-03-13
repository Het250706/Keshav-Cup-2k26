
async function checkSheet() {
    const sheetId = '1zyokrUHFwtDuLqsxQXwPANm4ezK7ao81QfyWEnBv7Tk';
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
    
    try {
        const res = await fetch(url);
        const text = await res.text();
        const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
        if (!match) return;
        
        const json = JSON.parse(match[1]);
        const rows = json.table.rows;
        
        let output = '';
        rows.forEach((row, i) => {
            const name = row.c && row.c[1]?.v || 'N/A';
            const photo = row.c && row.c[10]?.v || 'No URL';
            output += `PLAYER_DATA|${name}|${photo}\n`;
        });
        const fs = await import('fs');
        fs.writeFileSync('sheet_data_debug.txt', output);
        console.log('Written to sheet_data_debug.txt');
    } catch (err) {}
}

checkSheet();
