const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://<username>:<password>@cluster0.mongodb.net/chat-app?retryWrites=true&w=majority';
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
    username: String,
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

app.use(express.static('public'));
app.use(express.json());

app.post('/register', async (req, res) => {
    const { username } = req.body;
    let user = await User.findOne({ username });
    if (!user) {
        user = new User({ username });
        await user.save();
    }
    res.json(user);
});

app.post('/add-friend', async (req, res) => {
    const { userId, friendUsername } = req.body;
    const user = await User.findById(userId);
    const friend = await User.findOne({ username: friendUsername });
    if (user && friend) {
        user.friends.push(friend._id);
        await user.save();
        res.json(user);
    } else {
        res.status(404).send('User not found');
    }
});

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('join', async ({ userId }) => {
        const user = await User.findById(userId).populate('friends');
        socket.userId = userId;
        socket.emit('friendsList', user.friends);
    });

    socket.on('sendMessage', async ({ senderId, recipientId, text }) => {
        const message = new Message({ sender: senderId, recipient: recipientId, text });
        await message.save();
        socket.to(recipientId).emit('newMessage', message);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
