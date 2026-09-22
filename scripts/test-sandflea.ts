import fs from 'fs';
import path from 'path';

async function testSandFlea() {
  console.log("Testing Sand Flea extraction pipeline...");
  const startTime = Date.now();

  const filePath = path.resolve(__dirname, '../test-ocr-text.png');
  const fileBytes = fs.readFileSync(filePath);
  
  // Create a Blob/File for FormData
  const formData = new FormData();
  formData.append('file', new Blob([fileBytes]), 'test-ocr-text.png');
  formData.append('file_type', 'png');

  try {
    const response = await fetch("http://localhost:8001/extract-document", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errText}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;
    
    console.log(`\nExtraction completed in ${duration}ms`);
    console.log("=== Extracted Text ===");
    console.log(data.extractedText);
    console.log("======================");

  } catch (error) {
    console.error("Test failed:", error);
  }
}

testSandFlea();
