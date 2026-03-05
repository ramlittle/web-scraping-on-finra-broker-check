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

            // const browser = await puppeteer.launch({ headless: "new" });
            const browser = await puppeteer.launch({
                headless: false, // This opens a physical Chrome window so you can watch
                defaultViewport: null,
                args: ['--start-maximized']
            });
            const page = await browser.newPage();

            for (let i = 0; i < total; i++) {
                const record = inputRecords[i];
                const finraId = record.Finra || record.finra;
                const expectedRaw = record.Company || record.company;
                console.log('\n Checking Record number ', i + 1, ' :');
                console.log('finra :: ', finraId);
                console.log('Company :: ', expectedRaw);
                const url = `https://brokercheck.finra.org/individual/summary/${finraId}`;
                let status = "Error";
                let currentFirmRaw = "N/A";

                try {
                    // 1. Wait for the page to load
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

                    // 2. WAIT specifically for the tag YOU found in your screenshot
                    // This is much more reliable than generic classes
                    await page.waitForSelector('investor-tools-current-registrations', { timeout: 15000 });

                    // Take the screenshot AFTER the element is confirmed to exist
                    await page.screenshot({ path: `debug_${finraId}.png` });

                    // 3. Extract the data
                    currentFirmRaw = await page.evaluate(() => {
                        const container = document.querySelector('investor-tools-current-registrations');
                        if (!container) return "NOT_REGISTERED";

                        // Look for the link that points to a firm summary
                        const firmLink = container.querySelector('a[href*="/firm/summary/"]');
                        if (firmLink) {
                            // Clean up "(CRD#:XXXX)" from the string
                            return firmLink.innerText.split('(CRD#')[0].trim();
                        }

                        return "FIRM_LINK_NOT_FOUND";
                    });

                    // 4. Match Logic
                    if (currentFirmRaw === "NOT_REGISTERED" || currentFirmRaw === "FIRM_LINK_NOT_FOUND") {
                        status = "missed opportunity";
                    } else {
                        const isMatch = cleanName(currentFirmRaw).includes(cleanName(expectedRaw)) ||
                            cleanName(expectedRaw).includes(cleanName(currentFirmRaw));
                        status = isMatch ? "good" : "missed opportunity";
                    }

                } catch (err) {
                    // If we time out, take a screenshot of the ERROR state to see why
                    await page.screenshot({ path: `error_${finraId}.png` });
                    status = "Timeout/Error";
                    console.log(`\n[!] Skipping ${finraId}: View error_${finraId}.png to see the page state.`);
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