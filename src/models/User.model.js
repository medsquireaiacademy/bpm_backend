const { Schema, model } = require('mongoose');
const { ROLES } = require('../config/constants');

const userSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    role: { type: String, required: true, enum: Object.values(ROLES), index: true },
    propertyId: { type: String, index: true },
    householdId: { type: String, index: true },
    apartmentName: { type: String },
    flatNumber: { type: String },
    skills: [{ type: String }],
    active: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = model('User', userSchema);
