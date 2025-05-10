import Redis from 'ioredis';

// Create a Redis client instance
// The same instance is used for all operations in all files
const redis = new Redis();

export default redis;