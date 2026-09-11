import mongoose, { Schema } from 'mongoose';
// Aggregate durable evidence; no candidate content, prompt, provider payload, or owner identity.
const schema = new Schema({
  dryRun: { type: Boolean, required: true },
  policy: { type: String, maxlength: 67, required: true },
  contentEligible: { type: Number, required: true },
  recordEligible: { type: Number, required: true },
  contentPurged: { type: Number, required: true },
  recordsPurged: { type: Number, required: true },
}, { timestamps: true });
export const RetentionRun = mongoose.model('RetentionRun', schema);
