import dotenv from 'dotenv';
dotenv.config();

import { searchDamAssetsHandler } from './src/tools/searchAssets.js';
import { getMissingProjectsHandler } from './src/tools/chaseUploads.js';

async function runTests() {
  console.log("--- Testing CapyDAM MCP Server Tools ---\n");

  console.log("1. Testing 'get_missing_projects'...");
  try {
    const missingRes = await getMissingProjectsHandler();
    console.log("Result:");
    console.log(JSON.stringify(missingRes, null, 2));
  } catch (err: any) {
    console.error("Failed get_missing_projects:", err.message);
  }

  console.log("\n2. Testing 'search_dam_assets'...");
  try {
    const searchRes = await searchDamAssetsHandler({ query: "a" }); // "a" should match something
    console.log("Result:");
    console.log(JSON.stringify(searchRes, null, 2));
  } catch (err: any) {
    console.error("Failed search_dam_assets:", err.message);
  }
}

runTests();
