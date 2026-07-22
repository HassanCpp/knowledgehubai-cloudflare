const mongoose = require('mongoose');

const systemMetricsSchema = new mongoose.Schema({
  metricName: {
    type: String,
    required: true,
    index: true,
  },
  value: {
    type: Number,
    required: true,
  },
  labels: {
    type: Map,
    of: String,
    default: {},
  },
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: false },
  collection: 'systemMetrics',
});

// Create index for plotting metrics over time
systemMetricsSchema.index({ metricName: 1, timestamp: -1 });

module.exports = mongoose.model('SystemMetrics', systemMetricsSchema);
