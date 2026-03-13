const qrcode = require('qrcode');

const generateQR = async (text) => {
  try {
    const dataUrl = await qrcode.toDataURL(text);
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR Code', err);
    throw new Error('QR Code generation failed');
  }
};

module.exports = {
  generateQR,
};