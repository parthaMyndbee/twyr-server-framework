exports.config = ({
	"port": 6379,
	"host": "127.0.0.1",
	"options": {
		"parser": "hiredis",
		"detect_buffers": true
	}
});