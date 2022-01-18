// http://161.53.17.95:8081/?command=dataquery&uri=dl:Public.SHT20_1_temperature&format=json&mode=most-recent
// zadnjih 25 sati, svakih 1h : http://161.53.17.95:8081/?command=dataquery&uri=dl:Sensor_SHT20_1_hour&format=html&mode=backfill&P1=86400
// clock : http://161.53.17.95:8081/?command=clockcheck&format=json
// zadnjih 30 min, svakih 1min: http://161.53.17.95:8081/?command=dataquery&uri=dl:Sensor_SHT20_1_min&format=json&mode=backfill&P1=1800


const express = require('express');
const fetch = require('node-fetch');
const mysql = require('mysql');
const res = require('express/lib/response');
const createError = require('http-errors');
const app = express();
app.listen(3000, () => console.log("Listening at 3000"))
app.use(express.static('public'));
app.use(express.json());



//Create connection to database
const con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database:"baza"
});


con.connect((err) => {
    if (err) console.log("Error while connecting to database!");
    else console.log("MySql Connected")
})

//Create database - done
app.get('/createdb',(req,res) => {
    let sql = 'CREATE DATABASE baza';
    con.query(sql, (err,result) => {
        if (err) throw err;
        console.log(res);
        res.send('Database created...');
    })
})

//Create table - done
app.get('/createtable', (req, res) => {
    let sql = 'CREATE TABLE data(time VARCHAR(25),temperature FLOAT(0),humidity FLOAT(0), PRIMARY KEY(time))';
    con.query(sql, (err, result) => {
        if (err) throw err;
        console.log(res);
        res.send('Table created');
    })
})

//insert into db
app.get('/adddata', (req, res) => {
    let sql = 'INSERT INTO data SET ?';
    let query = con.query(sql, post, (err,result) => {
        if (err) throw err;
        res.send('Dodano u tablicu');
    });
})

//select data from db
app.get('/getdata', (req, res) => {

    let sqlInsert = 'INSERT IGNORE INTO data SET ?';
    const url = "http://161.53.17.95:8081/?command=dataquery&uri=dl:Sensor_SHT20_1_hour&format=json&mode=backfill&P1=450000"

    fetch(url, {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    })
        .then(response => {
            if (response.ok) {
                response.json().then(response => {
                    for (let res of response.data) {
                        let temp = JSON.stringify(res.vals[0]);
                        let hum = JSON.stringify(res.vals[7]);
                        let time1 = JSON.stringify(res.time)
                        let time12 = time1.split('T')[0];
                        let time21 = time1.split('T')[1];
                        time1 = time12 + " " + time21;
                        //time1 = time1.slice(12, time1.length - 1)
                        let data = { time: time1, temperature: temp, humidity: hum }
                        con.query(sqlInsert, data, (err, results) => {
                            if (err) {
                                const error= {success:false, message:'Query error!'}
                                res.send(error);
                                return;
                            }
                        })
                        
                    }
                    let sql = 'SELECT * FROM data order by time desc LIMIT 25';
                    let query = con.query(sql, (err, results) => {
                        if (err) throw err;
                        res.send(JSON.stringify(results));
                    })
                    
                })
            }
            else {
                const error = { success: false, message: 'Something is wrong with api :(' };
                res.send(error);
                return;
            }
        })
                
});
    
    


//select last 30min data from db
app.get('/getdata1', (req, res) => {
    let sqlDelete = 'TRUNCATE TABLE data2';
    let sqlInsert = 'INSERT INTO data2 SET ?';
    const url = "http://161.53.17.95:8081/?command=dataquery&uri=dl:Sensor_SHT20_1_min&format=json&mode=backfill&P1=1800";
    fetch(url, {
        'Content-Type': 'application/json',  
        'Accept' : 'application/json'
    })
        .then(response => {
            if (response.ok) {
                response.json()
                    .then(response => {
                        con.query(sqlDelete, (err, results) => {
                            if (err) {
                                res.send({ success: false, message: 'Query error!', error: err })
                                return;
                            }
                        })
                        for (let res of response.data) {
                        let time1 = JSON.stringify(res.time);
                        let temp = JSON.stringify(res.vals[0])
                        time1 = time1.slice(12, time1.length - 1);
                        let data = { time: time1, temperature: temp }
                        con.query(sqlInsert, data, (err, results) => {
                            if (err) throw err;
                        })
                        }
                    })
                
                
            } 
            
        }) 
                let sql = 'SELECT * FROM data2 order by id desc';
                let query = con.query(sql, (err, results) => {
                    if (err) {
                        const error = { success: false, message: "Database error!" }
                        res.send(error);
                    }
                    else res.send(JSON.stringify(results));
                    
            })
    
        
})

//delete all from table
app.get('/delete', (req, res) => {
    let sql = 'DROP TABLE data';
    let query = con.query(sql, (err, results) => {
        if (err) throw err;
        res.send("Izbrisano!")
    })
})


// Refresh data in db
app.get('/refresh', (req, res) => {
    getData();
})

//get clock
app.get('/clock', (req, res) => {
    const url = 'http://161.53.17.95:8081/?command=clockcheck&format=json'
    fetch(url, {
        'Content-Type': 'application/json',  
        'Accept' : 'application/json'
    })
        .then(response => response.json())
        .then(response => {
            res.send(JSON.stringify(response.time))
            
        })
})

//Search results
app.get('/searchdata', (req, res) => {
    const year = req.query.year;
    const month = req.query.month;
    const day = req.query.day;
    const timedate = "\'"+"\""+year + "-" + month + "-" + day;
    const sql = "SELECT * FROM data WHERE time LIKE " + timedate + "%"+"\'";
    con.query(sql, (err,results) => {
        if (err) throw err;
        if (results.length=== 0) {
            const error = { success: false, message: "No data found for: " + year + "-" + month + "-" + day+", try again." };
            res.send(error);
            return;
        }
        res.send(results);
    })
})

