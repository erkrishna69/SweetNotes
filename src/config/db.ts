import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const connUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sweetnotes';
    console.log(`Connecting to MongoDB at: ${connUri}...`);
    await mongoose.connect(connUri);
    console.log('MongoDB Connected successfully.');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};
