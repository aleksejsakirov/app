const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const { v4: uuidV4 } = require('uuid');
const { Sequelize, DataTypes } = require('sequelize');
const mysql = require('mysql2/promise');
const ses = require('express-session');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.use(express.static('public'));

app.use(ses(
	{
		secret: '1111',
		resave: false,
		saveUninitialized: true,
		cookie: { secure: false }
	}));

async function createDB() {
    const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '4385' });
    await conn.query(`CREATE DATABASE IF NOT EXISTS db_users_pr`);
    await conn.end();
}

async function init() {
	await conn_seq.sync({ alter: true });
	await create_admin();
}

(async () => {
    await createDB();
    await init(); 
})();

const conn_seq = new Sequelize('db_users_pr', 'root', '4385', {
	host: 'localhost',
	dialect: 'mysql',
	logging: false,
	define: {
		timestamps: false
	}
});

const User = conn_seq.define('users', {
	id: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	passwd: {
		type: DataTypes.STRING,
		allowNull: false
	},
	role: {
		type: DataTypes.STRING,
		allowNull: false
	}
});

async function create_admin() {
	const admin = await User.findOne({ where: { id: 1, role: "admin" } });
	if (!admin) {
		await User.create({ passwd: 1, role: "admin" });
	}
}

function html_users_table(users) {
	let html = `
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Admin panel</title>
        <style>
            table { border-collapse: collapse; width: 60%; }
            th, td { border: 1px solid #333; padding: 8px; text-align: left; }
            form { margin: 10px 0; }
            button { padding: 4px 10px; }
        </style>
    </head>
    <body>
        <h1>Админ-панель</h1>

        <h2>Пользователи</h2>

        <table>
            <tr>
                <th>ID</th>
                <th>Пароль</th>
                <th>Роль</th>
                <th>Удалить</th>
            </tr>`;

	users.forEach(u => {
		html += `
            <tr>
                <td>${u.id}</td>
                <td>${u.passwd}</td>
                <td>${u.role}</td>
                <td>
                    <form action="/admin/delete" method="post">
                        <input type="hidden" name="id" value="${u.id}">
                        <button type="submit">Удалить</button>
                    </form>
                </td>
            </tr>`;
	});

	html += `
        </table>

        <h2>Добавить пользователя</h2>

        <form action="/admin/add" method="post">
            <input type="text" name="passwd" placeholder="Пароль" required>
            <select name="role" required>
    			<option value="user">user</option>
    			<option value="admin">admin</option>
			</select>
            <button type="submit">Добавить</button>
        </form>

    </body>
    </html>
    `;

	return html;
}

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/login.html');
});

app.get('/show_users', async (req, res) => {
	if (req.session.role){
		const users = await User.findAll({ where: { role: 'user' } });
		return res.send(html_users_table(users));
	}
	res.redirect("/");
});

app.post("/admin/add", async (req, res) => {
	const { role, passwd } = req.body;
	const user = await User.create({ passwd: passwd, role: role });
	res.redirect("/show_users");
});

app.post("/admin/delete", async (req, res) => {
	const { id } = req.body;
	const user = await User.destroy({ where: { id: id } });
	res.redirect("/show_users");
});

app.post("/register", async (req, res) => {
	const { login, password } = req.body;
	if (!login || !password || !(/^\d+$/.test(login)))
		return res.json({ error: "Введите логин и пароль" });

	const user = await User.findOne({ where: { id: login, passwd: password } });

	if (!user) {
		return res.json({ error: "Неверный логин или пароль" });
	}
	if (user.role == "admin"){
		req.session.role = user.role;
	}
	return res.json({ success: true, role: user.role });
});


app.get('/room', (req, res) => {
	res.render('room', { roomId: req.params.room })
});

io.on('connection', socket => {
	socket.on('join-room', (roomId, userId) => {
		socket.join(roomId)
		socket.to(roomId).broadcast.emit('user-connected', userId)

		socket.on('disconnect', () => {
			socket.to(roomId).broadcast.emit('user-disconnected', userId)
		})
	})
})

server.listen(3000)