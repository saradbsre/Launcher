// AWS DB MSSQL connection config
const awsdbConfig = {
	user: 'sa',
	password: 'bsre123?',
	//server: '192.168.1.10', 
	server: 'binshabib.dyndns.org',
	port: 14331,
	database: 'AWSRALS052626',
   // port:14331,
	options: {
		encrypt: false, // Use true if connecting to Azure/AWS
		trustServerCertificate: false // Set to true for self-signed certs
	}
};

export default awsdbConfig;
