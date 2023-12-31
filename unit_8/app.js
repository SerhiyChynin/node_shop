let express = require('express');
let app = express();
let cookieParser = require('cookie-parser');
let admin = require('./public/admin.js');

/*public - имя папки где хранится статика*/

app.use(express.static('public'));

/*задаем шаблонизатор*/

app.set('view engine', 'pug');

/*Подключаем mysql модуль*/

let mysql = require('mysql2');

/*настраиваем модуль*/

app.use(express.json());
app.use(express.urlencoded());
app.use(cookieParser());

const nodemailer = require('nodemailer');

let con = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'shop'
});

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

app.listen(3000, function () {
  console.log('node express work on 3000');
});

app.use((req, res, next) => {
  if (req.originalUrl == '/admin' || req.originalUrl == '/admin-order'  ) {
    admin(req, res, con, next)
  } else{
    next();
  }
})

app.get('/', function (req, res) {
  let cat = new Promise((resolve, rej) => {
    con.query(
        "select id, slug, name, cost, image, category from (select id, slug, name,cost,image,category, if(if(@curr_category != category, @curr_category := category, '') != '', @k := 0, @k := @k + 1) as ind   from goods, ( select @curr_category := '' ) v ) goods where ind < 3",
      (err, res) => {
        if (err) return rej(err);
        resolve(res)
      }
    )
  });
  
  let catDescription = new Promise((resolve, rej) => {
    con.query(
      'SELECT * FROM category ',
      (err, res) => {
        if (err) return rej(err);
        resolve(res)
      }
    )
  });
  Promise.all([cat, catDescription]).then((value) => {
    console.log(value[1]);
    res.render('index', {
      goods: JSON.parse(JSON.stringify(value[0])),
      cat: JSON.parse(JSON.stringify(value[1]))
    });
  })

});

app.get('/cat', function (req, res) {

  console.log(req.query.id);
  let catId = req.query.id;

  let cat = new Promise(function (resolve, reject) {
    con.query(
      'SELECT * FROM category WHERE id=' + catId,
      function (error, result) {
        if (error) reject(error);
        resolve(result);
      });
  });
  let goods = new Promise(function (resolve, reject) {
    con.query(
      'SELECT * FROM goods WHERE category=' + catId,
      function (error, result) {
        if (error) reject(error);
        resolve(result);
      });
  });

  Promise.all([cat, goods]).then(function (value) {
    console.log(value[0]);
    res.render('cat', {
      cat: JSON.parse(JSON.stringify(value[0])),
      goods: JSON.parse(JSON.stringify(value[1]))
    });
  })
});

app.get('/goods/*', function (req, res) {
  // console.log('work');
  console.log(req.params['0']);
  // console.log(req);
  con.query('SELECT * FROM goods WHERE slug="' + req.params['0'] + '"', function (error, result, fields) {
    if (error) throw error;
    console.log(result);
    result = JSON.parse(JSON.stringify(result));
    console.log(result['0']['id']);
    con.query('SELECT * FROM images WHERE good_id=' + result[0]['id'], function (error, goodsImg, fields) {
      if (error) throw error;
      console.log(goodsImg);
      goodsImg = JSON.parse(JSON.stringify(goodsImg));
      res.render('goods', { goods: result, goods_img: goodsImg });
    });
});
});


app.get('/order', function (req, res) {
  res.render('order');
});


app.post('/get-category-list', function (req, res) {
  // console.log(req.body);
  con.query('SELECT id, category FROM category', function (error, result, fields) {
    if (error) throw error;
    console.log(result);
    res.json(result);
  });
});

app.post('/get-goods-info', function (req, res) {
  console.log(req.body.key);
  if(req.body.key.length !=0){
    con.query('SELECT id, name, cost FROM goods WHERE id IN ('+req.body.key.join(',')+')', function (error, result, fields) {
      if (error) throw error;
      console.log(result);
      let goods = {};
      for (let i = 0; i < result.length; i++){
        goods[result[i]['id']] = result[i];
      }
      res.json(goods);
    });
  } else {
    res.send('0');
  }
});

app.post('/finish-order', function (req, res) {
  console.log(req.body);
  if (req.body.key.length != 0) {
    let key = Object.keys(req.body.key);
    con.query(
      'SELECT id, name, cost FROM goods WHERE id IN (' + key.join(',') + ')',
      function (error, result, fields) {
        if (error) throw error;
        console.log(result);
        mailing(req.body, result).catch(console.error);
        saveOrder(req.body, result);
        res.send('1');
      })
      }
     else {
    res.send('0');
  }
})

