import pdfParse from 'pdf-parse';

async function run() {
  console.log(typeof pdfParse);
  if (typeof pdfParse === 'function') {
    console.log("It's a function");
  } else if (pdfParse && typeof (pdfParse as any).default === 'function') {
    console.log("It's an object with default");
  } else {
    console.log("It's something else", pdfParse);
  }
}
run();
