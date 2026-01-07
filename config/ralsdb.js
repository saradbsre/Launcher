// RALS DB MSSQL connection config
const ralsdbConfig = {
	user: 'sa',
	password: 'gov123?',
	server: '172.16.10.10\\sqlserver2019', // e.g., 'rals-sql-instance.xxxxxxx.region.rds.amazonaws.com'
	database: 'SAEEDSHABIBNet912626',
   // port:14331,
	options: {
		encrypt: false, // Use true if connecting to Azure/AWS
		trustServerCertificate: false // Set to true for self-signed certs
	}
};

export default ralsdbConfig;