app.get('/admin', function (req, res) {
  res.render('admin', {});
});
  // console.log(req.cookies.hash);
  // console.log(req.cookies);
  // console.log(req.cookies.id);
  // if (req.cookies.hash == undefined || req.cookies.id == undefined) {
  //   res.redirect('/login');
  //   return false;
  // }
  // con.query(
  //   'SELECT * FROM user WHERE id="' + req.cookies.id + '"and hash="' + req.cookies.hash + '"',
  //   function (error, result) {
  //     if (error) reject (error);
  //     console.log(result);
  //     if (result.length == 0) {
  //       console.log('error, user not found');
  //       res.redirect('/login');
  //     } else {
  //       res.render('admin', {});
  //     }
  //   });
  //       // res.render('admin', {});
  
// });



app.get('/admin-order', function (req, res) {

  con.query(`SELECT 
	shop_order.id as id,
	shop_order.user_id as user_id,
    shop_order.goods_id as goods_id,
    shop_order.goods_cost as goods_cost,
    shop_order.goods_amount as goods_amount,
    shop_order.total as total,
    from_unixtime(date, "%y-%m-%d %h:%m") as human_date,
    user_info.user_name as user,
    user_info.user_phone as phone,
    user_info.address as address
FROM
	shop.shop_order
LEFT JOIN
	user_info
ON  shop_order.user_id = user_info.id;
`, function (error, result, fields) {
    if (error) throw error;
    console.log(result);
    res.render('admin-order', { order: JSON.parse(JSON.stringify(result)) });
});

});

// Login form ******************************


app.get('/login', function (req, res) {
  res.render('login', {})
});

app.post('/login', function (req, res) {
  console.log('=================');
  console.log(req.body);
  console.log(req.body.login);
  console.log(req.body.password);
  console.log('=================');
    con.query(
      'SELECT * FROM user WHERE login="' + req.body.login + '"and password="' + req.body.password +'"',
      function (error, result) {
        if (error) reject(error);
        if (result.length == 0) {
          console.log('error, user not found');
          res.redirect('/login');
        } else {
          result = JSON.parse(JSON.stringify(result));
          let hash = makeHash(32);
          res.cookie('hash', hash);
          res.cookie('id', result[0]['id']);
          // пишем в БД хеш
          // console.log(result[0]['id']);
          sql = "UPDATE `shop`.`user` SET `hash` = '" + hash + "' WHERE `id` =" + result[0]['id'];
          con.query(sql, (err, resultQuery) => {
            if (err) throw err;
            res.redirect('/admin');
            // console.log(result[0]['hash']);
          })
        }
})
});

function saveOrder(data, result) {
  // data - info about user;
  // result - info about goods(key, amount); 
  let sql;
  sql = "INSERT INTO user_info (user_name, user_phone, user_email, address) VALUES ('" + data.username + "','" + data.phone + "','" + data.email
    + "','" + data.address + "')";
  con.query(sql, (err, resultQuery) => {
    if (err) throw err;
    console.log('1 user info saved');
    console.log(resultQuery);
    let userId = resultQuery.insertId;
    date = new Date() / 1000;
    for (let i = 0; i < result.length; i++){   //не оч вариант если 1000 товаров, будет 1000 раз дергать БД, можн записать сразу массив данных
      sql = "INSERT INTO shop_order (date, user_id, goods_id, goods_cost, goods_amount, total) VALUES ("
        + date + "," + userId + "," + result[i]['id'] + "," + result[i]['cost'] + "," + data.key[result[i]['id']] + "," +
        data.key[result[i]['id']] * result[i]['cost'] + ")";
      con.query(sql, (err, resultQuery) => {
        if (err) throw err;
        console.log(' 1 good saved');
        })
    }
  })
}

async function mailing(data, result) {
  let res = '<h2>Order in lite shop</h2>';
  let total = 0;
  for (let i = 0; i < result.length; i++) {
    res += `<p>${result[i]['name']} - ${data.key[result[i]['id']]}  - ${ result[i]['cost'] * data.key[result[i]['id']] } uah</p>`
    total += result[i]['cost'] * data.key[result[i]['id']];
  }
  res += '<hr>';
  res += `Total ${total} uah`;
  res += `<hr>Phone: ${data.phone}`;
  res += `<hr>User: ${data.username}`;
  res += `<hr>Address: ${data.address}`;
  res += `<hr>Email: ${data.email}`;
  console.log(res);
  let testAccount = await nodemailer.createTestAccount();

  const transporter = nodemailer.createTransport({
  host: "smtp.forwardemail.net",
  port: 465,
  secure: false,
  auth: {
    // TODO: replace `user` and `pass` values from <https://forwardemail.net>
    user: testAccount.user,
    pass: testAccount.pass
  }
});

  let mailOption = {
    from: '<sergey.chinin@gmail.com>',
    to: "sergey.chinin@gmail.com," + data.email,
    subject: 'lite shop order',
    text: 'Hello thank for purchase',
    html: res
  };
  
  let info = await transporter.sendMail(mailOption)
  console.log("MessageSend: %s", info.messageId);
  console.log("PreviewSend: %s", nodemailer.getTestMessageUrl(info));
  return true;
}


function makeHash(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

