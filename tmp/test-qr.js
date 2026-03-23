
const QRCode = require('qrcode');

async function test() {
  try {
    const data = JSON.stringify({ r: "test-req", g: "test-guest" });
    const url = await QRCode.toDataURL(data);
    console.log("QR Generation Successful!");
    console.log("URL Length:", url.length);
    console.log("URL Start:", url.substring(0, 50));
    process.exit(0);
  } catch (err) {
    console.error("QR Generation Failed:", err);
    process.exit(1);
  }
}

test();
