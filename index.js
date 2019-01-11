
let fs = require('fs');
let S3fs = require('s3fs');

const defaults = {
    bucket: null,
    region: null,
    verbose: false
};

class SyncDirS3 {
    constructor(options = {}) {
        this.settings = Object.assign({}, defaults, options);

        if(!this.settings.bucket) throw 'SyncDirS3 bucket option is required.';
        if(!this.settings.region) throw 'SyncDirS3 region option is required.';

        this.fs = fs;
        this.fsS3 = new S3fs(this.settings.bucket, { region: this.settings.region });
        this.log = this.settings.verbose ? console.log : () => {};
    }

    /**
     * Copying file or directory recursively in local filesystem
     * @param {String} src 
     * @param {String} dest 
     */
    async copy(src, dest, generateOptions = () => {}) {
        await SyncDirS3.walk(src, async (obj) => {
            let srcPath = obj.path;
            let destPath = dest + obj.path.substr(src.length);

            if(obj.isDirectory) {
                await SyncDirS3.createDirIfNotExist(destPath, this.fs, this.log);
            } else {
                await SyncDirS3.copyFile(srcPath, destPath, this.fs, this.fs, this.log, generateOptions);
            }
        }, this.fs);
    }

    /**
     * Uploads file or directory recursively from local filesystem to s3 bucket
     * @param {String} src Local path
     * @param {String} dest Bucket path
     */
    async upload(src, dest, generateOptions = () => {}) {
        await SyncDirS3.walk(src, async (obj) => {
            let srcPath = obj.path;
            let destPath = dest + obj.path.substr(src.length);

            if(obj.isDirectory) {
                await SyncDirS3.createDirIfNotExist(destPath, this.fsS3, this.log);
            } else {
                await SyncDirS3.copyFile(srcPath, destPath, this.fs, this.fsS3, this.log, generateOptions);
            }
        }, this.fs);
    }

    /**
     * Downloads file or directory recursively from s3 bucket to local filesystem
     * @param {String} src Bucket path
     * @param {String} dest Local path
     */
    async download(src, dest, generateOptions = () => {}) {
        await SyncDirS3.walk(src, async (obj) => {
            let srcPath = obj.path;
            let destPath = dest + obj.path.substr(src.length);

            if(obj.isDirectory) {
                await SyncDirS3.createDirIfNotExist(destPath, this.fs, this.log);
            } else {
                await SyncDirS3.copyFile(srcPath, destPath, this.fsS3, this.fs, this.log, generateOptions);
            }
        }, this.fsS3);
    }
}

SyncDirS3.createDirIfNotExist = (path, fs = fs, log = console.log) => {
    // fix for aws s3 directories (it expects dir to have / at the end of path)
    if(path.slice(-1) !== '/') path += '/';

    return new Promise((resolve, reject) => {
        fs.stat(path, (err, stat) => {
            if(err && err.code === 'ENOENT') {
                fs.mkdir(path, (err) => {
                    if(err) {
                        reject(err);
                    } else {
                        log('Created directory ' + path + ' (OK)');
                        resolve();
                    }
                });
            } else if(err) {
                reject('createDirIfNotExist('+path+', ...) errored with ' + err.code + ' code');
            } else if(!err) {
                if(stat.isDirectory()) {
                    log('Directory ' + path + ' already exists (OK)');
                    resolve();
                } else {
                    reject(path + ' already exists and is a file not a directory');
                }
            }
        });
    });
};

SyncDirS3.copyFile = (srcPath, destPath, srcFs = fs, destFs = fs, log = console.log, generateOptions = () => {}) => {
    return new Promise((resolve, reject) => {
        let done = (err) => {
            if (!cbCalled) {
                cbCalled = true;

                if(err) {
                    reject(err);
                } else {
                    log('Copied file ' + destPath + ' (OK)');
                    resolve();
                }
            }
        };
        
        let cbCalled = false;
        let rd = srcFs.createReadStream(srcPath);
        let wr = destFs.createWriteStream(destPath, generateOptions(srcPath));

        rd.on('error', done);
        wr.on('error', done);
        wr.on('close', done.bind(done, null));
        rd.pipe(wr);
    });
};

SyncDirS3.walk = (path, callback = () => {}, fs = fs) => {
    return new Promise((resolve, reject) => {
        fs.stat(path, async (err, stat) => {
            if (stat && stat.isDirectory()) {
                // process directory
                await callback({
                    path: path,
                    isDirectory: true,
                    stat: stat
                });

                fs.readdir(path, async (err, list) => {
                    let walks = list.map((file) => {
                        return SyncDirS3.walk(path + '/' + file, callback, fs);
                    });

                    await Promise.all(walks);

                    resolve();
                });
            } else if(stat) {
                // process file
                await callback({
                    path: path,
                    isDirectory: false,
                    stat: stat
                });
                
                resolve();
            } else if(err) {
                reject(err);
            }
        });
    });
};

module.exports = SyncDirS3;