const express = require ("express");
const cors = require ('cors');
const app = express();
const port = process.env.PORT || 3000 ;

app.use(cors());
app.use(express.json());

app.get("/", (req, res ) => {
    res.send('blood donation  website server is cooking ')
});

app.listen(port ,()=>{
    console.log(`my blood donation  running on port ${port}`)
})