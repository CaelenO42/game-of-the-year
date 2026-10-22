const express = require('express'); // 1. Import Express
const app = express();              // 2. Initialize the app
const PORT = 3000;                  // 3. Define a port

// 4. Define a route for the home page
app.get('/', (req, res) => {
    res.send('Hello World!');
});

// 5. Start the server and listen for requests
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
