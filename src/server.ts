import express from 'express';
import nunjucks from 'nunjucks';
const app = express();
const PORT = 3000;

nunjucks.configure('views', {
    autoescape: true,
    express: app
});
app.set("view engine", "njk");

app.get('/', (req, res) => {
    res.render('index', { value: "This is a test!" });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
