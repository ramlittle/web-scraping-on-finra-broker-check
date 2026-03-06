@echo off
echo 🚀 Starting FINRA BrokerCheck Scraper...
if not exist "screenshots" mkdir screenshots
node index.js
echo ✅ Scrape complete. Check verification_report.csv
pause