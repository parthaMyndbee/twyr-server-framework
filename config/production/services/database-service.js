exports.config = ({
	"client": "pg",
	"debug": false,
	"connection": {
		"host": "127.0.0.1",
		"port": "5432",
		"user": "postgres",
		"password": "postgres",
		"database": "twyr"
	},
	"pool": {
		"min": 2,
		"max": 4
	}
});