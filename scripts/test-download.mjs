
async function testDownload() {
    const driveId = '1LEJyfCF9xcTpAD1nd-6biDGXy0BRfMFw';
    const downloadUrl = `https://docs.google.com/uc?export=download&id=${driveId}`;
    
    console.log(`Fetching from ${downloadUrl}...`);
    const response = await fetch(downloadUrl);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    
    const text = await response.text();
    const fs = await import('fs');
    fs.writeFileSync('download_debug.html', text);
    console.log('Full response written to download_debug.html');
    
    const match = text.match(/confirm=([a-zA-Z0-9_-]+)/);
    console.log('Match result:', match ? match[1] : 'NOT FOUND');
}

testDownload();
