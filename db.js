
import sql from 'mssql';
import dotenv from "dotenv";
dotenv.config();


const config = {
	user: process.env.MSSQL_USER,
	password: process.env.MSSQL_PASSWORD,
	server: process.env.MSSQL_SERVER,
	database: process.env.MSSQL_DATABASE,
	options: {
		encrypt: false, // Use true if you're on Azure
		trustServerCertificate: true
	},
	requestTimeout: 60000 // 60 seconds
};


export async function connectMssql() {
	try {
		await sql.connect(config);
		console.log('Connected to MSSQL database');
		return sql;
	} catch (err) {
		console.error('MSSQL connection error:', err);
		throw err;
	}
}



















// import { MongoClient } from "mongodb";
// import dotenv from "dotenv";

// dotenv.config();

// const uri = process.env.MONGO_URI;
// const client = new MongoClient(uri);
// let isConnected = false;

// export const connectMongo = async (dbName) => {
//   if (!isConnected) {
//     await client.connect();
//     isConnected = true;
//     console.log("✅ Connected to MongoDB Atlas");
//   }

//   return client.db(dbName); // You now pass any db name you want
// };

// export const getMongoClient = async () => {
//   if (!isConnected) {
//     await client.connect();
//     isConnected = true;
//     console.log("✅ Connected to MongoDB Atlas");
//   }
//   return client; // Full MongoClient for admin access
// };























// import { MongoClient } from "mongodb";
// import dotenv from "dotenv";

// dotenv.config();

// const uri = process.env.MONGO_URI;
// const client = new MongoClient(uri);
// let isConnected = false;

// export const connectMongo = async (dbName) => {
//   if (!isConnected) {
//     await client.connect();
//     isConnected = true;
//     console.log("✅ Connected to MongoDB Atlas");
//   }

//   return client.db(dbName); // You now pass any db name you want
// };