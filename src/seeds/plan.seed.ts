import Plan from '../models/plan.model';

export const seedPlans = async () => {
  await Plan.findOneAndUpdate(
    { code: 'PREMIUM' },
    {
      $set: {
        name: 'Premium',
        price: 100000,
        currency: 'VND',
        durationDays: 30,
        features: ['PREMIUM_INTERVIEW_ACCESS'],
        status: 'ACTIVE',
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );
};