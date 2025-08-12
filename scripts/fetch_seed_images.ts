import fs from "fs";
import path from "path";
import https from "https";

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!ACCESS_KEY) {
  console.error("Please set UNSPLASH_ACCESS_KEY environment variable");
  process.exit(1);
}

// Create static/seed directory
const staticSeedDir = path.resolve(__dirname, "../static/seed");
if (!fs.existsSync(staticSeedDir)) {
  fs.mkdirSync(staticSeedDir, { recursive: true });
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
  "messy bedroom floor"
];

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function downloadImage(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
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
      fs.unlink(destPath, () => {}); // Delete file on error
      reject(err);
    });
  });
}

async function searchUnsplash(query: string): Promise<string> {
  const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
  
  return new Promise((resolve, reject) => {
    const req = https.request(searchUrl, {
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
            https.request(photo.links.download_location, {
              headers: {
                'Authorization': `Client-ID ${ACCESS_KEY}`
              }
            }, () => {}).end();
            
            resolve(photo.urls.regular);
          } else {
            reject(new Error(`No results for query: ${query}`));
          }
        } catch (err) {
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
      const destPath = path.join(staticSeedDir, filename);
      
      console.log(`Downloading: ${filename}`);
      await downloadImage(imageUrl, destPath);
      
      console.log(`✓ Saved: ${filename}`);
    } catch (error) {
      console.error(`✗ Failed to fetch ${query}:`, error);
    }
  }
  
  console.log("\nDone! Images saved to:", staticSeedDir);
  console.log("Add these files to git and update seed data to use /seed/... paths");
}

main().catch(console.error);
