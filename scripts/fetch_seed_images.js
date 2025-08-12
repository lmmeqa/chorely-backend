"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!ACCESS_KEY) {
    console.error("Please set UNSPLASH_ACCESS_KEY environment variable");
    process.exit(1);
}
// Create static/seed directory
const staticSeedDir = path_1.default.resolve(__dirname, "../static/seed");
if (!fs_1.default.existsSync(staticSeedDir)) {
    fs_1.default.mkdirSync(staticSeedDir, { recursive: true });
}
// Seed image queries
const seedQueries = [
    "vacuum living room",
    "clean kitchen counter",
    "wash dishes",
    "take out trash",
    "do laundry",
    "dirty bathroom shower tiles",
    "unwashed dishes in sink",
    "messy bedroom floor",
    "taking out trash bin",
    "dusting shelves",
    "mopping kitchen floor",
    "clean bathroom sink shower",
    "organized closet wardrobe",
    "laundry washing machine",
    "sweeping porch",
    "made bed bedroom",
    "watering plants indoor",
    "messy closet clothes floor"
];
function slugify(input) {
    return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs_1.default.createWriteStream(destPath);
        https_1.default.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download: ${res.statusCode}`));
                return;
            }
            res.pipe(file);
            file.on("finish", () => {
                file.close();
                resolve();
            });
        }).on("error", (err) => {
            fs_1.default.unlink(destPath, () => { }); // Delete file on error
            reject(err);
        });
    });
}
async function searchUnsplash(query) {
    const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
    return new Promise((resolve, reject) => {
        const req = https_1.default.request(searchUrl, {
            headers: {
                'Authorization': `Client-ID ${ACCESS_KEY}`
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.results && result.results.length > 0) {
                        const photo = result.results[0];
                        // Register the download
                        https_1.default.request(photo.links.download_location, {
                            headers: {
                                'Authorization': `Client-ID ${ACCESS_KEY}`
                            }
                        }, () => { }).end();
                        resolve(photo.urls.regular);
                    }
                    else {
                        reject(new Error(`No results for query: ${query}`));
                    }
                }
                catch (err) {
                    reject(err);
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}
async function main() {
    console.log("Fetching seed images from Unsplash...");
    for (const query of seedQueries) {
        try {
            console.log(`Searching for: ${query}`);
            const imageUrl = await searchUnsplash(query);
            const filename = `${slugify(query)}.jpg`;
            const destPath = path_1.default.join(staticSeedDir, filename);
            console.log(`Downloading: ${filename}`);
            await downloadImage(imageUrl, destPath);
            console.log(`✓ Saved: ${filename}`);
        }
        catch (error) {
            console.error(`✗ Failed to fetch ${query}:`, error);
        }
    }
    console.log("\nDone! Images saved to:", staticSeedDir);
    console.log("Add these files to git and update seed data to use /seed/... paths");
}
main().catch(console.error);
