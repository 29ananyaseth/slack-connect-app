"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const axios_1 = __importDefault(require("axios"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
const CLIENT_ID = process.env.SLACK_CLIENT_ID;
const CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const REDIRECT_URI = process.env.SLACK_REDIRECT_URI;
const PORT = process.env.PORT || 5000;
// --- Load/Save scheduled messages ---
function loadScheduledMessages() {
    const file = path_1.default.join(__dirname, 'scheduled_messages.json');
    if (!fs_1.default.existsSync(file))
        return [];
    return JSON.parse(fs_1.default.readFileSync(file, 'utf8'));
}
function saveScheduledMessages(messages) {
    const file = path_1.default.join(__dirname, 'scheduled_messages.json');
    fs_1.default.writeFileSync(file, JSON.stringify(messages, null, 2));
}
// ---  Load/Save Slack token ---
function loadToken() {
    const tokenPath = path_1.default.join(__dirname, 'slack_token.json');
    if (!fs_1.default.existsSync(tokenPath))
        return null;
    return JSON.parse(fs_1.default.readFileSync(tokenPath, 'utf-8'));
}
function saveToken(tokenData) {
    const tokenPath = path_1.default.join(__dirname, 'slack_token.json');
    fs_1.default.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
}
// --- Refresh token logic ---
async function refreshSlackToken(refresh_token) {
    try {
        const response = await axios_1.default.post('https://slack.com/api/oauth.v2.access', null, {
            params: {
                grant_type: "refresh_token",
                refresh_token,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
            },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return response.data;
    }
    catch (err) {
        console.log("Error refreshing Slack token:", err);
        return null;
    }
}
// --- Slack OAuth: Start flow ---
app.get('/auth/slack', (req, res) => {
    const url = `https://slack.com/oauth/v2/authorize?client_id=${CLIENT_ID}&scope=channels:read,chat:write,groups:read,im:read,mpim:read&redirect_uri=${REDIRECT_URI}`;
    res.redirect(url);
});
// --- OAuth redirect: Save access token ---
app.get('/slack/oauth_redirect', async (req, res) => {
    const code = req.query.code;
    if (!code)
        return res.status(400).send('No code provided');
    try {
        const tokenRes = await axios_1.default.post('https://slack.com/api/oauth.v2.access', null, {
            params: {
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code,
                redirect_uri: REDIRECT_URI,
            },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const data = tokenRes.data;
        if (!data.ok)
            return res.status(400).json({ error: data.error });
        // Store tokens 
        const tokenData = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            team: data.team,
            authed_user: data.authed_user
        };
        saveToken(tokenData);
        res.json({
            message: 'Slack authentication successful and token stored!',
            team: data.team,
            authed_user: data.authed_user
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Token exchange failed', details: error.message || error.toString() });
    }
});
// --- Send message  ---
app.post('/slack/send-message', async (req, res) => {
    const tokenData = loadToken();
    if (!tokenData)
        return res.status(400).json({ error: 'No Slack token found. Please authenticate first.' });
    const { channel, text } = req.body;
    if (!channel || !text)
        return res.status(400).json({ error: 'Channel and text are required.' });
    let slackRes;
    try {
        slackRes = await axios_1.default.post('https://slack.com/api/chat.postMessage', { channel, text }, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
        // If token expired, try to referesh  
        if (slackRes.data.error === "invalid_auth" || slackRes.data.error === "token_expired") {
            if (tokenData.refresh_token) {
                const refreshed = await refreshSlackToken(tokenData.refresh_token);
                if (refreshed && refreshed.access_token) {
                    tokenData.access_token = refreshed.access_token;
                    saveToken(tokenData);
                    // Retry 
                    slackRes = await axios_1.default.post('https://slack.com/api/chat.postMessage', { channel, text }, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
                }
            }
        }
        if (!slackRes.data.ok)
            return res.status(400).json({ error: slackRes.data.error });
        res.json({ message: 'Message sent!', ts: slackRes.data.ts });
    }
    catch (error) {
        res.status(500).json({ error: error.message || error.toString() });
    }
});
// --- Schedule a message ---
app.post('/slack/schedule-message', (req, res) => {
    const { channel, text, sendAt } = req.body;
    if (!channel || !text || !sendAt) {
        return res.status(400).json({ error: 'channel, text, and sendAt (ISO string) required.' });
    }
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const messages = loadScheduledMessages();
    messages.push({ id, channel, text, sendAt, sent: false });
    saveScheduledMessages(messages);
    res.json({ message: 'Message scheduled!', id });
});
// --- List scheduled messages ---
app.get('/slack/scheduled-messages', (req, res) => {
    const messages = loadScheduledMessages().filter((msg) => !msg.sent);
    res.json(messages);
});
// --- delete a scheduled message by ID ---
app.delete('/slack/scheduled-message/:id', (req, res) => {
    const { id } = req.params;
    let messages = loadScheduledMessages();
    const msgIndex = messages.findIndex((m) => m.id === id && !m.sent);
    if (msgIndex === -1) {
        return res.status(404).json({ error: "Message not found or already sent." });
    }
    messages.splice(msgIndex, 1);
    saveScheduledMessages(messages);
    res.json({ message: "Scheduled message canceled.", id });
});
app.get('/', (req, res) => {
    res.send('Backend is working!');
});
// --- Scheduled Message Sender (interval with refresh logic) ---
setInterval(async () => {
    const messages = loadScheduledMessages();
    const now = Date.now();
    const tokenData = loadToken();
    if (!tokenData)
        return;
    let updated = false;
    for (let msg of messages) {
        if (!msg.sent && Date.parse(msg.sendAt) <= now) {
            try {
                let slackRes = await axios_1.default.post('https://slack.com/api/chat.postMessage', { channel: msg.channel, text: msg.text }, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
                // If token expired, try refreshing
                if (slackRes.data.error === "invalid_auth" || slackRes.data.error === "token_expired") {
                    if (tokenData.refresh_token) {
                        const refreshed = await refreshSlackToken(tokenData.refresh_token);
                        if (refreshed && refreshed.access_token) {
                            tokenData.access_token = refreshed.access_token;
                            saveToken(tokenData);
                            slackRes = await axios_1.default.post('https://slack.com/api/chat.postMessage', { channel: msg.channel, text: msg.text }, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
                        }
                    }
                }
                if (slackRes.data.ok) {
                    msg.sent = true;
                    updated = true;
                    console.log(`✅ Scheduled message sent to ${msg.channel} at ${msg.sendAt}`);
                }
                else {
                    console.log(`❌ Failed to send scheduled message:`, slackRes.data.error);
                }
            }
            catch (err) {
                console.log(`❌ Error sending scheduled message:`, err);
            }
        }
    }
    if (updated)
        saveScheduledMessages(messages);
}, 5 * 1000); // Check every 5 seconds
//--start server--
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
//# sourceMappingURL=index.js.map