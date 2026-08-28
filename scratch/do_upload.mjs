import fs from 'fs';

async function upload() {
  try {
    const config = JSON.parse(fs.readFileSync('C:\\Users\\sudhi\\.config\\configstore\\firebase-tools.json', 'utf8'));
    const token = config.tokens?.access_token;
    if (!token) {
      throw new Error('No access token found in firebase config');
    }

    const filePath = './ExtraPadhai.apk';
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`Loaded ExtraPadhai.apk (${fileBuffer.length} bytes)`);

    const bucket = 'samrtboard.firebasestorage.app';
    const objectPath = 'apk/ExtraPadhai.apk';
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`;

    console.log('Uploading to Google Cloud Storage via JSON API...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/vnd.android.package-archive',
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upload failed with status ${response.status}: ${errText}`);
    }

    const resJson = await response.json();
    console.log('Upload successful! Response:', resJson);

    // Get public view/download link using Firebase Storage format:
    // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<objectPath>?alt=media
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media`;
    console.log('\nFirebase Storage Download URL:');
    console.log(downloadUrl);
  } catch (e) {
    console.error('Error during upload:', e);
  }
}

upload();
