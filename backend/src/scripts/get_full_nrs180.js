const mongoose = require('mongoose');
require('dotenv').config();
const DocumentChunk = require('../models/DocumentChunk');

const printFullNrs180 = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const docs = await DocumentChunk.find({ text: /NRS 624\.180/i });
    docs.forEach(d => {
      if (d.text.includes('Compensation') || d.text.includes('Service of process')) {
        console.log(`\n================ FOUND NRS 624.180 (${d.type}) ================`);
        console.log(d.text);
      }
    });
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

printFullNrs180();
