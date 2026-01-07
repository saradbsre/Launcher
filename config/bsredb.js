// BSRE DB MSSQL connection config
const bsredbConfig = {
	user: 'sa',
	password: 'bsre123?',
	server: 'binshabib.dyndns.org', // e.g., 'bsre-sql-instance.xxxxxxx.region.rds.amazonaws.com'
	database: 'CENTRALIZEDDB',
	options: {
		encrypt: false, // Use true if connecting to Azure/AWS
		trustServerCertificate: false // Set to true for self-signed certs
	}
};

export default bsredbConfig;
