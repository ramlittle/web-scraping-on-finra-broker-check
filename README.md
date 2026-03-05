# web-scraping-on-finra-broker-check
This is a web scraper i made to automate checking of a person if he is still an active agent based on the person's finra and Company

# Program details
this program is created in nodejs and puppeteer
reference: https://gemini.google.com/share/92b78530b2f0

STEPS 1:
We need three main packages:
puppeteer: The browser automation engine.
puppeteer-extra & puppeteer-extra-plugin-stealth: To bypass bot detection.
csv-parser: To read your spreadsheet data efficiently.

npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth csv-parser
npm install objects-to-csv
npm install cli-progress

STEP 2:
create the scraper script
Create a file named index.js in your folder and paste the following code.

Note on Selectors: I have used the most likely selector for the firm name. If FINRA updates their site, you may need to right-click the company name on their page, click "Inspect", and update the .current-registration-firm-name selector below.

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const csv = require('csv-parser');
const ObjectsToCsv = require('objects-to-csv');
const cliProgress = require('cli-progress');

puppeteer.use(StealthPlugin());

// Standardizes names to avoid false negatives with LLC, Inc, etc.
function cleanName(name) {
    if (!name) return "";
    return name.toUpperCase()
        .replace(/LLC|INC|LTD|CORP|CO\.|CORPORATION|INCORPORATED|FINANCIAL/g, '')
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}

async function runCheck() {
    const inputRecords = [];
    const finalReport = [];
    
    // Load the CSV
    fs.createReadStream('data.csv')
        .pipe(csv())
        .on('data', (data) => inputRecords.push(data))
        .on('end', async () => {
            const total = inputRecords.length;
            console.log(`🚀 Starting verification for ${total} records...`);

            // Initialize Progress Bar
            const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
            progressBar.start(total, 0);

            const browser = await puppeteer.launch({ headless: "new" });
            const page = await browser.newPage();

            for (let i = 0; i < total; i++) {
                const record = inputRecords[i];
                const finraId = record.Finra || record.finra;
                const expectedRaw = record.Company || record.company;
                
                const url = `https://brokercheck.finra.org/individual/summary/${finraId}`;
                let status = "Error";
                let currentFirmRaw = "N/A";

                try {
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForSelector('.current-registration-firm-name', { timeout: 8000 });

                    currentFirmRaw = await page.evaluate(() => {
                        return document.querySelector('.current-registration-firm-name').innerText.trim();
                    });

                    const isMatch = cleanName(currentFirmRaw).includes(cleanName(expectedRaw)) || 
                                    cleanName(expectedRaw).includes(cleanName(currentFirmRaw));
                    
                    status = isMatch ? "good" : "missed opportunity";
                } catch (err) {
                    status = "check manually";
                }

                finalReport.push({
                    status,
                    lead_name: record.Name || record.name,
                    finra: finraId,
                    phone: record.Phone || record.phone,
                    company: currentFirmRaw
                });

                // Update Progress Bar
                progressBar.update(i + 1);

                // Polite delay
                await new Promise(r => setTimeout(r, 1200 + Math.random() * 1000));
            }

            progressBar.stop();
            const csvOutput = new ObjectsToCsv(finalReport);
            await csvOutput.toDisk('./verification_report.csv');

            console.log("\n✅ Done! Report saved as 'verification_report.csv'");
            await browser.close();
        });
}

runCheck();

Step 3: prepare github
Prepare for GitHub
Before you push this to GitHub, you must ignore the massive node_modules folder and any local data.

Create a .gitignore file:

Bash
touch .gitignore
Open it and add these lines:

Plaintext
node_modules/
data.csv
.DS_Store

Summary Checklist
[ ] CSV Headers: Ensure your data.csv has headers named exactly Finra and Company.

[ ] Rate Limiting: Don't remove the setTimeout. Scraping 500 records too fast will trigger a temporary IP ban.

[ ] Headless Mode: If you get blocked, change headless: "new" to headless: false in the script so you can see if a Captcha appears.

video reference: https://www.youtube.com/watch?v=5HGBG9AiIzo

Your project structure should look like this in order for this to work

root-folder/
├── node_modules/
├── index.js
├── data.csv            <-- Your input file
├── verification_report.csv <-- Created by the script
├── package.json
└── README.md




# ============================================ HOW TO =======================
FINRA BrokerCheck Verifier
A Node.js automation tool built with Puppeteer to verify if financial professionals are still registered with their listed companies. This script processes a bulk list of records and generates a status report, helping to identify "Missed Opportunities" for lead management.

🚀 Features
Headless Automation: Uses Puppeteer to navigate the FINRA BrokerCheck website.

Stealth Mode: Integrated with puppeteer-extra-plugin-stealth to bypass bot detection.

Fuzzy Matching: Automatically cleans legal suffixes (LLC, Inc, Corp) and punctuation to ensure accurate company comparisons.

CSV Processing: Reads from data.csv and outputs a detailed verification_report.csv.

🛠️ Installation
Clone the repository:

Bash
git clone https://github.com/yourusername/finra-checker.git
cd finra-checker
Install dependencies:

Bash
npm install
📊 Setup & Usage
1. Prepare your Data
Ensure you have a file named data.csv in the root directory. It must contain the following headers:

Name

Finra

Phone

Company

2. Run the Script
Execute the following command in your terminal:

Bash
node index.js
3. View the Results
Once complete, the script will generate verification_report.csv with these columns:

status: good (match found) or missed opportunity (firm changed).

lead_name: The person's name.

finra: The unique FINRA ID used for the search.

phone: Contact number from the source.

company: The actual current firm found on BrokerCheck.

🛡️ Technical Logic: The Cleaning Process
To avoid false negatives, the script standardizes names before comparing:

Converts all text to Uppercase.

Removes legal tags: LLC, INC, LTD, CORP, CO, FINANCIAL.

Strips punctuation and extra whitespace.

Performs a mutual inclusion check (e.g., does "LPL" exist within "LPL FINANCIAL LLC").

⚠️ Disclaimer
This tool is for educational and professional data verification purposes. Ensure you comply with FINRA's Terms of Service regarding automated access. The script includes a random "jitter" delay to mimic human browsing patterns and reduce server load.