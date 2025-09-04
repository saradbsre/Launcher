import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let isConnected = false;

export const connectMongo = async (dbName) => {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
    console.log("✅ Connected to MongoDB Atlas");
  }

  return client.db(dbName); // You now pass any db name you want
};