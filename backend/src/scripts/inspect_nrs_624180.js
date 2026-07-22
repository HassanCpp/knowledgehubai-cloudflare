const mongoose = require('mongoose');
require('dotenv').config();
const DocumentChunk = require('../models/DocumentChunk');

const inspectNrs180 = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const chunk = await DocumentChunk.findOne({ text: /NRS 624\.180/i, type: 'large' });
    if (!chunk) {
      console.log('NRS 624.180 large chunk not found, finding medium...');
      const med = await DocumentChunk.find({ text: /NRS 624\.180/i });
      med.forEach((m) => console.log(`[${m.type}] ${m.text}\n---`));
    } else {
      console.log(`\n================ RAW LARGE CHUNK FOR NRS 624.180 ================`);
      console.log(chunk.text);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

inspectNrs180();
