# syncdirs3
Transfer files between lambda and s3 filesystems recursively

## Usage
Install package

```bash
npm install syncdirs3 --save
```

Configure sync object

```js
let SyncDirS3 = require('syncdirs3');

let sync = new SyncDirS3({
        bucket: 'bucket-name',
        region: 'region-name',
        verbose: true
    });

sync.copy('src-directory', 'dest-directory'); // Copying file or directory recursively in local filesystem
sync.upload('src-directory', 'bucket-dest-directory'); // Uploads file or directory recursively from local filesystem to s3 bucket
sync.download('bucket-src-directory', 'dest-directory'); // Downloads file or directory recursively from s3 bucket to local filesystem
```

